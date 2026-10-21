import { useState } from "react";
import { getPref, setPref } from "../api.js";

function Sample({ kind, start, end, dashed }) {
  return (
    <svg viewBox="0 0 64 20" className="mm-legend-line" aria-hidden="true">
      <path
        d="M 6 10 L 58 10"
        className={`mm-edge mm-edge-${kind}`}
        markerStart={start ? `url(#${start})` : undefined}
        markerEnd={end ? `url(#${end})` : undefined}
        strokeDasharray={dashed}
      />
    </svg>
  );
}

const ROWS = [
  { kind: "one-to-many", start: "mm-one", end: "mm-many", label: "One to many" },
  { kind: "one-to-many", start: "mm-zero-one", end: "mm-many", label: "Optional parent" },
  { kind: "one-to-one", start: "mm-one", end: "mm-one", label: "One to one" },
  { kind: "many-to-many", start: "mm-many-start", end: "mm-many", label: "Many to many" },
  { kind: "polymorphic", start: "mm-one", end: "mm-many", label: "Polymorphic (one of several parents)" },
  { kind: "through", end: "mm-arrow", label: "Reached through another model" },
  { kind: "inherits", end: "mm-triangle", label: "Is a kind of (shared table)" },
];

export function Legend() {
  const [open, setOpen] = useState(() => getPref("legend", false));
  const toggle = () => {
    setOpen(!open);
    setPref("legend", !open);
  };
  return (
    <div className={`mm-legend${open ? " is-open" : ""}`}>
      <button type="button" className="mm-legend-toggle" onClick={toggle} aria-expanded={open}>
        {open ? "Hide key" : "Key"}
      </button>
      {open ? (
        <ul>
          {ROWS.map((r) => (
            <li key={r.label}>
              <Sample {...r} />
              <span>{r.label}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
