import { useEffect, useState } from "react";
import { humanize, plainType } from "../graph.js";

function ModelChip({ name, onSelect, known }) {
  if (!name) return <span className="mm-chip is-missing">unresolved</span>;
  return known.has(name) ? (
    <button type="button" className="mm-chip" onClick={() => onSelect(name)}>
      {name}
    </button>
  ) : (
    <span className="mm-chip is-missing">{name}</span>
  );
}

function validationText(v) {
  const opts = Object.entries(v.options || {})
    .filter(([k]) => !["message", "allow_blank"].includes(k))
    .map(([k, val]) => `${k}: ${typeof val === "object" ? JSON.stringify(val) : val}`);
  return `${v.kind}${opts.length ? ` (${opts.join(", ")})` : ""}${v.conditional ? ", conditional" : ""}`;
}

function associationSummary(a) {
  const bits = [];
  if (a.through) bits.push(`through ${a.through}${a.source ? `, source ${a.source}` : ""}`);
  if (a.as) bits.push(`as ${a.as}`);
  if (a.polymorphic) bits.push("polymorphic");
  if (a.optional) bits.push("optional");
  if (a.dependent) bits.push(`dependent ${a.dependent}`);
  if (a.foreign_key && !a.through) bits.push(`key ${a.foreign_key}`);
  if (a.join_table) bits.push(`join table ${a.join_table}`);
  if (a.scoped) bits.push("scoped");
  if (a.counter_cache) bits.push("counter cache");
  return bits.join(", ");
}

export function DetailPanel({ model, schema, meta, group, groups, plain, writable, onClose, onSelect, onUpdateMeta, edges }) {
  const [description, setDescription] = useState(meta.description ?? model.description ?? "");
  const [groupDraft, setGroupDraft] = useState(group || "");

  useEffect(() => {
    setDescription(meta.description ?? model.description ?? "");
    setGroupDraft(group || "");
  }, [model.name, meta.description, model.description, group]);

  const known = new Set(schema.models.map((m) => m.name));
  const attrs = model.attributes || [];
  const incoming = edges.filter((e) => e.target === model.name && e.kind !== "inherits" && e.kind !== "through" && e.source !== model.name);

  const commitDescription = () => {
    const value = description.trim();
    const current = (meta.description ?? model.description ?? "").trim();
    if (value !== current) onUpdateMeta(model.name, { description: value });
  };

  const commitGroup = (value) => {
    const v = value.trim();
    if (v !== (group || "")) onUpdateMeta(model.name, { group: v || null });
  };

  return (
    <aside className="mm-detail" aria-label={`${model.name} details`}>
      <div className="mm-detail-head" style={{ "--group": groups[group] || "var(--ungrouped)" }}>
        <div>
          <h2>{plain ? humanize(model.name) : model.name}</h2>
          <p className="mm-detail-sub">
            {plain ? model.name : `table ${model.table_name}`}
            {model.file ? <span className="mm-file">{model.file}</span> : null}
          </p>
        </div>
        <button type="button" className="mm-icon-button" onClick={onClose} aria-label="Close details">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="mm-detail-body">
        <label className="mm-field">
          <span>Plain-language description</span>
          <textarea
            rows={3}
            value={description}
            placeholder="What one record means to the people using the system"
            onChange={(e) => setDescription(e.target.value)}
            onBlur={commitDescription}
          />
        </label>

        <label className="mm-field">
          <span>Group</span>
          <input
            list="mm-group-options"
            value={groupDraft}
            placeholder="Ungrouped"
            onChange={(e) => setGroupDraft(e.target.value)}
            onBlur={(e) => commitGroup(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          />
          <datalist id="mm-group-options">
            {Object.keys(groups).map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </label>
        {!writable ? <p className="mm-hint">Edits stay in this browser until you download the layout.</p> : null}

        {model.sti ? (
          <section className="mm-section">
            <h3>Inheritance</h3>
            {model.sti.parent ? (
              <p>
                Subclass of <ModelChip name={model.sti.parent} onSelect={onSelect} known={known} /> stored in{" "}
                <code>{model.table_name}</code> with <code>{model.sti.column}</code> = <code>{model.sti.sti_name}</code>
              </p>
            ) : null}
            {model.sti.children?.length ? (
              <p>
                Subclasses:{" "}
                {model.sti.children.map((c) => (
                  <ModelChip key={c} name={c} onSelect={onSelect} known={known} />
                ))}
              </p>
            ) : null}
          </section>
        ) : null}

        {attrs.length ? (
          <section className="mm-section">
            <h3>Fields</h3>
            <table className="mm-attr-table">
              <tbody>
                {attrs.map((a) => (
                  <tr key={a.name} className={a.technical && plain ? "is-technical" : ""}>
                    <th scope="row">
                      {plain ? humanize(a.name) : a.name}
                      {a.null === false && !a.primary_key ? <span className="mm-req" title="Required">required</span> : null}
                      {a.virtual ? <span className="mm-tag">virtual</span> : null}
                    </th>
                    <td>
                      <span className={plain ? "mm-type-plain" : "mm-type-cell"}>{plain ? plainType(a) : a.sql_type || a.type}</span>
                      {a.primary_key ? <span className="mm-tag">primary key</span> : null}
                      {a.foreign_key ? <span className="mm-tag">links to {a.foreign_key}</span> : null}
                      {a.default !== undefined && a.default !== null && !plain ? <span className="mm-tag">default {String(a.default)}</span> : null}
                      {a.enum?.length ? (
                        <div className="mm-enum">
                          {a.enum.map((v) => (
                            <span key={v}>{plain ? humanize(v) : v}</span>
                          ))}
                        </div>
                      ) : null}
                      {a.validations?.length ? (
                        <div className="mm-validations">{a.validations.map((v, i) => <span key={i}>{validationText(v)}</span>)}</div>
                      ) : null}
                      {a.comment ? <p className="mm-comment">{a.comment}</p> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        <section className="mm-section">
          <h3>Associations</h3>
          {model.associations?.length ? (
            <ul className="mm-assoc-list">
              {model.associations.map((a) => (
                <li key={a.name}>
                  <div className="mm-assoc-line">
                    <code className="mm-macro">{a.macro}</code> <strong>{a.name}</strong>
                    {a.polymorphic ? (
                      <span className="mm-assoc-targets">
                        {(a.targets || []).length ? a.targets.map((t) => <ModelChip key={t} name={t} onSelect={onSelect} known={known} />) : <span className="mm-chip is-missing">any</span>}
                      </span>
                    ) : (
                      <ModelChip name={a.target || a.class_name} onSelect={onSelect} known={known} />
                    )}
                  </div>
                  {associationSummary(a) ? <p className="mm-assoc-meta">{associationSummary(a)}</p> : null}
                  {a.error ? <p className="mm-assoc-error">{a.error}</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mm-muted">None declared on this model.</p>
          )}
          {incoming.length ? (
            <p className="mm-muted">
              Referenced by{" "}
              {[...new Set(incoming.map((e) => e.source))].map((n) => (
                <ModelChip key={n} name={n} onSelect={onSelect} known={known} />
              ))}
            </p>
          ) : null}
        </section>

        {model.validations?.length || model.custom_validations?.length ? (
          <section className="mm-section">
            <h3>Validations</h3>
            <ul className="mm-plain-list">
              {model.validations.map((v, i) => (
                <li key={i}>
                  <code>{v.attributes.join(", ")}</code> {validationText(v)}
                </li>
              ))}
              {(model.custom_validations || []).map((m) => (
                <li key={m}>
                  <code>validate :{m}</code>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </aside>
  );
}
