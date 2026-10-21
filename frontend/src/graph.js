// Turns the introspected schema into graph primitives: one entry per model and
// one deduplicated edge per relationship (a has_many and its belongs_to are the
// same line on the map).

export const EDGE_KINDS = {
  oneToMany: "one-to-many",
  oneToOne: "one-to-one",
  manyToMany: "many-to-many",
  polymorphic: "polymorphic",
  through: "through",
  inherits: "inherits",
};

export function humanize(name) {
  if (!name) return "";
  const base = name.split("::").pop();
  const spaced = base
    .replace(/_id$/, "")
    .replace(/_/g, " ")
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .toLowerCase()
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const PLAIN_TYPES = {
  string: "Text",
  text: "Long text",
  integer: "Number",
  bigint: "Number",
  float: "Number",
  decimal: "Number",
  boolean: "Yes or no",
  date: "Date",
  datetime: "Date and time",
  timestamp: "Date and time",
  time: "Time",
  json: "Structured data",
  jsonb: "Structured data",
  uuid: "Identifier",
  binary: "File data",
};

export function plainType(attr) {
  if (attr.enum?.length) return `One of ${attr.enum.length} options`;
  return PLAIN_TYPES[attr.type] || humanize(attr.type);
}

export function modelMeta(store, name) {
  return (store?.models && store.models[name]) || {};
}

export function groupOf(model, store) {
  const meta = modelMeta(store, model.name);
  return meta.group !== undefined ? meta.group || null : model.group || null;
}

export function descriptionOf(model, store) {
  const meta = modelMeta(store, model.name);
  return (meta.description ?? model.description ?? "").trim();
}

export function groupColor(group, schema, store) {
  if (!group) return "var(--ungrouped)";
  return store?.groups?.[group]?.color || schema?.groups?.[group] || "var(--ungrouped)";
}

export function buildEdges(models) {
  const byName = new Map(models.map((m) => [m.name, m]));
  const edges = new Map();

  const add = (key, edge) => {
    const existing = edges.get(key);
    if (existing) {
      // Merge the two sides of the same relationship.
      edges.set(key, { ...existing, ...Object.fromEntries(Object.entries(edge).filter(([, v]) => v != null)) });
    } else {
      edges.set(key, { id: key, ...edge });
    }
  };

  for (const m of models) {
    for (const a of m.associations || []) {
      if (a.macro === "belongs_to") {
        const parents = a.polymorphic ? a.targets || [] : a.target ? [a.target] : [];
        for (const parent of parents) {
          if (!byName.has(parent)) continue;
          const parentAssoc = (byName.get(parent).associations || []).find(
            (pa) => (pa.macro === "has_many" || pa.macro === "has_one") && !pa.through && pa.target === m.name && pa.foreign_key === a.foreign_key
          );
          add(`${parent}>${m.name}:${a.foreign_key}`, {
            source: parent,
            target: m.name,
            kind: a.polymorphic ? EDGE_KINDS.polymorphic : parentAssoc?.macro === "has_one" ? EDGE_KINDS.oneToOne : EDGE_KINDS.oneToMany,
            childAssoc: a.name,
            parentAssoc: parentAssoc?.name,
            parentMacro: parentAssoc?.macro,
            foreignKey: a.foreign_key,
            optional: !!a.optional,
            polymorphicAs: a.polymorphic ? a.name : null,
          });
        }
      } else if ((a.macro === "has_many" || a.macro === "has_one") && !a.through) {
        if (!a.target || !byName.has(a.target)) continue;
        add(`${m.name}>${a.target}:${a.foreign_key}`, {
          source: m.name,
          target: a.target,
          kind: a.as ? EDGE_KINDS.polymorphic : a.macro === "has_one" ? EDGE_KINDS.oneToOne : EDGE_KINDS.oneToMany,
          parentAssoc: a.name,
          parentMacro: a.macro,
          foreignKey: a.foreign_key,
          polymorphicAs: a.as || null,
        });
      } else if (a.macro === "has_and_belongs_to_many") {
        if (!a.target || !byName.has(a.target)) continue;
        const pair = [m.name, a.target].sort();
        add(`${pair[0]}<>${pair[1]}:${a.join_table}`, {
          source: pair[0],
          target: pair[1],
          kind: EDGE_KINDS.manyToMany,
          parentAssoc: pair[0] === m.name ? a.name : undefined,
          childAssoc: pair[1] === m.name ? a.name : undefined,
          joinTable: a.join_table,
        });
      } else if (a.through) {
        if (!a.target || !byName.has(a.target)) continue;
        add(`${m.name}~${a.target}:${a.name}`, {
          source: m.name,
          target: a.target,
          kind: EDGE_KINDS.through,
          parentAssoc: a.name,
          parentMacro: a.macro,
          through: a.through,
        });
      }
    }

    if (m.sti?.parent && byName.has(m.sti.parent)) {
      add(`${m.name}^${m.sti.parent}`, { source: m.name, target: m.sti.parent, kind: EDGE_KINDS.inherits });
    }
  }

  // Number parallel edges between the same pair so they can be drawn apart.
  const pairs = new Map();
  for (const e of edges.values()) {
    const key = [e.source, e.target].sort().join("|");
    if (!pairs.has(key)) pairs.set(key, []);
    pairs.get(key).push(e);
  }
  for (const list of pairs.values()) {
    list.forEach((e, i) => {
      e.parallelIndex = i;
      e.parallelCount = list.length;
    });
  }

  return [...edges.values()];
}

export function edgeLabel(edge, plain, byName) {
  const parentName = plain ? humanize(edge.source) : edge.source;
  switch (edge.kind) {
    case EDGE_KINDS.inherits:
      return plain ? `is a kind of ${humanize(edge.target)}` : "inherits";
    case EDGE_KINDS.manyToMany:
      return plain ? "many to many" : `habtm via ${edge.joinTable}`;
    case EDGE_KINDS.through:
      return plain
        ? `reaches ${humanize(edge.parentAssoc)} through ${humanize(edge.through).toLowerCase()}`
        : `${edge.parentAssoc} through ${edge.through}`;
    default: {
      const macro = edge.kind === EDGE_KINDS.oneToOne ? "has one" : "has many";
      if (plain) {
        const fallback = humanize(edge.target) + (edge.kind === EDGE_KINDS.oneToOne ? "" : "s");
        return `${parentName} ${macro} ${humanize(edge.parentAssoc || fallback).toLowerCase()}`;
      }
      const name = edge.parentAssoc || edge.childAssoc;
      const parts = [edge.parentAssoc ? `${edge.parentMacro || macro.replace(" ", "_")} :${edge.parentAssoc}` : `belongs_to :${edge.childAssoc}`];
      if (edge.polymorphicAs) parts.push(`as :${edge.polymorphicAs}`);
      return name ? parts.join(" ") : macro;
    }
  }
}

export function neighborsOf(name, edges, depth = 1, { includeThrough = true } = {}) {
  const result = new Set([name]);
  let frontier = new Set([name]);
  for (let d = 0; d < depth; d++) {
    const next = new Set();
    for (const e of edges) {
      if (!includeThrough && e.kind === EDGE_KINDS.through) continue;
      if (frontier.has(e.source) && !result.has(e.target)) next.add(e.target);
      if (frontier.has(e.target) && !result.has(e.source)) next.add(e.source);
    }
    next.forEach((n) => result.add(n));
    frontier = next;
  }
  return result;
}

// Compare two schemas to say what changed when live polling picks up a reload.
export function diffSchemas(before, after) {
  if (!before) return { added: [], removed: [], changed: [] };
  const prev = new Map(before.models.map((m) => [m.name, JSON.stringify(m)]));
  const next = new Map(after.models.map((m) => [m.name, JSON.stringify(m)]));
  const added = [...next.keys()].filter((k) => !prev.has(k));
  const removed = [...prev.keys()].filter((k) => !next.has(k));
  const changed = [...next.keys()].filter((k) => prev.has(k) && prev.get(k) !== next.get(k));
  return { added, removed, changed };
}

export function visibleAttributes(model, plain) {
  const attrs = model.attributes || [];
  return plain ? attrs.filter((a) => !a.technical) : attrs;
}

// Rows shown for STI children, which share their parent's table: list only
// what the subclass adds.
const PLAIN_VALIDATIONS = {
  presence: "Required",
  uniqueness: "Must be unique",
  inclusion: "Must be one of the allowed values",
  exclusion: "Cannot be certain values",
  length: "Has a length limit",
  format: "Must match a pattern",
  numericality: "Must be a number",
  confirmation: "Must be confirmed",
  acceptance: "Must be accepted",
};

export function stiExtras(model, plain = false) {
  const rows = [];
  for (const a of model.associations || []) {
    const macro = a.macro.replace(/_/g, " ").replace("and belongs to many", "many");
    rows.push({
      key: `a:${a.name}`,
      label: a.name,
      detail: plain ? `${macro.charAt(0).toUpperCase()}${macro.slice(1)}` : `${a.macro}${a.target ? ` ${a.target}` : ""}`,
    });
  }
  for (const v of model.validations || []) {
    rows.push({
      key: `v:${v.kind}:${v.attributes.join()}`,
      label: v.attributes.join(", "),
      detail: plain
        ? `${PLAIN_VALIDATIONS[v.kind] || humanize(v.kind)}${v.conditional ? " sometimes" : ""}`
        : `validates ${v.kind}${v.conditional ? " (conditional)" : ""}`,
    });
  }
  for (const name of Object.keys(model.enums || {})) {
    rows.push({ key: `e:${name}`, label: name, detail: plain ? "One of a set of options" : "enum" });
  }
  for (const name of model.custom_validations || []) {
    rows.push({ key: `c:${name}`, label: name, detail: plain ? "Custom rule" : "validate" });
  }
  return rows;
}
