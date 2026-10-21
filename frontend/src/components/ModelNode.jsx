import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { humanize, plainType, stiExtras, visibleAttributes } from "../graph.js";

export const COLLAPSED_ROWS = 8;

function KeyIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="mm-icon">
      <circle cx="5" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 8h6M12 8v2.5M10 8v2" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="mm-icon">
      <path d="M6.5 9.5l3-3M5 7.5L3.8 8.7a2.3 2.3 0 003.3 3.3L8.3 10.8M11 8.5l1.2-1.2a2.3 2.3 0 00-3.3-3.3L7.7 5.2" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="mm-icon">
      <path d="M6 4.5h7M6 8h7M6 11.5h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="3" cy="4.5" r="1" fill="currentColor" />
      <circle cx="3" cy="8" r="1" fill="currentColor" />
      <circle cx="3" cy="11.5" r="1" fill="currentColor" />
    </svg>
  );
}

function rowIcon(attr) {
  if (attr.primary_key) return <KeyIcon />;
  if (attr.foreign_key) return <LinkIcon />;
  if (attr.enum?.length) return <ListIcon />;
  return <span className="mm-icon" />;
}

function ModelNodeImpl({ data }) {
  const { model, plain, expanded, description, group, color, dimmed, focused, flash, onToggleExpand } = data;
  const isChild = !!model.sti?.parent;
  const title = plain ? humanize(model.name) : model.name;

  const attrs = visibleAttributes(model, plain);
  const extras = isChild ? stiExtras(model, plain) : [];
  const total = isChild ? extras.length : attrs.length;
  const limit = expanded ? total : COLLAPSED_ROWS;
  const hidden = Math.max(0, total - limit);

  const className = [
    "mm-node",
    dimmed && "is-dimmed",
    focused && "is-focused",
    flash && "is-flash",
    isChild && "is-sti-child",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className} style={{ "--group": color }}>
      <Handle type="target" position={Position.Top} className="mm-handle" isConnectable={false} />
      <Handle type="source" position={Position.Bottom} className="mm-handle" isConnectable={false} />

      <div className="mm-tab" title={group || "No group"}>
        {group || "Ungrouped"}
      </div>
      <div className="mm-card">
        <header className="mm-card-head">
          <h3 title={model.name}>{title}</h3>
          {plain ? null : <span className="mm-table">{model.table_name}</span>}
          {isChild ? (
            <span className="mm-sti">{plain ? `A kind of ${humanize(model.sti.parent).toLowerCase()}` : `< ${model.sti.parent}`}</span>
          ) : null}
        </header>

        {description ? <p className="mm-desc">{description}</p> : null}

        {isChild ? (
          <ul className="mm-rows">
            {extras.length === 0 ? (
              <li className="mm-row mm-row-note">
                {plain ? `Uses every field of ${humanize(model.sti.parent).toLowerCase()}` : `Shares the ${model.table_name} table`}
              </li>
            ) : null}
            {extras.slice(0, limit).map((r) => (
              <li key={r.key} className="mm-row">
                <span className="mm-icon" />
                <span className="mm-name">{plain ? humanize(r.label) : r.label}</span>
                <span className={plain ? "mm-type is-plain" : "mm-type"}>{r.detail}</span>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="mm-rows">
            {attrs.slice(0, limit).map((a) => (
              <li
                key={a.name}
                className={["mm-row", a.null === false && !a.primary_key ? "is-required" : "", a.virtual ? "is-virtual" : ""].join(" ")}
                title={a.comment || undefined}
              >
                {plain ? <span className="mm-icon" /> : rowIcon(a)}
                <span className="mm-name">{plain ? humanize(a.name) : a.name}</span>
                <span className={plain ? "mm-type is-plain" : "mm-type"}>{plain ? plainType(a) : a.enum?.length ? "enum" : a.type}</span>
              </li>
            ))}
            {attrs.length === 0 ? <li className="mm-row mm-row-note">No fields shown</li> : null}
          </ul>
        )}

        {hidden > 0 || (expanded && total > COLLAPSED_ROWS) ? (
          <button
            type="button"
            className="mm-more nodrag"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(model.name);
            }}
          >
            {expanded ? "Show fewer" : `Show ${hidden} more`}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export const ModelNode = memo(ModelNodeImpl);

function ZoneNodeImpl({ data }) {
  return (
    <div className={`mm-zone${data.dimmed ? " is-dimmed" : ""}`} style={{ "--group": data.color }}>
      <span className="mm-zone-label">{data.label}</span>
    </div>
  );
}

export const ZoneNode = memo(ZoneNodeImpl);
