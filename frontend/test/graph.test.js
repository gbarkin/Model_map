import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildEdges, diffSchemas, edgeLabel, humanize, neighborsOf } from "../src/graph.js";

const schema = JSON.parse(readFileSync(new URL("../dev/schema.json", import.meta.url)));
const edges = buildEdges(schema.models);
const find = (pred) => edges.filter(pred);

test("a has_many and its belongs_to become one edge", () => {
  const caseToChecks = find((e) => e.source === "Case" && e.target === "VettingCheck");
  assert.equal(caseToChecks.length, 1);
  assert.equal(caseToChecks[0].parentAssoc, "vetting_checks");
  assert.equal(caseToChecks[0].childAssoc, "case");
  assert.equal(caseToChecks[0].kind, "one-to-many");
});

test("two foreign keys to the same parent stay separate and are numbered", () => {
  const toRelationship = find((e) => e.source === "Person" && e.target === "Relationship");
  assert.equal(toRelationship.length, 2);
  assert.deepEqual(toRelationship.map((e) => e.parallelIndex).sort(), [0, 1]);
});

test("polymorphic belongs_to draws an edge from each possible parent", () => {
  const parents = find((e) => e.target === "Note" && e.kind === "polymorphic").map((e) => e.source).sort();
  assert.deepEqual(parents, ["Case", "Person"]);
});

test("habtm is a single many-to-many edge", () => {
  const habtm = find((e) => e.kind === "many-to-many");
  assert.equal(habtm.length, 1);
  assert.deepEqual([habtm[0].source, habtm[0].target], ["Case", "Tag"]);
});

test("STI children point at their parent", () => {
  const inherits = find((e) => e.kind === "inherits").map((e) => `${e.source}>${e.target}`).sort();
  assert.deepEqual(inherits, ["AsylumCase>Case", "BiometricCheck>VettingCheck", "NameCheck>VettingCheck", "RefugeeCase>Case"]);
});

test("optional belongs_to is marked", () => {
  const officer = find((e) => e.source === "User" && e.target === "Case")[0];
  assert.equal(officer.optional, true);
});

test("labels read naturally in both modes", () => {
  const e = find((x) => x.source === "Case" && x.target === "VettingCheck")[0];
  assert.equal(edgeLabel(e, false), "has_many :vetting_checks");
  assert.equal(edgeLabel(e, true), "Case has many vetting checks");
  assert.equal(humanize("ReferralEvent"), "Referral event");
  assert.equal(humanize("assigned_officer_id"), "Assigned officer");
});

test("neighbors include both directions", () => {
  const n = neighborsOf("Referral", edges);
  for (const name of ["Referral", "Case", "User", "ReferralEvent"]) assert.ok(n.has(name), name);
  assert.ok(!n.has("Address"));
});

test("schema diff reports added, removed, and changed models", () => {
  const next = structuredClone(schema);
  next.models = next.models.filter((m) => m.name !== "Tag");
  next.models.find((m) => m.name === "Case").table_name = "case_files";
  next.models.push({ name: "Appeal2", associations: [], attributes: [] });
  const d = diffSchemas(schema, next);
  assert.deepEqual(d.added, ["Appeal2"]);
  assert.deepEqual(d.removed, ["Tag"]);
  assert.deepEqual(d.changed, ["Case"]);
});
