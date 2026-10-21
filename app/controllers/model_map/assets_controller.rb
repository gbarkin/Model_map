module ModelMap
  # Serves the prebuilt frontend from the gem's dist/ directory. This avoids
  # depending on the host's asset pipeline (Sprockets, Propshaft, importmap,
  # jsbundling all work the same).
  class AssetsController < ApplicationController
    TYPES = {
      ".js" => "text/javascript",
      ".css" => "text/css",
      ".woff2" => "font/woff2",
      ".woff" => "font/woff",
      ".map" => "application/json",
      ".svg" => "image/svg+xml"
    }.freeze

    skip_forgery_protection

    def show
      name = File.basename(params[:file].to_s)
      path = File.expand_path(ModelMap.dist_path("app", name))
      ext = File.extname(name)

      unless TYPES.key?(ext) && path.start_with?(File.expand_path(ModelMap.dist_path("app")) + "/") && File.file?(path)
        return head :not_found
      end

      # Hashed chunk names never change; the entry files can.
      response.headers["Cache-Control"] =
        name.match?(/-[A-Za-z0-9_-]{8,}\./) ? "private, max-age=31536000, immutable" : "no-cache"
      send_file path, type: TYPES[ext], disposition: "inline"
    end
  end
end
