require "rails/generators"

module ModelMap
  module Generators
    class InstallGenerator < Rails::Generators::Base
      source_root File.expand_path("templates", __dir__)
      desc "Adds a model_map initializer and mounts the engine at /model_map"

      class_option :path, type: :string, default: "/model_map", desc: "Mount path"

      def copy_initializer
        template "model_map.rb", "config/initializers/model_map.rb"
      end

      def mount_engine
        route %(mount ModelMap::Engine => "#{options[:path]}" if defined?(ModelMap::Engine))
      end

      def show_next_steps
        say <<~MSG

          model_map installed. Start the server and open #{options[:path]}.
          Layout, groups, descriptions, and tours save to config/model_map.json; commit that file.
        MSG
      end
    end
  end
end
