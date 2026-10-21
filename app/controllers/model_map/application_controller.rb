module ModelMap
  # Inherits from ModelMap.config.parent_controller (ActionController::Base by
  # default). Point it at the host's ApplicationController to reuse its auth.
  class ApplicationController < ModelMap.config.parent_controller.constantize
    protect_from_forgery with: :exception

    before_action :model_map_ensure_enabled!
    before_action :model_map_basic_auth!
    before_action :model_map_authenticate!

    layout false

    private

    def model_map_ensure_enabled!
      head :not_found unless ModelMap.config.enabled?
    end

    def model_map_basic_auth!
      user, pass = ModelMap.config.basic_auth
      return if user.nil?

      authenticate_or_request_with_http_basic("Model map") do |u, p|
        ActiveSupport::SecurityUtils.secure_compare(u.to_s, user.to_s) &
          ActiveSupport::SecurityUtils.secure_compare(p.to_s, pass.to_s)
      end
    end

    def model_map_authenticate!
      hook = ModelMap.config.authenticate
      instance_exec(&hook) if hook
    end
  end
end
