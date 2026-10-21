require "rails"

module ModelMap
  class Engine < ::Rails::Engine
    isolate_namespace ModelMap

    rake_tasks do
      load File.expand_path("../tasks/model_map.rake", __dir__)
    end

    # Every code reload in development invalidates the cached introspection so
    # the browser sees model changes on its next poll.
    config.to_prepare do
      ModelMap::Introspector.invalidate!
    end
  end
end
