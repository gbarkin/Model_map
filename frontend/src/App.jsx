import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Background, Controls, MiniMap, ReactFlow, ReactFlowProvider, useReactFlow } from "@xyflow/react";
import { createApi, clearDraft, downloadJSON, getPref, loadDraft, saveDraft, setPref } from "./api.js";
import {
  buildEdges,
  descriptionOf,
  diffSchemas,
  edgeLabel,
  EDGE_KINDS,
  groupOf as rawGroupOf,
  humanize,
  modelMeta,
  neighborsOf,
  stiExtras,
  visibleAttributes,
} from "./graph.js";
import { autoLayout, estimateHeight, NODE_WIDTH, placeNear } from "./layout.js";
import { COLLAPSED_ROWS, ModelNode, ZoneNode } from "./components/ModelNode.jsx";
import { EdgeMarkers, FloatingEdge } from "./components/FloatingEdge.jsx";
import { DetailPanel } from "./components/DetailPanel.jsx";
import { Sidebar } from "./components/Sidebar.jsx";
import { Legend } from "./components/Legend.jsx";

const ThreeView = lazy(() => import("./components/ThreeView.jsx"));

const nodeTypes = { model: ModelNode, zone: ZoneNode };
const edgeTypes = { floating: FloatingEdge };
const ZONE_PAD = 28;
const ZONE_HEAD = 34;

const uid = () => Math.random().toString(36).slice(2, 10);

function emptyStore() {
  return { version: 1, positions: {}, models: {}, groups: {}, tours: [], settings: {} };
}

function normalizeStore(s) {
  const base = emptyStore();
  if (!s || typeof s !== "object") return base;
  return {
    ...base,
    ...s,
    positions: s.positions || {},
    models: s.models || {},
    groups: s.groups || {},
    tours: Array.isArray(s.tours) ? s.tours : [],
    settings: s.settings || {},
  };
}

function cleanStoreForSave(store) {
  // eslint-disable-next-line no-unused-vars
  const { error, ...rest } = store;
  return rest;
}

function MapApp({ boot }) {
  const api = useMemo(() => createApi(boot), [boot]);
  const flow = useReactFlow();
  const draftKey = boot.title || "default";

  const [schema, setSchema] = useState(null);
  const [store, setStore] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [plain, setPlainState] = useState(() => getPref("plain", false));
  const [view, setView] = useState("2d");
  const [theme, setTheme] = useState(() => getPref("theme", "auto"));
  const [showLabels, setShowLabels] = useState(() => getPref("labels", false));
  const [selected, setSelected] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set());
  const [sizes, setSizes] = useState({});
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("models");
  const [presenting, setPresenting] = useState(null); // { tourId, index } | { free: true }
  const [activeTourId, setActiveTourId] = useState(null);
  const [toast, setToast] = useState(null);
  const [flash, setFlash] = useState(() => new Set());
  const [saveState, setSaveState] = useState("saved");
  const [saveError, setSaveError] = useState(null);
  const [usingDraft, setUsingDraft] = useState(false);
  const [live, setLive] = useState("ok");
  const [fitRequest, setFitRequest] = useState(0);
  const [arranging, setArranging] = useState(false);

  const searchRef = useRef(null);
  const saveTimer = useRef(null);
  const fingerprintRef = useRef(null);
  const relayoutAfterMeasure = useRef(false);
  const schemaRef = useRef(null);
  const storeRef = useRef(null);
  schemaRef.current = schema;
  storeRef.current = store;

  const setPlain = (v) => {
    setPlainState(v);
    setPref("plain", v);
  };

  // ---------- theme ----------
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "auto") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    setPref("theme", theme);
  }, [theme]);

  // ---------- saving ----------
  const persist = useCallback(
    (next) => {
      clearTimeout(saveTimer.current);
      setSaveState(api.writable ? "dirty" : "draft");
      saveTimer.current = setTimeout(async () => {
        if (!api.writable) {
          saveDraft(draftKey, cleanStoreForSave(next));
          setUsingDraft(true);
          return;
        }
        setSaveState("saving");
        try {
          await api.saveStore(cleanStoreForSave(next));
          setSaveState("saved");
          setSaveError(null);
        } catch (e) {
          setSaveState("error");
          setSaveError(e.message);
          saveDraft(draftKey, cleanStoreForSave(next));
        }
      }, 700);
    },
    [api, draftKey]
  );

  const updateStore = useCallback(
    (fn, { save = true } = {}) => {
      setStore((prev) => {
        const next = fn(prev);
        if (save && next !== prev) persist(next);
        return next;
      });
    },
    [persist]
  );

  // ---------- derived ----------
  const groupOf = useCallback((m) => rawGroupOf(m, storeRef.current), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const groupOfMemo = useCallback((m) => rawGroupOf(m, store), [store]);

  const groupColors = useMemo(() => {
    const colors = { ...(schema?.groups || {}) };
    for (const [g, v] of Object.entries(store?.groups || {})) if (v?.color) colors[g] = v.color;
    return colors;
  }, [schema, store]);

  const allEdges = useMemo(() => (schema ? buildEdges(schema.models) : []), [schema]);

  const hiddenModels = useMemo(
    () => new Set(Object.entries(store?.models || {}).filter(([, v]) => v?.hidden).map(([k]) => k)),
    [store]
  );
  const hiddenGroups = useMemo(
    () => new Set(Object.entries(store?.groups || {}).filter(([, v]) => v?.hidden).map(([k]) => k)),
    [store]
  );

  const visibleModels = useMemo(() => {
    if (!schema) return [];
    return schema.models.filter((m) => !hiddenModels.has(m.name) && !hiddenGroups.has(groupOfMemo(m) || ""));
  }, [schema, hiddenModels, hiddenGroups, groupOfMemo]);

  const visibleNames = useMemo(() => new Set(visibleModels.map((m) => m.name)), [visibleModels]);
  const visibleEdges = useMemo(
    () => allEdges.filter((e) => visibleNames.has(e.source) && visibleNames.has(e.target)),
    [allEdges, visibleNames]
  );

  const focusSet = useMemo(
    () => (selected && visibleNames.has(selected) ? neighborsOf(selected, visibleEdges, 1) : null),
    [selected, visibleEdges, visibleNames]
  );

  const estimatedSize = useCallback(
    (m) => {
      const isChild = !!m.sti?.parent;
      const rows = isChild ? Math.max(1, stiExtras(m).length) : Math.max(1, visibleAttributes(m, plain).length);
      const isOpen = expanded.has(m.name);
      const shown = isOpen ? rows : Math.min(rows, COLLAPSED_ROWS);
      const desc = plain && !!descriptionOf(m, storeRef.current);
      return { width: NODE_WIDTH, height: estimateHeight(shown, { description: desc, more: rows > COLLAPSED_ROWS }) };
    },
    [plain, expanded]
  );

  const sizeOf = useCallback((m) => sizes[m.name] || estimatedSize(m), [sizes, estimatedSize]);

  // ---------- loading ----------
  const runAutoLayout = useCallback(
    async (models, { save = true, useMeasured = true } = {}) => {
      const sizeMap = {};
      for (const m of models) sizeMap[m.name] = useMeasured ? sizes[m.name] || estimatedSize(m) : estimatedSize(m);
      const positions = await autoLayout({
        models,
        edges: buildEdges(schemaRef.current.models),
        sizes: sizeMap,
        groupOf: (m) => rawGroupOf(m, storeRef.current),
      });
      updateStore((s) => ({ ...s, positions: { ...s.positions, ...positions } }), { save });
      return positions;
    },
    [sizes, estimatedSize, updateStore]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [sc, st] = await Promise.all([api.schema(), api.store()]);
        if (cancelled) return;
        let storeData = normalizeStore(st);
        const draft = loadDraft(draftKey);
        if (draft && (!api.writable || api.isStatic)) {
          storeData = normalizeStore(draft.data);
          setUsingDraft(true);
          setSaveState("draft");
        }
        fingerprintRef.current = sc.fingerprint;
        setSchema(sc);
        setStore(storeData);
        if (storeData.tours[0]) setActiveTourId(storeData.tours[0].id);

        const missing = sc.models.filter((m) => !storeData.positions[m.name]);
        if (missing.length === sc.models.length) {
          relayoutAfterMeasure.current = true;
        } else if (missing.length) {
          const pos = { ...storeData.positions };
          const edges = buildEdges(sc.models);
          for (const m of missing) pos[m.name] = placeNear(m.name, edges, pos, {});
          setStore((s) => ({ ...s, positions: pos }));
        }
      } catch (e) {
        if (!cancelled) setLoadError(e.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, draftKey]);

  // First visit: lay out with estimates, then again with real sizes.
  useEffect(() => {
    if (!schema || !store || !relayoutAfterMeasure.current) return;
    const positioned = schema.models.some((m) => store.positions[m.name]);
    if (!positioned) {
      runAutoLayout(visibleModels.length ? visibleModels : schema.models, { save: false, useMeasured: false }).then(() =>
        setFitRequest((n) => n + 1)
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema, store === null]);

  useEffect(() => {
    if (!relayoutAfterMeasure.current || !schema) return;
    const measuredAll = visibleModels.length > 0 && visibleModels.every((m) => sizes[m.name]);
    const positioned = visibleModels.every((m) => store?.positions[m.name]);
    if (measuredAll && positioned) {
      relayoutAfterMeasure.current = false;
      runAutoLayout(visibleModels, { save: api.writable }).then(() => setFitRequest((n) => n + 1));
    }
  }, [sizes, visibleModels, schema, store, runAutoLayout, api.writable]);

  // ---------- live updates ----------
  const applySchema = useCallback(
    (next) => {
      const prev = schemaRef.current;
      const diff = diffSchemas(prev, next);
      fingerprintRef.current = next.fingerprint;
      setSchema(next);

      if (diff.added.length) {
        const edges = buildEdges(next.models);
        setStore((s) => {
          const pos = { ...s.positions };
          for (const name of diff.added) if (!pos[name]) pos[name] = placeNear(name, edges, pos, sizes);
          return { ...s, positions: pos };
        });
      }

      const touched = [...diff.added, ...diff.changed];
      if (touched.length || diff.removed.length) {
        setFlash(new Set(touched));
        setTimeout(() => setFlash(new Set()), 2600);
        const parts = [];
        if (diff.added.length) parts.push(`Added ${diff.added.join(", ")}`);
        if (diff.changed.length) parts.push(`Changed ${diff.changed.join(", ")}`);
        if (diff.removed.length) parts.push(`Removed ${diff.removed.join(", ")}`);
        setToast({ text: parts.join(". "), at: Date.now() });
      } else if (next.load_errors?.length !== prev?.load_errors?.length) {
        setToast({ text: next.load_errors?.length ? "A model file failed to load" : "Model files load cleanly again", at: Date.now() });
      }
    },
    [sizes]
  );

  useEffect(() => {
    if (!schema || !api.pollInterval) return undefined;
    let stopped = false;
    const tick = async () => {
      if (stopped || document.hidden) return;
      try {
        const fp = await api.fingerprint();
        setLive("ok");
        if (fp && fp !== fingerprintRef.current) applySchema(await api.schema());
      } catch {
        setLive("offline");
      }
    };
    const id = setInterval(tick, api.pollInterval);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [api, applySchema, schema !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(id);
  }, [toast]);

  // ---------- nodes ----------
  const toggleExpand = useCallback((name) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const zones = useMemo(() => {
    if (!store) return [];
    const byGroup = new Map();
    for (const m of visibleModels) {
      const g = groupOfMemo(m);
      const p = store.positions[m.name];
      if (!g || !p) continue;
      const s = sizeOf(m);
      const box = byGroup.get(g) || { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity, members: [] };
      box.minX = Math.min(box.minX, p.x);
      box.minY = Math.min(box.minY, p.y);
      box.maxX = Math.max(box.maxX, p.x + s.width);
      box.maxY = Math.max(box.maxY, p.y + s.height);
      box.members.push(m.name);
      byGroup.set(g, box);
    }
    return [...byGroup.entries()].map(([g, b]) => ({
      group: g,
      members: b.members,
      x: b.minX - ZONE_PAD,
      y: b.minY - ZONE_PAD - ZONE_HEAD,
      width: b.maxX - b.minX + ZONE_PAD * 2,
      height: b.maxY - b.minY + ZONE_PAD * 2 + ZONE_HEAD,
    }));
  }, [visibleModels, store, groupOfMemo, sizeOf]);

  const nodes = useMemo(() => {
    if (!schema || !store) return [];
    const zoneNodes = zones.map((z) => ({
      id: `zone:${z.group}`,
      type: "zone",
      position: { x: z.x, y: z.y },
      width: z.width,
      height: z.height,
      style: { width: z.width, height: z.height },
      draggable: true,
      selectable: false,
      focusable: false,
      zIndex: 0,
      data: {
        label: z.group,
        color: groupColors[z.group],
        dimmed: !!focusSet && !z.members.some((n) => focusSet.has(n)),
      },
    }));

    const modelNodes = visibleModels.map((m) => {
      const g = groupOfMemo(m);
      return {
        id: m.name,
        type: "model",
        position: store.positions[m.name] || { x: 0, y: 0 },
        measured: sizes[m.name],
        selected: selected === m.name,
        zIndex: selected === m.name ? 20 : 10,
        data: {
          model: m,
          plain,
          expanded: expanded.has(m.name),
          description: descriptionOf(m, store),
          group: g,
          color: groupColors[g] || "var(--ungrouped)",
          dimmed: !!focusSet && !focusSet.has(m.name),
          focused: selected === m.name,
          flash: flash.has(m.name),
          onToggleExpand: toggleExpand,
        },
      };
    });
    return [...zoneNodes, ...modelNodes];
  }, [schema, store, zones, visibleModels, groupOfMemo, sizes, selected, plain, expanded, groupColors, focusSet, flash, toggleExpand]);

  const byName = useMemo(() => new Map((schema?.models || []).map((m) => [m.name, m])), [schema]);

  const edges = useMemo(
    () =>
      visibleEdges.map((e) => {
        const touches = selected && (e.source === selected || e.target === selected);
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          type: "floating",
          zIndex: touches ? 15 : 5,
          data: {
            ...e,
            label: edgeLabel(e, plain, byName),
            dimmed: !!focusSet && !touches,
            highlighted: !!touches,
            showLabels,
          },
        };
      }),
    [visibleEdges, selected, plain, byName, focusSet, showLabels]
  );

  const onNodesChange = useCallback(
    (changes) => {
      const dims = {};
      const moves = {};
      let finished = false;
      for (const c of changes) {
        if (c.type === "dimensions" && c.dimensions && !c.id.startsWith("zone:")) {
          dims[c.id] = { width: Math.round(c.dimensions.width), height: Math.round(c.dimensions.height) };
        }
        if (c.type === "position") {
          if (c.position) moves[c.id] = c.position;
          if (c.dragging === false) finished = true;
        }
      }

      if (Object.keys(dims).length) {
        setSizes((prev) => {
          let changed = false;
          const next = { ...prev };
          for (const [id, d] of Object.entries(dims)) {
            if (!prev[id] || prev[id].width !== d.width || prev[id].height !== d.height) {
              next[id] = d;
              changed = true;
            }
          }
          return changed ? next : prev;
        });
      }

      if (Object.keys(moves).length || finished) {
        updateStore(
          (s) => {
            const positions = { ...s.positions };
            for (const [id, p] of Object.entries(moves)) {
              if (id.startsWith("zone:")) {
                // Dragging a group's background moves every model in it. The
                // zone's origin is derived from current positions, not the
                // rendered zone, so rapid drag events don't compound.
                const zone = zones.find((z) => `zone:${z.group}` === id);
                if (!zone) continue;
                const pts = zone.members.map((n) => positions[n]).filter(Boolean);
                if (!pts.length) continue;
                const originX = Math.min(...pts.map((q) => q.x)) - ZONE_PAD;
                const originY = Math.min(...pts.map((q) => q.y)) - ZONE_PAD - ZONE_HEAD;
                const dx = p.x - originX;
                const dy = p.y - originY;
                for (const member of zone.members) {
                  const q = positions[member];
                  if (q) positions[member] = { x: Math.round(q.x + dx), y: Math.round(q.y + dy) };
                }
              } else {
                positions[id] = { x: Math.round(p.x), y: Math.round(p.y) };
              }
            }
            return { ...s, positions };
          },
          { save: finished }
        );
      }
    },
    [updateStore, zones]
  );

  // ---------- selection and camera ----------
  const select = useCallback((name, { fit = true } = {}) => {
    setSelected(name);
    if (name) {
      setExpanded((prev) => (prev.has(name) ? prev : new Set(prev).add(name)));
      if (fit) setFitRequest((n) => n + 1);
    }
  }, []);

  useEffect(() => {
    if (!fitRequest || view !== "2d") return;
    const id = setTimeout(() => {
      if (selected && focusSet) {
        // Fit the model and its neighbors. If they are spread so far apart
        // that cards would be unreadable, center on the model instead.
        const pane = document.querySelector(".mm-canvas")?.getBoundingClientRect();
        const bounds = flow.getNodesBounds([...focusSet]);
        const zoom = pane && bounds.width ? Math.min(pane.width / bounds.width, pane.height / bounds.height) * 0.8 : 1;
        if (zoom < 0.75) {
          const node = flow.getInternalNode(selected);
          const w = node?.measured?.width || NODE_WIDTH;
          const h = node?.measured?.height || 200;
          const p = node?.internals?.positionAbsolute || { x: 0, y: 0 };
          flow.setCenter(p.x + w / 2, p.y + h / 2, { zoom: 1, duration: 650 });
        } else {
          flow.fitView({ nodes: [...focusSet].map((n) => ({ id: n })), duration: 650, padding: 0.18, maxZoom: 1.2 });
        }
      } else {
        flow.fitView({ duration: 650, padding: 0.12 });
      }
    }, 140);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitRequest]);

  // ---------- model metadata ----------
  const updateMeta = useCallback(
    (name, patch) => updateStore((s) => ({ ...s, models: { ...s.models, [name]: { ...modelMeta(s, name), ...patch } } })),
    [updateStore]
  );

  const toggleModelHidden = (name) => updateMeta(name, { hidden: !hiddenModels.has(name) || undefined });
  const toggleGroupHidden = (g) =>
    updateStore((s) => ({ ...s, groups: { ...s.groups, [g]: { ...(s.groups[g] || {}), hidden: !hiddenGroups.has(g) || undefined } } }));

  // ---------- tours ----------
  // Steps store the camera as a center point plus zoom, so they replay
  // correctly whatever the canvas size (presenting hides the side panels).
  const captureView = () => {
    const vp = flow.getViewport();
    const pane = document.querySelector(".mm-canvas")?.getBoundingClientRect() || { width: 1000, height: 700 };
    return {
      focus: selected || null,
      expanded: [...expanded],
      center: {
        x: Math.round((pane.width / 2 - vp.x) / vp.zoom),
        y: Math.round((pane.height / 2 - vp.y) / vp.zoom),
        zoom: Math.round(vp.zoom * 1000) / 1000,
      },
      plain,
    };
  };

  const toursProps = {
    tours: store?.tours || [],
    activeTourId,
    selected,
    onSelectTour: setActiveTourId,
    onCreateTour: (name) => {
      const id = uid();
      updateStore((s) => ({ ...s, tours: [...s.tours, { id, name, steps: [] }] }));
      setActiveTourId(id);
    },
    onRenameTour: (id, name) => updateStore((s) => ({ ...s, tours: s.tours.map((t) => (t.id === id ? { ...t, name } : t)) })),
    onDeleteTour: (id) => {
      updateStore((s) => ({ ...s, tours: s.tours.filter((t) => t.id !== id) }));
      setActiveTourId(null);
    },
    onAddStep: (tourId) => {
      const view = captureView();
      const title = view.focus ? (plain ? humanize(view.focus) : view.focus) : "Overview";
      updateStore((s) => ({
        ...s,
        tours: s.tours.map((t) => (t.id === tourId ? { ...t, steps: [...t.steps, { id: uid(), title, note: "", ...view }] } : t)),
      }));
    },
    onUpdateStep: (tourId, stepId, patch) => {
      const { capture, ...rest } = patch;
      const extra = capture ? captureView() : {};
      updateStore((s) => ({
        ...s,
        tours: s.tours.map((t) =>
          t.id === tourId ? { ...t, steps: t.steps.map((st) => (st.id === stepId ? { ...st, ...rest, ...extra } : st)) } : t
        ),
      }));
    },
    onMoveStep: (tourId, stepId, dir) =>
      updateStore((s) => ({
        ...s,
        tours: s.tours.map((t) => {
          if (t.id !== tourId) return t;
          const steps = [...t.steps];
          const i = steps.findIndex((st) => st.id === stepId);
          const j = i + dir;
          if (i < 0 || j < 0 || j >= steps.length) return t;
          [steps[i], steps[j]] = [steps[j], steps[i]];
          return { ...t, steps };
        }),
      })),
    onDeleteStep: (tourId, stepId) =>
      updateStore((s) => ({ ...s, tours: s.tours.map((t) => (t.id === tourId ? { ...t, steps: t.steps.filter((st) => st.id !== stepId) } : t)) })),
    onPreviewStep: (step) => applyStep(step),
    onPlay: (tourId) => {
      const tour = store.tours.find((t) => t.id === tourId);
      if (!tour?.steps.length) return;
      setView("2d");
      setPresenting({ tourId, index: 0 });
      applyStep(tour.steps[0]);
    },
  };

  function applyStep(step) {
    setView("2d");
    setSelected(step.focus || null);
    setExpanded(new Set(step.expanded || []));
    if (typeof step.plain === "boolean") setPlainState(step.plain);
    if (step.center) {
      setTimeout(() => flow.setCenter(step.center.x, step.center.y, { zoom: step.center.zoom, duration: 800 }), 60);
    } else if (step.viewport) {
      setTimeout(() => flow.setViewport(step.viewport, { duration: 800 }), 60);
    } else {
      setFitRequest((n) => n + 1);
    }
  }

  const activeTour = presenting?.tourId ? store?.tours.find((t) => t.id === presenting.tourId) : null;
  const step = activeTour ? activeTour.steps[presenting.index] : null;

  const goStep = (delta) => {
    if (!activeTour) return;
    const index = Math.max(0, Math.min(activeTour.steps.length - 1, presenting.index + delta));
    if (index === presenting.index) return;
    setPresenting({ ...presenting, index });
    applyStep(activeTour.steps[index]);
  };

  // ---------- keyboard ----------
  useEffect(() => {
    const onKey = (e) => {
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName) || e.target.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (storeRef.current) persist(storeRef.current);
        return;
      }
      if (typing) return;
      if (presenting) {
        if (["ArrowRight", "PageDown", " "].includes(e.key)) {
          e.preventDefault();
          goStep(1);
        } else if (["ArrowLeft", "PageUp"].includes(e.key)) {
          e.preventDefault();
          goStep(-1);
        } else if (e.key === "Escape") {
          setPresenting(null);
        }
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        setTab("models");
        setTimeout(() => searchRef.current?.focus(), 0);
      } else if (e.key === "Escape") {
        setSelected(null);
      } else if (e.key === "f" && selected) {
        setFitRequest((n) => n + 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ---------- render ----------
  if (loadError) {
    return (
      <div className="mm-fatal">
        <h1>The model map could not load</h1>
        <p>{loadError}</p>
        <p className="mm-muted">Check the Rails log for the request to the schema endpoint, then reload this page.</p>
      </div>
    );
  }

  if (!schema || !store) {
    return <div className="mm-loading">Reading models</div>;
  }

  const selectedModel = selected ? byName.get(selected) : null;
  const chrome = !presenting;

  const saveLabel = {
    saved: api.writable ? `Saved to ${boot.storePath || "config/model_map.json"}` : null,
    dirty: "Saving soon",
    saving: "Saving",
    error: `Not saved: ${saveError}`,
    draft: "Changes kept in this browser",
  }[saveState];

  return (
    <div className={`mm-app${presenting ? " is-presenting" : ""}${chrome && selectedModel && view === "2d" ? " has-detail" : ""}`}>
      <EdgeMarkers />

      {chrome ? (
        <header className="mm-toolbar">
          <div className="mm-brand">
            <h1>{schema.app || boot.title}</h1>
            <span className="mm-sub">
              {schema.models.length} models
              {api.isStatic ? `, snapshot from ${new Date(boot.exportedAt).toLocaleString()}` : null}
            </span>
          </div>

          <div className="mm-toolbar-mid">
            <div className="mm-segmented" role="group" aria-label="Detail level">
              <button type="button" aria-pressed={!plain} onClick={() => setPlain(false)}>
                Technical
              </button>
              <button type="button" aria-pressed={plain} onClick={() => setPlain(true)}>
                Plain language
              </button>
            </div>
            <div className="mm-segmented" role="group" aria-label="View">
              <button type="button" aria-pressed={view === "2d"} onClick={() => setView("2d")}>
                Map
              </button>
              <button type="button" aria-pressed={view === "3d"} onClick={() => setView("3d")}>
                3D
              </button>
            </div>
          </div>

          <div className="mm-toolbar-end">
            {!api.isStatic && api.pollInterval ? (
              <span className={`mm-live is-${live}`} title={live === "ok" ? "Watching for model changes" : "Lost contact with the server"}>
                {live === "ok" ? "Live" : "Offline"}
              </span>
            ) : null}
            {saveLabel ? <span className={`mm-save is-${saveState}`}>{saveLabel}</span> : null}
            <label className="mm-check">
              <input
                type="checkbox"
                checked={showLabels}
                onChange={(e) => {
                  setShowLabels(e.target.checked);
                  setPref("labels", e.target.checked);
                }}
              />
              Labels
            </label>
            <button
              type="button"
              className="mm-button"
              disabled={arranging || view !== "2d"}
              onClick={async () => {
                setArranging(true);
                await runAutoLayout(visibleModels);
                setArranging(false);
                setFitRequest((n) => n + 1);
              }}
              title="Recompute positions for every visible model"
            >
              {arranging ? "Arranging" : "Arrange"}
            </button>
            <button type="button" className="mm-button" onClick={() => downloadJSON("model_map.json", cleanStoreForSave(store))} title="Download layout, groups, descriptions, and tours as JSON">
              Download layout
            </button>
            {api.exportUrl ? (
              <a className="mm-button" href={api.exportUrl} title="One HTML file that opens without a server">
                Offline copy
              </a>
            ) : null}
            <button
              type="button"
              className="mm-icon-button"
              onClick={() => setTheme(theme === "auto" ? "dark" : theme === "dark" ? "light" : "auto")}
              aria-label={`Theme: ${theme}`}
              title={`Theme: ${theme}`}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
                <path d="M8 2.5a5.5 5.5 0 010 11z" fill="currentColor" />
              </svg>
            </button>
            <button type="button" className="mm-button is-primary" onClick={() => setPresenting({ free: true })}>
              Present
            </button>
          </div>
        </header>
      ) : null}

      {chrome && (usingDraft || schema.load_errors?.length || store.error) ? (
        <div className="mm-banners">
          {schema.load_errors?.map((e) => (
            <p key={e.file} className="mm-banner is-error">
              <strong>{e.file}</strong> did not load, so {e.constant} is missing from the map. {e.error}
            </p>
          ))}
          {store.error ? <p className="mm-banner is-error">{store.error}</p> : null}
          {usingDraft ? (
            <p className="mm-banner">
              {api.writable
                ? "Showing layout changes saved in this browser."
                : "Saving to the repo is off here, so layout changes are kept in this browser. Download the layout and commit it to share them."}{" "}
              <button
                type="button"
                className="mm-link"
                onClick={() => {
                  clearDraft(draftKey);
                  window.location.reload();
                }}
              >
                Discard browser changes
              </button>
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mm-body">
        {chrome ? (
          <Sidebar
            tab={tab}
            onTab={setTab}
            query={query}
            onQuery={setQuery}
            searchRef={searchRef}
            models={schema.models}
            groupOf={groupOfMemo}
            groupColors={groupColors}
            hiddenGroups={hiddenGroups}
            hiddenModels={hiddenModels}
            onToggleGroup={toggleGroupHidden}
            onToggleModel={toggleModelHidden}
            selected={selected}
            onSelect={(n) => select(n)}
            plain={plain}
            toursProps={toursProps}
          />
        ) : null}

        <main className="mm-canvas">
          {view === "2d" ? (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodesChange={onNodesChange}
              onNodeClick={(_, node) => {
                if (node.type === "model") select(node.id);
              }}
              onNodeDoubleClick={(_, node) => node.type === "model" && select(node.id)}
              onPaneClick={() => setSelected(null)}
              minZoom={0.08}
              maxZoom={2.5}
              fitView
              fitViewOptions={{ padding: 0.12 }}
              proOptions={{ hideAttribution: true }}
              nodesConnectable={false}
              elevateNodesOnSelect={false}
              onlyRenderVisibleElements={schema.models.length > 150}
            >
              <Background gap={24} size={1.2} color="var(--grid)" />
              {chrome ? <Controls showInteractive={false} position="bottom-right" /> : null}
              {chrome ? <MiniMap position="bottom-right" pannable zoomable nodeColor={(n) => (n.type === "zone" ? "transparent" : n.data?.color || "#999")} nodeStrokeWidth={0} style={{ marginRight: 56 }} /> : null}
            </ReactFlow>
          ) : (
            <Suspense fallback={<div className="mm-loading">Loading the 3D view</div>}>
              <ThreeView
                models={visibleModels}
                edges={visibleEdges.filter((e) => e.kind !== EDGE_KINDS.through)}
                groupOf={groupOfMemo}
                groupColors={groupColors}
                selected={selected}
                focusSet={focusSet}
                onSelect={(n) => select(n, { fit: false })}
                plain={plain}
                theme={theme}
              />
            </Suspense>
          )}

          {chrome && view === "2d" ? <Legend /> : null}

          {presenting ? (
            <div className="mm-present-bar">
              {step ? (
                <div className="mm-caption" key={step.id}>
                  <p className="mm-caption-count">
                    {activeTour.name}, step {presenting.index + 1} of {activeTour.steps.length}
                  </p>
                  <h2>{step.title}</h2>
                  {step.note ? <p className="mm-caption-note">{step.note}</p> : null}
                </div>
              ) : (
                <div className="mm-caption">
                  <h2>{schema.app || boot.title}</h2>
                  <p className="mm-caption-note">Click a model to focus it. Press Esc to leave.</p>
                </div>
              )}
              <div className="mm-present-controls">
                {activeTour ? (
                  <>
                    <button type="button" className="mm-button" disabled={presenting.index === 0} onClick={() => goStep(-1)}>
                      Previous
                    </button>
                    <button type="button" className="mm-button is-primary" disabled={presenting.index >= activeTour.steps.length - 1} onClick={() => goStep(1)}>
                      Next
                    </button>
                  </>
                ) : null}
                <div className="mm-segmented" role="group" aria-label="Detail level">
                  <button type="button" aria-pressed={!plain} onClick={() => setPlain(false)}>
                    Technical
                  </button>
                  <button type="button" aria-pressed={plain} onClick={() => setPlain(true)}>
                    Plain
                  </button>
                </div>
                <button type="button" className="mm-button" onClick={() => setPresenting(null)}>
                  Exit
                </button>
              </div>
            </div>
          ) : null}

          {toast ? (
            <div className="mm-toast" role="status" key={toast.at}>
              {toast.text}
            </div>
          ) : null}
        </main>

        {chrome && selectedModel ? (
          <DetailPanel
            model={selectedModel}
            schema={schema}
            meta={modelMeta(store, selectedModel.name)}
            group={groupOfMemo(selectedModel)}
            groups={groupColors}
            plain={plain}
            writable={api.writable}
            edges={allEdges}
            onClose={() => setSelected(null)}
            onSelect={(n) => select(n)}
            onUpdateMeta={updateMeta}
          />
        ) : null}
      </div>
    </div>
  );
}

export default function App({ boot }) {
  return (
    <ReactFlowProvider>
      <MapApp boot={boot} />
    </ReactFlowProvider>
  );
}
