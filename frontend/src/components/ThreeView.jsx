import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph3D from "react-force-graph-3d";
import SpriteText from "three-spritetext";
import { humanize } from "../graph.js";

// 3D force-directed view. Drag to rotate, scroll to zoom, click a model to fly
// to it and open its details.

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function resolveColor(color) {
  if (!color || !color.startsWith("var(")) return color;
  const name = color.slice(4, -1);
  return cssVar(name, "#888888");
}

export default function ThreeView({ models, edges, groupOf, groupColors, selected, focusSet, onSelect, plain, theme }) {
  const fgRef = useRef();
  const wrapRef = useRef();
  const fittedRef = useRef(false);
  const [size, setSize] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => {
      setSize({ width: Math.floor(entry.contentRect.width), height: Math.floor(entry.contentRect.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const data = useMemo(() => {
    const ids = new Set(models.map((m) => m.name));
    return {
      nodes: models.map((m) => ({
        id: m.name,
        label: plain ? humanize(m.name) : m.name,
        color: resolveColor(groupColors[groupOf(m)] || "var(--ungrouped)"),
        size: Math.max(4, Math.min(14, (m.attributes?.length || 3) / 1.4)),
      })),
      links: edges
        .filter((e) => ids.has(e.source) && ids.has(e.target) && e.source !== e.target)
        .map((e) => ({ source: e.source, target: e.target, kind: e.kind, id: e.id })),
    };
    // theme is a dependency so colors re-resolve when it flips
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [models, edges, groupColors, groupOf, plain, theme]);

  useEffect(() => {
    if (!selected || !fgRef.current) return;
    const node = data.nodes.find((n) => n.id === selected);
    if (!node || node.x === undefined) return;
    const distance = 160;
    const ratio = 1 + distance / Math.hypot(node.x || 1, node.y || 1, node.z || 1);
    fgRef.current.cameraPosition({ x: node.x * ratio, y: node.y * ratio, z: node.z * ratio }, node, 900);
  }, [selected, data.nodes]);

  const ink = cssVar("--ink", "#1e2a30");
  const muted = cssVar("--muted", "#5e6b70");
  const bg = cssVar("--canvas", "#e6e9e4");

  return (
    <div className="mm-three" ref={wrapRef}>
      <ForceGraph3D
        ref={fgRef}
        width={size.width}
        height={size.height}
        graphData={data}
        backgroundColor={bg}
        showNavInfo={false}
        nodeRelSize={4}
        nodeVal={(n) => n.size}
        nodeColor={(n) => (focusSet && !focusSet.has(n.id) ? muted : n.color)}
        nodeOpacity={0.95}
        nodeLabel={() => ""}
        nodeThreeObjectExtend
        nodeThreeObject={(n) => {
          const sprite = new SpriteText(n.label);
          sprite.color = focusSet && !focusSet.has(n.id) ? muted : ink;
          sprite.textHeight = n.id === selected ? 7 : 5;
          sprite.fontFace = "Public Sans Variable, Public Sans, sans-serif";
          sprite.fontWeight = n.id === selected ? "700" : "500";
          sprite.position.y = n.size + 8;
          return sprite;
        }}
        linkColor={(l) => {
          const s = typeof l.source === "object" ? l.source.id : l.source;
          const t = typeof l.target === "object" ? l.target.id : l.target;
          if (focusSet && !(focusSet.has(s) && focusSet.has(t))) return muted;
          return l.kind === "inherits" ? muted : ink;
        }}
        linkOpacity={0.45}
        linkWidth={(l) => (l.kind === "through" ? 0.2 : 0.8)}
        linkDirectionalArrowLength={(l) => (l.kind === "inherits" ? 6 : 3.5)}
        linkDirectionalArrowRelPos={1}
        linkDirectionalParticles={(l) => {
          const s = typeof l.source === "object" ? l.source.id : l.source;
          const t = typeof l.target === "object" ? l.target.id : l.target;
          return selected && (s === selected || t === selected) ? 3 : 0;
        }}
        linkDirectionalParticleWidth={1.6}
        onNodeClick={(n) => onSelect(n.id)}
        onBackgroundClick={() => onSelect(null)}
        cooldownTicks={140}
        onEngineStop={() => {
          if (!fittedRef.current && !selected) fgRef.current?.zoomToFit(600, 60);
          fittedRef.current = true;
        }}
      />
      <p className="mm-three-hint">Drag to rotate. Scroll to zoom. Right-drag to pan. Click a model to fly to it.</p>
    </div>
  );
}
