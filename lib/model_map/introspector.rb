require "digest"
require "json"

module ModelMap
  # Reads the structure of every ActiveRecord model through reflection.
  # Nothing has to be declared on the models themselves.
  class Introspector
    SAFE_OPTION_TYPES = [String, Symbol, Integer, Float, TrueClass, FalseClass, NilClass].freeze

    def initialize(config = ModelMap.config)
      @config = config
    end

    def call
      models = model_classes
      names = models.map(&:name)
      payload = models.map { |klass| describe(klass, names) }
      link_polymorphic_targets!(payload)

      {
        app: @config.title,
        rails_version: (Rails.version if defined?(Rails) && Rails.respond_to?(:version)),
        groups: group_colors(payload),
        models: payload,
        load_errors: load_errors,
        fingerprint: self.class.fingerprint_for([payload, load_errors])
      }
    end

    def fingerprint
      call[:fingerprint]
    end

    def self.fingerprint_for(models)
      Digest::SHA256.hexdigest(JSON.generate(models))[0, 16]
    end

    CACHE_LOCK = Mutex.new

    # Cached result, rebuilt after a code reload (see Engine#to_prepare) or
    # when a migration changes the schema version.
    def self.cached(config = ModelMap.config)
      version = schema_version
      CACHE_LOCK.synchronize do
        if @cache.nil? || @cache_version != version
          reset_column_information! if @cache_version && @cache_version != version
          @cache = new(config).call
          @cache_version = version
        end
        @cache
      end
    end

    def self.invalidate!
      CACHE_LOCK.synchronize { @cache = nil }
    end

    def self.schema_version
      pool = ActiveRecord::Base.connection_pool
      context = pool.respond_to?(:migration_context) ? pool.migration_context : ActiveRecord::Base.connection.migration_context
      context.current_version
    rescue StandardError
      nil
    end

    def self.reset_column_information!
      ActiveRecord::Base.connection.schema_cache.clear!
      ActiveRecord::Base.descendants.each do |k|
        k.reset_column_information unless k.abstract_class?
      rescue StandardError
        nil
      end
    end

    def model_classes
      eager_load!

      ActiveRecord::Base.descendants
        .select { |k| live_class?(k) }
        .reject(&:abstract_class?)
        .select { |k| visible?(k.name) }
        .select { |k| table_present?(k) }
        .uniq(&:name)
        .sort_by(&:name)
    end

    private

    # Loads every model file. If one file raises (a typo mid-edit), keep going
    # file by file so the rest of the map still renders, and report the error.
    def eager_load!
      return unless defined?(Rails) && Rails.respond_to?(:application) && Rails.application
      return if Rails.application.config.eager_load

      Rails.application.eager_load!
    rescue StandardError, SyntaxError
      load_model_files_individually!
    end

    def load_errors
      @load_errors ||= []
    end

    def load_model_files_individually!
      model_dirs.each do |dir|
        Dir.glob(File.join(dir, "**", "*.rb")).sort.each do |file|
          relative = file.delete_prefix(dir + "/")
          next if relative.start_with?("concerns/")

          constant = relative.delete_suffix(".rb").split("/").map { |part| camelize(part) }.join("::")
          begin
            constant.safe_constantize
          rescue StandardError, SyntaxError, LoadError => e
            load_errors << { file: display_path(file), constant: constant, error: "#{e.class}: #{e.message.lines.first&.strip}" }
          end
        end
      end
    end

    def model_dirs
      paths = Rails.application.paths["app/models"]
      dirs = paths.respond_to?(:existent) ? paths.existent : Array(paths)
      dirs.map { |d| File.expand_path(d) }
    rescue StandardError
      []
    end

    def camelize(part)
      if Rails.respond_to?(:autoloaders) && Rails.autoloaders.respond_to?(:main)
        Rails.autoloaders.main.inflector.camelize(part, nil)
      else
        part.camelize
      end
    rescue StandardError
      part.camelize
    end

    def display_path(file)
      root = Rails.root.to_s + "/"
      file.start_with?(root) ? file.delete_prefix(root) : file
    end

    # After a code reload, old class objects can linger in descendants. Keep
    # only the class the constant currently points at.
    def live_class?(klass)
      name = klass.name
      return false if name.nil? || name.empty?

      current = name.safe_constantize
      current.equal?(klass)
    rescue StandardError
      false
    end

    def visible?(name)
      return true if @config.matches_any?(@config.include, name)
      return false if @config.matches_any?(@config.exclude, name)
      return false if !@config.include_framework_models && @config.framework_model?(name)

      true
    end

    def table_present?(klass)
      klass.table_exists?
    rescue StandardError
      false
    end

    def describe(klass, known_names)
      sti_parent = sti_parent_for(klass)
      parent_reflection_names = sti_parent ? sti_parent.reflect_on_all_associations.map(&:name) : []
      parent_validators = sti_parent ? sti_parent.validators : []

      fk_map = foreign_key_map(klass)
      enums = safe { klass.defined_enums } || {}
      validators = safe { klass.validators } || []

      {
        name: klass.name,
        table_name: klass.table_name,
        namespace: klass.name.include?("::") ? klass.name.split("::")[0..-2].join("::") : nil,
        group: @config.group_for(klass.name) || default_group(klass),
        file: source_file(klass),
        primary_key: Array(klass.primary_key).join(","),
        description: table_comment(klass),
        sti: sti_info(klass, sti_parent),
        attributes: sti_parent ? [] : attributes_for(klass, fk_map, enums, validators),
        associations: klass.reflect_on_all_associations
                           .reject { |r| parent_reflection_names.include?(r.name) }
                           .map { |r| association_for(klass, r, known_names) },
        enums: sti_parent ? own_enums(klass, sti_parent) : enums,
        validations: (validators - parent_validators).map { |v| validator_for(v) },
        custom_validations: custom_validation_methods(klass, sti_parent)
      }
    end

    def default_group(klass)
      return klass.name.split("::").first if klass.name.include?("::")

      base = klass.base_class
      base != klass ? (@config.group_for(base.name) || base.name) : nil
    rescue StandardError
      nil
    end

    def sti_parent_for(klass)
      return nil if klass.base_class == klass

      parent = klass.superclass
      parent.respond_to?(:abstract_class?) && !parent.abstract_class? ? parent : nil
    rescue StandardError
      nil
    end

    def sti_info(klass, parent)
      column = klass.inheritance_column.to_s
      has_column = safe { klass.column_names.include?(column) }
      children = klass.descendants.select { |d| d.superclass == klass && live_class?(d) }.map(&:name).sort
      return nil unless parent || (has_column && children.any?)

      {
        parent: parent&.name,
        base: klass.base_class.name,
        column: column,
        sti_name: (safe { klass.sti_name } if parent),
        children: children
      }
    end

    def foreign_key_map(klass)
      klass.reflect_on_all_associations(:belongs_to).each_with_object({}) do |r, h|
        fk = safe { r.foreign_key.to_s }
        h[fk] = r.name.to_s if fk
        h[r.foreign_type.to_s] = r.name.to_s if r.polymorphic? && r.respond_to?(:foreign_type)
      end
    end

    def attributes_for(klass, fk_map, enums, validators)
      pk = Array(klass.primary_key).map(&:to_s)
      by_attr = validators.each_with_object(Hash.new { |h, k| h[k] = [] }) do |v, h|
        v.attributes.each { |a| h[a.to_s] << validator_for(v) }
      end

      columns = klass.columns.map do |c|
        {
          name: c.name,
          type: (c.type || c.sql_type).to_s,
          sql_type: c.sql_type.to_s,
          null: c.null,
          default: serialize_default(c.default),
          limit: c.limit,
          comment: (c.comment if c.respond_to?(:comment)),
          primary_key: pk.include?(c.name),
          foreign_key: fk_map[c.name],
          inheritance: c.name == klass.inheritance_column.to_s || nil,
          enum: enums[c.name]&.keys,
          technical: @config.technical_column?(c.name),
          validations: by_attr[c.name],
          virtual: false
        }.compact
      end

      column_names = klass.column_names
      virtual = (safe { klass.attribute_types.keys } || []) - column_names
      columns + virtual.map do |name|
        type = safe { klass.attribute_types[name].type }
        {
          name: name,
          type: (type || "value").to_s,
          virtual: true,
          enum: enums[name]&.keys,
          validations: by_attr[name],
          technical: false
        }.compact
      end
    end

    def own_enums(klass, parent)
      klass.defined_enums.reject { |k, _| parent.defined_enums.key?(k) }
    rescue StandardError
      {}
    end

    def association_for(klass, r, known_names)
      target = association_target(r, known_names)
      opts = r.options

      {
        name: r.name.to_s,
        macro: r.macro.to_s,
        target: target,
        class_name: (safe { r.class_name } unless r.polymorphic?),
        polymorphic: r.polymorphic? || nil,
        as: opts[:as]&.to_s,
        through: opts[:through]&.to_s,
        source: (safe { r.source_reflection&.name&.to_s } if opts[:through]),
        foreign_key: (safe { r.foreign_key.to_s } unless opts[:through]),
        foreign_type: (r.foreign_type.to_s if r.polymorphic? && r.respond_to?(:foreign_type)),
        optional: (belongs_to_optional?(klass, r) if r.macro == :belongs_to),
        dependent: opts[:dependent]&.to_s,
        inverse_of: safe { r.inverse_of&.name&.to_s },
        join_table: (safe { r.join_table.to_s } if r.macro == :has_and_belongs_to_many),
        scoped: r.scope ? true : nil,
        counter_cache: opts[:counter_cache] ? true : nil,
        error: (target.nil? && !r.polymorphic? ? unresolved_reason(r) : nil)
      }.compact
    end

    def association_target(r, known_names)
      return nil if r.polymorphic?

      name = r.klass.name
      known_names.include?(name) ? name : nil
    rescue StandardError
      nil
    end

    def unresolved_reason(r)
      r.klass
      "target model is hidden or has no table"
    rescue NameError => e
      "class not found: #{e.message.split("\n").first}"
    rescue StandardError => e
      e.message.split("\n").first
    end

    def belongs_to_optional?(klass, r)
      opts = r.options
      return !!opts[:optional] if opts.key?(:optional)
      return !opts[:required] if opts.key?(:required)

      klass.respond_to?(:belongs_to_required_by_default) ? !klass.belongs_to_required_by_default : true
    end

    # A polymorphic belongs_to (e.g. Note belongs_to :notable) can point at any
    # model that declares has_many/has_one ... as: :notable.
    def link_polymorphic_targets!(payload)
      payload.each do |model|
        model[:associations].each do |assoc|
          next unless assoc[:polymorphic]

          assoc[:targets] = payload.select do |other|
            other[:associations].any? { |a| a[:as] == assoc[:name] && a[:target] == model[:name] }
          end.map { |m| m[:name] }
        end
      end
    end

    def validator_for(v)
      kind = v.respond_to?(:kind) ? v.kind.to_s : v.class.name.demodulize.underscore.sub(/_validator\z/, "")
      options = v.options.each_with_object({}) do |(key, value), h|
        next if %i[if unless].include?(key)

        h[key] = serialize_option(value)
      end.compact

      {
        kind: kind,
        attributes: v.respond_to?(:attributes) ? v.attributes.map(&:to_s) : [],
        options: options,
        conditional: (v.options.key?(:if) || v.options.key?(:unless)) || nil
      }.compact
    end

    def custom_validation_methods(klass, parent)
      return [] unless klass.respond_to?(:_validate_callbacks)

      own = klass._validate_callbacks.map(&:filter).select { |f| f.is_a?(Symbol) }.map(&:to_s)
      inherited = parent ? parent._validate_callbacks.map(&:filter).select { |f| f.is_a?(Symbol) }.map(&:to_s) : []
      (own - inherited).reject { |m| m.start_with?("validate_associated_records_for_") }.uniq
    rescue StandardError
      []
    end

    def serialize_option(value)
      case value
      when *SAFE_OPTION_TYPES then value
      when Regexp then value.inspect
      when Range then "#{value.first}..#{value.last}"
      when Array then value.map { |v| serialize_option(v) }
      when Hash then value.transform_values { |v| serialize_option(v) }
      end
    end

    def serialize_default(value)
      SAFE_OPTION_TYPES.include?(value.class) ? value : value&.to_s
    end

    def table_comment(klass)
      conn = klass.connection
      return nil unless conn.respond_to?(:supports_comments?) && conn.supports_comments?

      conn.table_comment(klass.table_name)
    rescue StandardError
      nil
    end

    def source_file(klass)
      file, = Object.const_source_location(klass.name) if Object.respond_to?(:const_source_location)
      return nil unless file

      root = defined?(Rails) && Rails.respond_to?(:root) && Rails.root ? Rails.root.to_s + "/" : nil
      root && file.start_with?(root) ? file.delete_prefix(root) : File.basename(file)
    rescue StandardError
      nil
    end

    def group_colors(payload)
      colors = @config.group_colors.dup
      palette = Configuration::DEFAULT_PALETTE
      # Hash the name so a group keeps its color when other groups come and go.
      payload.map { |m| m[:group] }.compact.uniq.each do |g|
        colors[g] ||= palette[Digest::MD5.hexdigest(g).to_i(16) % palette.size]
      end
      colors
    end

    def safe
      yield
    rescue StandardError
      nil
    end
  end
end
