require_relative "lib/model_map/version"

Gem::Specification.new do |spec|
  spec.name        = "model_map"
  spec.version     = ModelMap::VERSION
  spec.authors     = ["George Barkin"]
  spec.summary     = "Live, interactive map of your ActiveRecord models for walking stakeholders through a data model."
  spec.description = <<~DESC
    A mountable Rails engine that introspects every ActiveRecord model at runtime
    (columns, associations, enums, validations, STI, polymorphism) and serves a
    prebuilt React Flow app. No per-model configuration required. Supports saved
    layouts, groups, plain-language descriptions, presentation tours, a 3D view,
    live updates as models change, and standalone HTML export.
  DESC
  spec.license  = "MIT"
  spec.homepage = "https://github.com/gbarkin/model_map"
  spec.required_ruby_version = ">= 2.7"

  spec.files = Dir[
    "app/**/*", "config/**/*", "lib/**/*", "dist/**/*",
    "README.md", "LICENSE.txt", "CHANGELOG.md"
  ]
  spec.require_paths = ["lib"]

  spec.add_dependency "actionpack",   ">= 6.1"
  spec.add_dependency "activerecord", ">= 6.1"
  spec.add_dependency "railties",     ">= 6.1"

  spec.metadata["rubygems_mfa_required"] = "true"
end
