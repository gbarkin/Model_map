ENV["RAILS_ENV"] = "test"
require_relative "dummy/config/environment"
require "rails/test_help"
require "minitest/autorun"

ActiveRecord::Schema.verbose = false
load File.expand_path("dummy/db/schema.rb", __dir__)

module ModelMapTestHelpers
  def schema
    @schema ||= ModelMap::Introspector.new.call
  end

  def model(name)
    schema[:models].find { |m| m[:name] == name } || flunk("#{name} not in schema")
  end

  def assoc(model_name, assoc_name)
    model(model_name)[:associations].find { |a| a[:name] == assoc_name } || flunk("#{model_name}##{assoc_name} missing")
  end
end
