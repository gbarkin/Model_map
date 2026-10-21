require "model_map/version"

module ModelMap
  class Error < StandardError; end
end

require "model_map/configuration"
require "model_map/introspector"
require "model_map/store"
require "model_map/static_export"
require "model_map/engine" if defined?(Rails::Railtie)

module ModelMap
  class << self
    def config
      @config ||= Configuration.new
    end

    def configure
      yield config
    end

    def reset_config!
      @config = Configuration.new
    end

    # Root of the installed gem (used to locate the prebuilt frontend in dist/).
    def root
      @root ||= File.expand_path("..", __dir__)
    end

    def dist_path(*parts)
      File.join(root, "dist", *parts)
    end
  end
end
