require "json"
require "erb"

module ModelMap
  # Renders a single self-contained HTML file: app bundle, current schema, and
  # saved layout inlined. Opens from disk with no server, for presenting
  # offline or sharing a snapshot.
  class StaticExport
    class MissingBundle < ModelMap::Error; end

    def initialize(schema: nil, store: nil, config: ModelMap.config)
      @config = config
      @schema = schema
      @store = store
    end

    def render
      js_path = ModelMap.dist_path("standalone", "model_map.standalone.js")
      css_path = ModelMap.dist_path("standalone", "model_map.standalone.css")
      raise MissingBundle, "Standalone bundle not found at #{js_path}. Run bin/build-frontend." unless File.exist?(js_path)

      schema = @schema || Introspector.new(@config).call
      store = @store || Store.new(@config.store_path).read
      bootstrap = {
        mode: "static",
        title: @config.title,
        version: ModelMap::VERSION,
        writable: false,
        pollInterval: 0,
        exportedAt: Time.now.utc.iso8601,
        schema: schema,
        store: store
      }

      css = File.exist?(css_path) ? File.read(css_path) : ""
      js = File.read(js_path)

      <<~HTML
        <!doctype html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>#{ERB::Util.html_escape(@config.title)} · Model map</title>
          <style>#{css}</style>
          <script id="model-map-bootstrap" type="application/json">#{ERB::Util.json_escape(JSON.generate(bootstrap))}</script>
        </head>
        <body>
          <div id="model-map-root"></div>
          <script type="module">#{js.gsub("</script", "<\\/script")}</script>
        </body>
        </html>
      HTML
    end
  end
end
