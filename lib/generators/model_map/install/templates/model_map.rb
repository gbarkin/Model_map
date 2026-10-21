# model_map: live, interactive map of your ActiveRecord models.
# Every model is discovered automatically; nothing goes in model files.
return unless defined?(ModelMap)

ModelMap.configure do |config|
  # Environments where /model_map responds (default: development, staging, test).
  # config.enabled_environments = %w[development staging]
  # Or force it: config.enabled = ENV["MODEL_MAP_ENABLED"] == "true"

  # Saving layouts from the browser. Default: development and test only.
  # Elsewhere, use "Download layout" in the UI and commit the file.
  # config.allow_writes = Rails.env.development?

  # Reuse your app's authentication by inheriting from your controller...
  # config.parent_controller = "ApplicationController"
  # ...or gate it with a block run inside the controller...
  # config.authenticate = -> { head :forbidden unless current_user&.admin? }
  # ...or use HTTP Basic (handy on staging).
  # config.basic_auth = [ENV["MODEL_MAP_USER"], ENV["MODEL_MAP_PASSWORD"]] if ENV["MODEL_MAP_USER"]

  # Group models by name without touching them. Strings, "Prefix*" globs, or regexes.
  # config.group "Case intake", "Case", "Person", "Intake::*", color: "#3A5A8C"
  # config.group "Vetting", /\AVetting/

  # Hide or force-show models.
  # config.exclude = ["LegacyImport", /\AArchive::/]
  # config.include = ["PaperTrail::Version"]

  # Columns hidden in plain-language view.
  # config.technical_columns += ["tenant_id"]

  # Browser polling for live updates, in ms. 0 turns it off.
  # config.poll_interval = 2500

  # config.title = "Case management"
  # config.store_path = Rails.root.join("config/model_map.json")
end
