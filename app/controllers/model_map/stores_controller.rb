module ModelMap
  class StoresController < ApplicationController
    def show
      response.headers["Cache-Control"] = "no-store"
      render json: Store.new.read
    end

    def update
      unless ModelMap.config.allow_writes?
        return render json: { error: "Saving is turned off in this environment. Download the layout and commit it instead." },
                      status: :forbidden
      end

      data = JSON.parse(request.raw_post.presence || "{}")
      render json: Store.new.write(data)
    rescue JSON::ParserError
      render json: { error: "Request body is not valid JSON" }, status: :bad_request
    rescue Store::InvalidPayload => e
      render json: { error: e.message }, status: :unprocessable_entity
    end
  end
end
