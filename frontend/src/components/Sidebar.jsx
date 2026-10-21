import { useMemo } from "react";
import { humanize } from "../graph.js";
import { ToursPanel } from "./ToursPanel.jsx";

function EyeIcon({ off }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8s-2.4 4.5-6.5 4.5S1.5 8 1.5 8z" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="8" cy="8" r="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      {off ? <path d="M2.5 13.5l11-11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /> : null}
    </svg>
  );
}

export function Sidebar({
  tab,
  onTab,
  query,
  onQuery,
  searchRef,
  models,
  groupOf,
  groupColors,
  hiddenGroups,
  hiddenModels,
  onToggleGroup,
  onToggleModel,
  selected,
  onSelect,
  plain,
  toursProps,
}) {
  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map();
    for (const m of models) {
      const label = humanize(m.name).toLowerCase();
      const hit =
        !q ||
        m.name.toLowerCase().includes(q) ||
        label.includes(q) ||
        m.table_name?.toLowerCase().includes(q) ||
        (m.attributes || []).some((a) => a.name.toLowerCase().includes(q));
      if (!hit) continue;
      const g = groupOf(m) || "";
      if (!map.has(g)) map.set(g, []);
      map.get(g).push(m);
    }
    return [...map.entries()].sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)));
  }, [models, query, groupOf]);

  const firstHit = grouped[0]?.[1]?.[0];

  return (
    <nav className="mm-sidebar" aria-label="Model list and tours">
      <div className="mm-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "models"} className={tab === "models" ? "is-active" : ""} onClick={() => onTab("models")}>
          Models <span className="mm-count">{models.length}</span>
        </button>
        <button type="button" role="tab" aria-selected={tab === "tours"} className={tab === "tours" ? "is-active" : ""} onClick={() => onTab("tours")}>
          Tours <span className="mm-count">{toursProps.tours.length}</span>
        </button>
      </div>

      {tab === "models" ? (
        <>
          <div className="mm-search">
            <input
              ref={searchRef}
              type="search"
              value={query}
              placeholder="Find a model or field"
              aria-label="Find a model or field"
              onChange={(e) => onQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && firstHit) onSelect(firstHit.name);
                if (e.key === "Escape") onQuery("");
              }}
            />
          </div>
          <div className="mm-model-list">
            {grouped.length === 0 ? <p className="mm-muted mm-pad">Nothing matches “{query}”.</p> : null}
            {grouped.map(([g, list]) => {
              const groupHidden = hiddenGroups.has(g);
              return (
                <section key={g || "_none"} className={`mm-group${groupHidden ? " is-hidden" : ""}`}>
                  <header style={{ "--group": groupColors[g] || "var(--ungrouped)" }}>
                    <span className="mm-swatch" />
                    <span className="mm-group-name">{g || "Ungrouped"}</span>
                    <button
                      type="button"
                      className="mm-icon-button"
                      onClick={() => onToggleGroup(g)}
                      aria-label={groupHidden ? `Show ${g || "ungrouped"} on the map` : `Hide ${g || "ungrouped"} from the map`}
                      title={groupHidden ? "Show on map" : "Hide from map"}
                    >
                      <EyeIcon off={groupHidden} />
                    </button>
                  </header>
                  <ul>
                    {list.map((m) => {
                      const off = hiddenModels.has(m.name);
                      return (
                        <li key={m.name} className={[selected === m.name ? "is-selected" : "", off ? "is-hidden" : ""].join(" ")}>
                          <button type="button" className="mm-model-link" onClick={() => onSelect(m.name)} disabled={groupHidden}>
                            {plain ? humanize(m.name) : m.name}
                            {m.sti?.parent ? <span className="mm-muted"> {plain ? "kind of" : "<"} {plain ? humanize(m.sti.parent) : m.sti.parent}</span> : null}
                          </button>
                          <button
                            type="button"
                            className="mm-icon-button mm-row-action"
                            onClick={() => onToggleModel(m.name)}
                            aria-label={off ? `Show ${m.name}` : `Hide ${m.name}`}
                            title={off ? "Show on map" : "Hide from map"}
                          >
                            <EyeIcon off={off} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        </>
      ) : (
        <ToursPanel {...toursProps} />
      )}
    </nav>
  );
}
