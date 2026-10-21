require "test_helper"
require "tmpdir"

class EngineTest < ActionDispatch::IntegrationTest
  setup do
    @dir = Dir.mktmpdir
    ModelMap.config.store_path = File.join(@dir, "model_map.json")
    ModelMap::Introspector.invalidate!
  end

  teardown do
    FileUtils.remove_entry(@dir)
    ModelMap.config.store_path = nil
    ModelMap.config.enabled = nil
    ModelMap.config.allow_writes = nil
    ModelMap.config.authenticate = nil
    ModelMap.config.basic_auth = nil
  end

  test "serves the app shell with bootstrap config and asset links" do
    get "/model_map"
    assert_response :success
    assert_includes response.body, 'id="model-map-bootstrap"'
    assert_includes response.body, "/model_map/assets/model_map.js"
    bootstrap = JSON.parse(response.body[%r{<script id="model-map-bootstrap" type="application/json">(.*?)</script>}m, 1])
    assert_equal "/model_map/schema", bootstrap["endpoints"]["schema"]
    assert_equal true, bootstrap["writable"]
  end

  test "serves the schema and a fingerprint" do
    get "/model_map/schema"
    assert_response :success
    body = JSON.parse(response.body)
    assert(body["models"].any? { |m| m["name"] == "Case" })

    get "/model_map/fingerprint"
    assert_equal body["fingerprint"], JSON.parse(response.body)["fingerprint"]
  end

  test "saves and reads the layout store" do
    put "/model_map/store", params: { positions: { "Case" => { x: 1, y: 2 } } }.to_json,
                            headers: { "CONTENT_TYPE" => "application/json" }
    assert_response :success
    get "/model_map/store"
    assert_equal 2, JSON.parse(response.body)["positions"]["Case"]["y"]
  end

  test "refuses writes when writes are turned off" do
    ModelMap.config.allow_writes = false
    put "/model_map/store", params: "{}", headers: { "CONTENT_TYPE" => "application/json" }
    assert_response :forbidden
    assert_match(/turned off/, JSON.parse(response.body)["error"])
  end

  test "requires a CSRF token for writes when forgery protection is on" do
    ActionController::Base.allow_forgery_protection = true
    put "/model_map/store", params: "{}", headers: { "CONTENT_TYPE" => "application/json" }
    assert_includes [403, 422], response.status
  ensure
    ActionController::Base.allow_forgery_protection = false
  end

  test "rejects invalid layout payloads" do
    put "/model_map/store", params: { nope: 1 }.to_json, headers: { "CONTENT_TYPE" => "application/json" }
    assert_response :unprocessable_entity
  end

  test "returns 404 everywhere when disabled" do
    ModelMap.config.enabled = false
    get "/model_map"
    assert_response :not_found
    get "/model_map/schema"
    assert_response :not_found
  end

  test "runs the authenticate hook inside the controller" do
    ModelMap.config.authenticate = -> { head :forbidden unless request.headers["X-Admin"] == "yes" }
    get "/model_map/schema"
    assert_response :forbidden
    get "/model_map/schema", headers: { "X-Admin" => "yes" }
    assert_response :success
  end

  test "supports HTTP basic auth" do
    ModelMap.config.basic_auth = %w[demo secret]
    get "/model_map"
    assert_response :unauthorized
    get "/model_map", headers: {
      "HTTP_AUTHORIZATION" => ActionController::HttpAuthentication::Basic.encode_credentials("demo", "secret")
    }
    assert_response :success
  end

  test "serves only known files from the prebuilt bundle" do
    get "/model_map/assets/model_map.js"
    if File.exist?(ModelMap.dist_path("app", "model_map.js"))
      assert_response :success
      assert_equal "text/javascript", response.media_type
    else
      assert_response :not_found
    end

    get "/model_map/assets/..%2Fmodel_map.gemspec"
    assert_response :not_found
    get "/model_map/assets/secret.rb"
    assert_response :not_found
  end

  test "exports a standalone HTML copy" do
    get "/model_map/export"
    if File.exist?(ModelMap.dist_path("standalone", "model_map.standalone.js"))
      assert_response :success
      assert_includes response.body, '"mode":"static"'
      assert_match(/attachment/, response.headers["Content-Disposition"])
    else
      assert_response :not_found
    end
  end
end
