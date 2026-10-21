import { memo } from "react";
import { EdgeLabelRenderer, useInternalNode } from "@xyflow/react";

// Edges attach to whichever side of each card faces the other card, so lines
// stay short however the nodes are arranged.

function rect(node) {
  const { x, y } = node.internals.positionAbsolute;
  const w = node.measured?.width ?? 248;
  const h = node.measured?.height ?? 160;
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
}

function boundaryPoint(r, toward) {
  const dx = toward.x - r.cx;
  const dy = toward.y - r.cy;
  if (dx === 0 && dy === 0) return { x: r.cx, y: r.cy };
  const sx = (r.w / 2) / Math.abs(dx || 1e-9);
  const sy = (r.h / 2) / Math.abs(dy || 1e-9);
  const s = Math.min(sx, sy);
  return { x: r.cx + dx * s, y: r.cy + dy * s };
}

const MARKERS = {
  "one-to-many": { start: "mm-one", end: "mm-many" },
  "one-to-one": { start: "mm-one", end: "mm-one" },
  polymorphic: { start: "mm-one", end: "mm-many" },
  "many-to-many": { start: "mm-many-start", end: "mm-many" },
  through: { start: null, end: "mm-arrow" },
  inherits: { start: null, end: "mm-triangle" },
};

function FloatingEdgeImpl({ id, source, target, data, selected }) {
  const s = useInternalNode(source);
  const t = useInternalNode(target);
  if (!s || !t) return null;

  const a = rect(s);
  const b = rect(t);
  const kind = data?.kind || "one-to-many";
  const markers = MARKERS[kind] || MARKERS["one-to-many"];
  const startMarker = markers.start && (data?.optional && markers.start === "mm-one" ? "mm-zero-one" : markers.start);

  let path;
  let labelX;
  let labelY;

  if (source === target) {
    // Self reference: a loop off the top-right corner.
    const x0 = a.x + a.w - 40;
    const y0 = a.y;
    const x1 = a.x + a.w;
    const y1 = a.y + 40;
    path = `M ${x0} ${y0} C ${x0} ${y0 - 70}, ${x1 + 70} ${y1}, ${x1} ${y1}`;
    labelX = x1 + 30;
    labelY = y0 - 30;
  } else {
    const p1 = boundaryPoint(a, { x: b.cx, y: b.cy });
    const p2 = boundaryPoint(b, { x: a.cx, y: a.cy });
    const count = data?.parallelCount || 1;
    const index = data?.parallelIndex || 0;
    const offset = count > 1 ? (index - (count - 1) / 2) * 46 : 0;

    const mx = (p1.x + p2.x) / 2;
    const my = (p1.y + p2.y) / 2;
    const len = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
    const nx = -(p2.y - p1.y) / len;
    const ny = (p2.x - p1.x) / len;
    const cx = mx + nx * offset * 2;
    const cy = my + ny * offset * 2;

    path = offset === 0 ? `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}` : `M ${p1.x} ${p1.y} Q ${cx} ${cy} ${p2.x} ${p2.y}`;
    labelX = offset === 0 ? mx : mx + nx * offset;
    labelY = offset === 0 ? my : my + ny * offset;
  }

  const className = [
    "mm-edge",
    `mm-edge-${kind}`,
    data?.dimmed && "is-dimmed",
    (data?.highlighted || selected) && "is-highlighted",
  ]
    .filter(Boolean)
    .join(" ");

  // Inheritance is already shown on the card itself, so its label only appears
  // when labels are switched on.
  const showLabel = data?.label && (data?.showLabels || ((data?.highlighted || selected) && kind !== "inherits"));

  return (
    <>
      <path d={path} className="mm-edge-hit" fill="none" />
      <path
        id={id}
        d={path}
        className={className}
        fill="none"
        markerStart={startMarker ? `url(#${startMarker})` : undefined}
        markerEnd={markers.end ? `url(#${markers.end})` : undefined}
      />
      {showLabel ? (
        <EdgeLabelRenderer>
          <div
            className={`mm-edge-label${data?.dimmed ? " is-dimmed" : ""}`}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

export const FloatingEdge = memo(FloatingEdgeImpl);

export function EdgeMarkers() {
  return (
    <svg className="mm-marker-defs" aria-hidden="true">
      <defs>
        <marker id="mm-many" viewBox="0 0 20 20" refX="19" refY="10" markerWidth="18" markerHeight="18" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
          <path d="M3 10 L19 2 M3 10 L19 10 M3 10 L19 18 M3 3 L3 17" className="mm-marker-stroke" fill="none" />
        </marker>
        <marker id="mm-many-start" viewBox="0 0 20 20" refX="19" refY="10" markerWidth="18" markerHeight="18" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
          <path d="M3 10 L19 2 M3 10 L19 10 M3 10 L19 18 M3 3 L3 17" className="mm-marker-stroke" fill="none" />
        </marker>
        <marker id="mm-one" viewBox="0 0 20 20" refX="18" refY="10" markerWidth="16" markerHeight="16" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
          <path d="M8 3 L8 17 M13 3 L13 17" className="mm-marker-stroke" fill="none" />
        </marker>
        <marker id="mm-zero-one" viewBox="0 0 24 20" refX="23" refY="10" markerWidth="20" markerHeight="16" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
          <circle cx="7" cy="10" r="4.5" className="mm-marker-stroke mm-marker-hollow" />
          <path d="M16 3 L16 17" className="mm-marker-stroke" fill="none" />
        </marker>
        <marker id="mm-arrow" viewBox="0 0 20 20" refX="18" refY="10" markerWidth="14" markerHeight="14" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
          <path d="M4 3 L18 10 L4 17" className="mm-marker-stroke" fill="none" />
        </marker>
        <marker id="mm-triangle" viewBox="0 0 20 20" refX="18" refY="10" markerWidth="18" markerHeight="18" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
          <path d="M3 3 L18 10 L3 17 Z" className="mm-marker-stroke mm-marker-hollow" />
        </marker>
      </defs>
    </svg>
  );
}
