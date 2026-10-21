module ModelMap
  class MapsController < ApplicationController
    def show
      @bootstrap = {
        mode: "live",
        title: ModelMap.config.title,
        version: ModelMap::VERSION,
        writable: ModelMap.config.allow_writes?,
        pollInterval: ModelMap.config.poll_interval.to_i,
        storePath: relative_store_path,
        csrfToken: form_authenticity_token,
        endpoints: {
          schema: schema_path,
          fingerprint: fingerprint_path,
          store: store_path,
          export: export_path
        }
      }
      render :show
    end

    def schema
      render json: Introspector.cached
    rescue StandardError => e
      render json: { error: "#{e.class}: #{e.message}" }, status: :internal_server_error
    end

    def fingerprint
      response.headers["Cache-Control"] = "no-store"
      render json: { fingerprint: Introspector.cached[:fingerprint] }
    rescue StandardError => e
      render json: { error: "#{e.class}: #{e.message}" }, status: :internal_server_error
    end

    # Offline copy: one HTML file with the app, schema, and layout inlined.
    def export
      html = StaticExport.new.render
      filename = "#{ModelMap.config.title.parameterize.presence || "model-map"}-model-map.html"
      send_data html, filename: filename, type: "text/html", disposition: "attachment"
    rescue StaticExport::MissingBundle => e
      render plain: e.message, status: :not_found
    end

    private

    def relative_store_path
      path = ModelMap.config.store_path
      root = Rails.root.to_s + "/"
      path.start_with?(root) ? path.delete_prefix(root) : path
    end
  end
end
