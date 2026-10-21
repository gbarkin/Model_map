require "test_helper"

class IntrospectorTest < ActiveSupport::TestCase
  include ModelMapTestHelpers

  test "discovers every model with no per-model setup" do
    names = schema[:models].map { |m| m[:name] }
    %w[Address AsylumCase BiometricCheck Case Document Interview NameCheck Note Person
       Referral ReferralEvent RefugeeCase Relationship Tag User VettingCheck].each do |n|
      assert_includes names, n
    end
  end

  test "skips abstract classes, excluded models, and HABTM join classes" do
    names = schema[:models].map { |m| m[:name] }
    refute_includes names, "ApplicationRecord"
    refute_includes names, "Archive::LegacyRecord"
    assert names.none? { |n| n.include?("HABTM_") }
  end

  test "describes columns with keys, nullability, enums, and validations" do
    attrs = model("Case")[:attributes].index_by { |a| a[:name] }
    assert attrs["id"][:primary_key]
    assert_equal "person", attrs["person_id"][:foreign_key]
    assert_equal %w[intake pending_review decided closed], attrs["status"][:enum]
    assert attrs["type"][:inheritance]
    refute attrs["receipt_number"][:null]
    kinds = attrs["receipt_number"][:validations].map { |v| v[:kind] }
    assert_equal %w[format presence uniqueness], kinds.sort
  end

  test "includes virtual attributes declared with attribute" do
    attr = model("Person")[:attributes].find { |a| a[:name] == "preferred_language" }
    assert attr
    assert attr[:virtual]
    assert_equal "string", attr[:type]
  end

  test "describes association macros, targets, and options" do
    a = assoc("Case", "assigned_officer")
    assert_equal "belongs_to", a[:macro]
    assert_equal "User", a[:target]
    assert a[:optional]
    refute assoc("Case", "person")[:optional]

    assert_equal "has_and_belongs_to_many", assoc("Case", "tags")[:macro]
    assert_equal "cases_tags", assoc("Case", "tags")[:join_table]
    assert_equal "destroy", assoc("Case", "vetting_checks")[:dependent]
    assert assoc("Referral", "referral_events")[:scoped]
    assert assoc("VettingCheck", "case")[:counter_cache]
  end

  test "describes has_many through with its source" do
    a = assoc("Person", "relatives")
    assert_equal "relationships", a[:through]
    assert_equal "relative", a[:source]
    assert_equal "Person", a[:target]
  end

  test "resolves polymorphic belongs_to targets from the other side's as: option" do
    assert_equal %w[Case Person], assoc("Note", "notable")[:targets]
    assert_equal %w[BiometricCheck Case Person], assoc("Document", "attachable")[:targets]
  end

  test "describes single-table inheritance" do
    sti = model("Case")[:sti]
    assert_equal %w[AsylumCase RefugeeCase], sti[:children]
    assert_nil sti[:parent]

    child = model("AsylumCase")
    assert_equal "Case", child[:sti][:parent]
    assert_empty child[:attributes], "STI children share the parent's table, so columns are not repeated"
    assert_equal ["filed_on"], child[:validations].flat_map { |v| v[:attributes] }
  end

  test "STI children list only associations they add" do
    assert_equal ["documents"], model("BiometricCheck")[:associations].map { |a| a[:name] }
  end

  test "records custom validate methods and conditional validators" do
    assert_includes model("Case")[:custom_validations], "decision_requires_officer"
    assert model("RefugeeCase")[:validations].first[:conditional]
  end

  test "assigns groups from config rules and gives each group a color" do
    assert_equal "Vetting", model("NameCheck")[:group]
    assert_equal "Referrals", model("ReferralEvent")[:group]
    assert_match(/\A#\h{6}\z/, schema[:groups]["Vetting"])
  end

  test "marks technical columns for plain-language view" do
    attrs = model("Interview")[:attributes].index_by { |a| a[:name] }
    assert attrs["created_at"][:technical]
    assert attrs["case_id"][:technical]
    refute attrs["location"][:technical]
  end

  test "fingerprint is stable across runs and changes when the schema changes" do
    a = ModelMap::Introspector.new.call[:fingerprint]
    b = ModelMap::Introspector.new.call[:fingerprint]
    assert_equal a, b

    ModelMap.config.exclude += ["Tag"]
    c = ModelMap::Introspector.new.call[:fingerprint]
    refute_equal a, c
  ensure
    ModelMap.config.exclude -= ["Tag"]
  end

  test "output is plain JSON" do
    json = JSON.generate(schema)
    assert_operator json.bytesize, :>, 1000
    assert_equal schema[:models].size, JSON.parse(json)["models"].size
  end
end
