// Data access. "live" mode talks to the Rails engine; "static" mode reads the
// schema and layout embedded in an exported HTML file.

export function readBootstrap() {
  const el = document.getElementById("model-map-bootstrap");
  try {
    return el ? JSON.parse(el.textContent) : {};
  } catch {
    return {};
  }
}

export function createApi(boot) {
  const isStatic = boot.mode === "static";

  async function getJSON(url) {
    const res = await fetch(url, { headers: { Accept: "application/json" }, credentials: "same-origin" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `${res.status} ${res.statusText}`);
    return body;
  }

  return {
    isStatic,
    writable: !!boot.writable && !isStatic,
    pollInterval: isStatic ? 0 : boot.pollInterval || 0,

    async schema() {
      if (isStatic) return boot.schema;
      return getJSON(boot.endpoints.schema);
    },

    async fingerprint() {
      if (isStatic) return boot.schema?.fingerprint;
      const body = await getJSON(boot.endpoints.fingerprint);
      return body.fingerprint;
    },

    async store() {
      if (isStatic) return boot.store || {};
      return getJSON(boot.endpoints.store);
    },

    async saveStore(data) {
      const res = await fetch(boot.endpoints.store, {
        method: "PUT",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-CSRF-Token": boot.csrfToken || "",
        },
        body: JSON.stringify(data),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `${res.status} ${res.statusText}`);
      return body;
    },

    exportUrl: isStatic ? null : boot.endpoints?.export,
  };
}

export function downloadJSON(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2) + "\n"], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const DRAFT_PREFIX = "model-map-draft:";

export function loadDraft(key) {
  try {
    const raw = localStorage.getItem(DRAFT_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveDraft(key, data) {
  try {
    localStorage.setItem(DRAFT_PREFIX + key, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    /* storage unavailable: drafts are a convenience only */
  }
}

export function clearDraft(key) {
  try {
    localStorage.removeItem(DRAFT_PREFIX + key);
  } catch {
    /* ignore */
  }
}

export function getPref(key, fallback) {
  try {
    const v = localStorage.getItem("model-map-pref:" + key);
    return v === null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

export function setPref(key, value) {
  try {
    localStorage.setItem("model-map-pref:" + key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}
