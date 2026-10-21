require "json"
require "fileutils"

module ModelMap
  # Presentation state saved to a JSON file in the host repo (default
  # config/model_map.json): node positions, groups, plain-language
  # descriptions, and tours. Commit it so the whole team shares one layout.
  class Store
    MAX_BYTES = 2 * 1024 * 1024
    TOP_LEVEL_KEYS = %w[version positions models groups tours settings].freeze

    class InvalidPayload < ModelMap::Error; end

    def initialize(path = ModelMap.config.store_path)
      @path = path.to_s
    end

    attr_reader :path

    def read
      return empty unless File.exist?(@path)

      data = JSON.parse(File.read(@path))
      data.is_a?(Hash) ? empty.merge(data.slice(*TOP_LEVEL_KEYS)) : empty
    rescue JSON::ParserError => e
      empty.merge("error" => "#{File.basename(@path)} is not valid JSON: #{e.message.lines.first&.strip}")
    end

    def write(data)
      data = validate!(data)
      json = JSON.pretty_generate(data) + "\n"
      raise InvalidPayload, "layout file would exceed #{MAX_BYTES / 1024} KB" if json.bytesize > MAX_BYTES

      FileUtils.mkdir_p(File.dirname(@path))
      tmp = "#{@path}.tmp-#{Process.pid}"
      File.write(tmp, json)
      File.rename(tmp, @path)
      data
    ensure
      File.delete(tmp) if tmp && File.exist?(tmp)
    end

    def empty
      { "version" => 1, "positions" => {}, "models" => {}, "groups" => {}, "tours" => [], "settings" => {} }
    end

    private

    def validate!(data)
      data = data.to_unsafe_h if data.respond_to?(:to_unsafe_h)
      data = JSON.parse(JSON.generate(data)) # normalize keys to strings, drop non-JSON values
      raise InvalidPayload, "expected a JSON object" unless data.is_a?(Hash)

      unknown = data.keys - TOP_LEVEL_KEYS
      raise InvalidPayload, "unknown keys: #{unknown.join(", ")}" if unknown.any?

      %w[positions models groups settings].each do |key|
        next unless data.key?(key)
        raise InvalidPayload, "#{key} must be an object" unless data[key].is_a?(Hash)
      end
      raise InvalidPayload, "tours must be an array" if data.key?("tours") && !data["tours"].is_a?(Array)

      positions = data["positions"] || {}
      positions.each do |name, pos|
        valid = pos.is_a?(Hash) && pos["x"].is_a?(Numeric) && pos["y"].is_a?(Numeric)
        raise InvalidPayload, "position for #{name} needs numeric x and y" unless valid
      end

      empty.merge(data).merge("version" => 1)
    end
  end
end
