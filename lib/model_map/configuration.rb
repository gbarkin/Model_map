module ModelMap
  class Configuration
    # Models from these namespaces are hidden unless `include_framework_models`
    # is true or the model is listed in `include`.
    FRAMEWORK_PREFIXES = %w[
      ActiveStorage:: ActionText:: ActionMailbox:: ActiveRecord::
      SolidQueue:: SolidCache:: SolidCable:: GoodJob:: Delayed::
      PaperTrail:: Audited:: Ahoy:: Blazer:: Flipper:: Doorkeeper::
    ].freeze

    DEFAULT_PALETTE = %w[#2F7F7A #B5832A #7A4E7E #A8473A #3A5A8C #6B7A3A #8A5A3B #4F6D7A].freeze

    GroupRule = Struct.new(:name, :matchers, :color) do
      def match?(model_name)
        matchers.any? do |m|
          case m
          when Regexp then m.match?(model_name)
          when Proc   then m.call(model_name)
          else
            pattern = m.to_s
            if pattern.end_with?("*")
              model_name.start_with?(pattern.chomp("*"))
            else
              model_name == pattern
            end
          end
        end
      end
    end

    # nil means "decide from Rails.env" (see the predicate methods below).
    attr_writer :enabled, :allow_writes, :store_path, :title

    # Class name the engine's controllers inherit from. Set to
    # "ApplicationController" (or an admin base controller) to reuse the host
    # app's authentication and authorization before_actions.
    attr_accessor :parent_controller

    # A block run with instance_exec inside the engine's controller before every
    # request. Call head/redirect_to in it to deny access.
    #   config.authenticate = -> { head :forbidden unless current_user&.admin? }
    attr_accessor :authenticate

    # [username, password] for HTTP Basic auth. Handy for staging.
    attr_accessor :basic_auth

    # Strings ("Foo", "Legacy::*"), regexes, or procs naming models to hide or force-show.
    attr_accessor :exclude, :include

    attr_accessor :include_framework_models

    # Columns hidden in plain-language view. Strings or regexes.
    attr_accessor :technical_columns

    # Browser polling interval for live updates, in milliseconds. 0 disables polling.
    attr_accessor :poll_interval

    # Environments where the engine responds. Ignored when `enabled` is set explicitly.
    attr_accessor :enabled_environments

    attr_reader :group_rules

    def initialize
      @enabled = nil
      @allow_writes = nil
      @store_path = nil
      @title = nil
      @parent_controller = "ActionController::Base"
      @authenticate = nil
      @basic_auth = nil
      @exclude = []
      @include = []
      @include_framework_models = false
      @technical_columns = ["id", "created_at", "updated_at", /_id\z/, /_type\z/, "type", "lock_version"]
      @poll_interval = 2500
      @enabled_environments = %w[development staging test]
      @group_rules = []
    end

    # Assign models to a named group without touching model files.
    #   config.group "Case intake", "Case", "Person", /\AIntake::/, color: "#3A5A8C"
    def group(name, *matchers, color: nil)
      @group_rules << GroupRule.new(name.to_s, matchers.flatten, color)
      self
    end

    def group_for(model_name)
      rule = @group_rules.find { |r| r.match?(model_name) }
      rule&.name
    end

    def group_colors
      @group_rules.each_with_object({}) { |r, h| h[r.name] = r.color if r.color }
    end

    def enabled?
      return @enabled unless @enabled.nil?

      env = current_env
      env.nil? || enabled_environments.map(&:to_s).include?(env)
    end

    def allow_writes?
      return @allow_writes unless @allow_writes.nil?

      %w[development test].include?(current_env)
    end

    def store_path
      return @store_path.to_s if @store_path

      base = defined?(Rails) && Rails.respond_to?(:root) && Rails.root ? Rails.root : Dir.pwd
      File.join(base.to_s, "config", "model_map.json")
    end

    def title
      @title || default_title
    end

    def framework_model?(name)
      FRAMEWORK_PREFIXES.any? { |p| name.start_with?(p) } || name.start_with?("HABTM_") || name.include?("::HABTM_")
    end

    def matches_any?(list, name)
      Array(list).any? do |m|
        case m
        when Regexp then m.match?(name)
        when Proc   then m.call(name)
        else
          s = m.to_s
          s.end_with?("*") ? name.start_with?(s.chomp("*")) : name == s
        end
      end
    end

    def technical_column?(name)
      matches_any?(technical_columns, name)
    end

    private

    def current_env
      defined?(Rails) && Rails.respond_to?(:env) ? Rails.env.to_s : nil
    end

    def default_title
      if defined?(Rails) && Rails.respond_to?(:application) && Rails.application
        app_class = Rails.application.class
        parent = app_class.respond_to?(:module_parent) ? app_class.module_parent : app_class.name.split("::").first
        parent.to_s.gsub(/([a-z])([A-Z])/, '\1 \2')
      else
        "Model map"
      end
    end
  end
end
