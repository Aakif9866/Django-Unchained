// JSON Doctor interface. Parsing and conversion live in json-core.js.
(() => {
  const { el } = SQ;
  const $ = (id) => document.getElementById(id);
  const editor = $("editor");
  const SAMPLE = {
    quest: "Learn the JSON", reward: { xp: 120, title: "Bracket Whisperer" }, completed: false,
    party: [{ name: "Ada", level: 12, tags: ["math", "engines"] }, { name: "Grace", level: 15, tags: ["compilers"] }],
    notes: null,
  };
  const NODE_LIMIT = 5000; // Very wide documents render this many nodes, then say so.
  let debounce = null;
  let lastGood = null;

  const indent = () => ($("indent").value === "tab" ? "\t" : Number($("indent").value));

  function renderGutter(errorLine) {
    const lines = editor.value.split("\n").length;
    const fragment = document.createDocumentFragment();
    for (let n = 1; n <= lines; n += 1) {
      fragment.append(el("div", { class: n === errorLine ? "is-error" : "", text: n }));
    }
    $("gutter").replaceChildren(fragment);
    $("gutter").scrollTop = editor.scrollTop;
  }

  function jumpTo(position) {
    editor.focus();
    editor.setSelectionRange(position, position + 1);
    const line = editor.value.slice(0, position).split("\n").length;
    const lineHeight = parseFloat(getComputedStyle(editor).lineHeight);
    editor.scrollTop = Math.max(0, (line - 3) * lineHeight);
  }

  function setStatus(kind, message, error) {
    const status = $("status");
    status.className = `status-bar ${kind === "ok" ? "is-ok" : kind === "bad" ? "is-bad" : "text-muted"}`;
    status.replaceChildren(el("i", { class: `bi bi-${kind === "ok" ? "check-circle" : kind === "bad" ? "x-octagon" : "braces"} me-1` }), message);
    if (error) {
      status.append(" ", el("button", { type: "button", text: `Line ${error.line}, column ${error.column}`, onclick: () => jumpTo(error.position) }));
    }
  }

  /** Validates the editor and refreshes status, gutter and tree. Returns the parse result. */
  function refresh() {
    const result = JsonCore.parse(editor.value);
    if (result.empty) {
      setStatus("idle", "Paste some JSON to begin.");
      renderGutter();
      renderTree(undefined);
    } else if (result.ok) {
      const size = new Blob([editor.value]).size;
      setStatus("ok", `Valid JSON · ${size.toLocaleString()} bytes`);
      renderGutter();
      renderTree(result.value);
    } else {
      setStatus("bad", `${result.error.message}.`, result.error);
      renderGutter(result.error.line);
    }
    return result;
  }

  function leaf(value) {
    if (typeof value === "string") return el("span", { class: "s", text: JSON.stringify(value) });
    if (typeof value === "number") return el("span", { class: "n", text: String(value) });
    if (typeof value === "boolean") return el("span", { class: "b", text: String(value) });
    return el("span", { class: "z", text: "null" });
  }

  function node(key, value, budget) {
    const label = key === null ? [] : [el("span", { class: "k", text: Array.isArray(key) ? key[0] : JSON.stringify(key) }), ": "];
    if (value === null || typeof value !== "object") return el("div", { class: "leaf" }, label, leaf(value));
    const isArray = Array.isArray(value);
    const entries = isArray ? value.map((v, i) => [[String(i)], v]) : Object.entries(value);
    const details = el("details", {},
      el("summary", {}, label, isArray ? "[ ]" : "{ }", el("span", { class: "meta", text: `${entries.length} ${isArray ? "item" : "key"}${entries.length === 1 ? "" : "s"}` })));
    // Children render on first open, so huge documents stay responsive.
    let built = false;
    const build = () => {
      if (built) return;
      built = true;
      for (const [childKey, childValue] of entries) {
        if (budget.left <= 0) {
          details.append(el("div", { class: "leaf z", text: "Too large to show every node." }));
          break;
        }
        budget.left -= 1;
        details.append(node(childKey, childValue, budget));
      }
    };
    details.addEventListener("toggle", () => { if (details.open) build(); });
    details.buildChildren = build;
    return details;
  }

  function renderTree(value) {
    lastGood = value;
    const tree = $("tree");
    if (value === undefined) {
      tree.replaceChildren(SQ.emptyState("diagram-3", "Valid JSON appears here as a tree."));
      return;
    }
    // Keep the user's open branches on re-render where we can: simply open the root.
    const root = node(null, value, { left: NODE_LIMIT });
    tree.replaceChildren(root);
    if (root.tagName === "DETAILS") { root.buildChildren(); root.open = true; }
  }

  function setAll(open) {
    const tree = $("tree");
    if (open) {
      // Building children reveals more details elements, so walk until none are left to open.
      let budget = NODE_LIMIT;
      let closed;
      while (budget > 0 && (closed = tree.querySelectorAll("details:not([open])")).length) {
        for (const details of closed) {
          details.buildChildren();
          details.open = true;
          budget -= 1;
        }
      }
    } else {
      tree.querySelectorAll("details").forEach((details) => { details.open = false; });
      const root = tree.firstElementChild;
      if (root && root.tagName === "DETAILS") root.open = true;
    }
  }

  function requireValid() {
    const result = refresh();
    if (result.ok) return result;
    if (result.empty) SQ.toast("Nothing to work with yet.", "error");
    else {
      SQ.toast(`Line ${result.error.line}: ${result.error.message}`, "error");
      jumpTo(result.error.position);
    }
    return null;
  }

  function setEditor(text) {
    editor.value = text;
    editor.scrollTop = 0;
    refresh();
  }

  $("format").addEventListener("click", () => {
    const result = requireValid();
    if (result) setEditor(JSON.stringify(result.value, null, indent()));
  });
  $("minify").addEventListener("click", () => {
    const result = requireValid();
    if (result) setEditor(JSON.stringify(result.value));
  });
  $("validate").addEventListener("click", () => {
    if (requireValid()) SQ.toast("This JSON is valid", "success");
  });
  $("copy").addEventListener("click", () => {
    if (editor.value) SQ.copy(editor.value, "JSON copied");
    else SQ.toast("Nothing to copy.", "error");
  });
  $("download").addEventListener("click", () => {
    if (requireValid()) SQ.download("sidequest.json", editor.value, "application/json");
  });
  $("sample").addEventListener("click", () => setEditor(JSON.stringify(SAMPLE, null, 2)));
  $("clear").addEventListener("click", () => { setEditor(""); editor.focus(); });
  $("expand").addEventListener("click", () => setAll(true));
  $("collapse").addEventListener("click", () => setAll(false));

  $("to-csv").addEventListener("click", () => {
    const result = requireValid();
    if (!result) return;
    try {
      $("csv").value = JsonCore.toCsv(result.value);
      SQ.toast("Converted to CSV", "success");
    } catch (error) { SQ.toast(error.message, "error"); }
  });
  $("from-csv").addEventListener("click", () => {
    try {
      setEditor(JSON.stringify(JsonCore.csvToJson($("csv").value), null, indent()));
      SQ.toast("Converted to JSON", "success");
    } catch (error) { SQ.toast(error.message, "error"); }
  });
  $("copy-csv").addEventListener("click", () => {
    if ($("csv").value) SQ.copy($("csv").value, "CSV copied");
    else SQ.toast("Nothing to copy.", "error");
  });
  $("download-csv").addEventListener("click", () => {
    if ($("csv").value) SQ.download("sidequest.csv", $("csv").value, "text/csv");
    else SQ.toast("Nothing to download.", "error");
  });

  editor.addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(refresh, 200);
  });
  editor.addEventListener("scroll", () => { $("gutter").scrollTop = editor.scrollTop; });
  editor.addEventListener("keydown", (event) => {
    if (event.key === "Tab" && !event.shiftKey) {
      event.preventDefault();
      editor.setRangeText("  ", editor.selectionStart, editor.selectionEnd, "end");
    }
  });

  setEditor(JSON.stringify(SAMPLE, null, 2));
})();
