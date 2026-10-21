require "rails"
require "active_record/railtie"
require "action_controller/railtie"
require "action_view/railtie"

$LOAD_PATH.unshift File.expand_path("../../../lib", __dir__)
require "model_map"

module CaseManagement
  class Application < Rails::Application
    config.root = File.expand_path("..", __dir__)
    config.load_defaults Rails::VERSION::STRING.to_f
    config.eager_load = false
    config.cache_classes = false if config.respond_to?(:cache_classes=) && !Rails.env.test?
    config.secret_key_base = "dummy-secret-key-base-for-model-map-tests-only"
    config.hosts.clear if config.respond_to?(:hosts)
    config.logger = Logger.new(File.expand_path("../log/#{Rails.env}.log", __dir__))
    config.log_level = :warn
    config.active_support.deprecation = :silence
    config.action_controller.allow_forgery_protection = false if Rails.env.test?
  end
end
