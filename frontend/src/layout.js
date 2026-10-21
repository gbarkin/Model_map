// Auto layout with ELK's layered algorithm. Models in the same group are laid
// out inside a compound node so groups stay together on the canvas.

let elkPromise;
function getElk() {
  elkPromise ||= import("elkjs/lib/elk.bundled.js").then((mod) => new mod.default());
  return elkPromise;
}

export const NODE_WIDTH = 248;

export function estimateHeight(rowCount, { description = false, more = false } = {}) {
  return 50 + (description ? 38 : 0) + rowCount * 23 + (more ? 28 : 0) + 12;
}

export async function autoLayout({ models, edges, sizes, groupOf, direction = "RIGHT" }) {
  const elk = await getElk();
  const groups = new Map();
  const loose = [];

  for (const m of models) {
    const size = sizes[m.name] || { width: NODE_WIDTH, height: 160 };
    const node = { id: m.name, width: size.width, height: size.height };
    const g = groupOf(m);
    if (g) {
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(node);
    } else {
      loose.push(node);
    }
  }

  const ids = new Set(models.map((m) => m.name));
  const layoutEdges = edges
    .filter((e) => ids.has(e.source) && ids.has(e.target) && e.source !== e.target && e.kind !== "through")
    // Parents to the left of children reads naturally: Person, then Case, then its checks.
    .map((e) =>
      e.kind === "inherits"
        ? { id: e.id, sources: [e.target], targets: [e.source] }
        : { id: e.id, sources: [e.source], targets: [e.target] }
    );

  const graph = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": direction,
      "elk.hierarchyHandling": "INCLUDE_CHILDREN",
      "elk.spacing.nodeNode": "48",
      "elk.layered.spacing.nodeNodeBetweenLayers": "96",
      "elk.spacing.componentComponent": "80",
      "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.edgeRouting": "POLYLINE",
    },
    children: [
      ...[...groups.entries()].map(([name, children]) => ({
        id: `group:${name}`,
        layoutOptions: {
          "elk.padding": "[top=56,left=32,bottom=32,right=32]",
          "elk.spacing.nodeNode": "40",
          "elk.layered.spacing.nodeNodeBetweenLayers": "72",
        },
        children,
      })),
      ...loose,
    ],
    edges: layoutEdges,
  };

  const result = await elk.layout(graph);
  const positions = {};
  const walk = (node, ox = 0, oy = 0) => {
    for (const child of node.children || []) {
      const x = ox + (child.x || 0);
      const y = oy + (child.y || 0);
      if (child.id.startsWith("group:")) walk(child, x, y);
      else positions[child.id] = { x: Math.round(x), y: Math.round(y) };
    }
  };
  walk(result);
  return positions;
}

// Place a model that appeared while the map was open next to something it
// relates to, without disturbing the existing layout.
export function placeNear(name, edges, positions, sizes) {
  const related = edges
    .filter((e) => e.source === name || e.target === name)
    .map((e) => (e.source === name ? e.target : e.source))
    .find((n) => positions[n]);

  const occupied = Object.entries(positions);
  const collides = (p) =>
    occupied.some(([n, q]) => {
      const s = sizes[n] || { width: NODE_WIDTH, height: 160 };
      return p.x < q.x + s.width + 24 && p.x + NODE_WIDTH + 24 > q.x && p.y < q.y + s.height + 24 && p.y + 160 > q.y;
    });

  let candidate;
  if (related) {
    const base = positions[related];
    candidate = { x: base.x + NODE_WIDTH + 96, y: base.y };
  } else {
    const maxX = Math.max(0, ...occupied.map(([n, p]) => p.x + (sizes[n]?.width || NODE_WIDTH)));
    candidate = { x: maxX + 96, y: 0 };
  }
  let tries = 0;
  while (collides(candidate) && tries < 40) {
    candidate = { x: candidate.x, y: candidate.y + 120 };
    tries++;
  }
  return candidate;
}
