require "test_helper"
require "tmpdir"

class StoreTest < ActiveSupport::TestCase
  setup do
    @dir = Dir.mktmpdir
    @store = ModelMap::Store.new(File.join(@dir, "config", "model_map.json"))
  end

  teardown { FileUtils.remove_entry(@dir) }

  test "reads an empty store when the file is missing" do
    data = @store.read
    assert_equal({}, data["positions"])
    assert_equal [], data["tours"]
  end

  test "round-trips positions, model metadata, and tours" do
    @store.write(
      "positions" => { "Case" => { "x" => 10, "y" => 20.5 } },
      "models" => { "Case" => { "description" => "One filing by one person", "group" => "Cases" } },
      "tours" => [{ "name" => "Intro", "steps" => [{ "title" => "Cases", "focus" => ["Case"] }] }]
    )
    data = @store.read
    assert_equal 20.5, data["positions"]["Case"]["y"]
    assert_equal "One filing by one person", data["models"]["Case"]["description"]
    assert_equal "Intro", data["tours"].first["name"]
    assert File.read(@store.path).end_with?("\n")
  end

  test "rejects unknown keys and malformed positions" do
    assert_raises(ModelMap::Store::InvalidPayload) { @store.write("evil" => 1) }
    assert_raises(ModelMap::Store::InvalidPayload) { @store.write("positions" => { "Case" => { "x" => "1" } }) }
    assert_raises(ModelMap::Store::InvalidPayload) { @store.write("tours" => {}) }
  end

  test "reports a corrupt file instead of raising" do
    FileUtils.mkdir_p(File.dirname(@store.path))
    File.write(@store.path, "{not json")
    assert_match(/not valid JSON/, @store.read["error"])
  end
end
