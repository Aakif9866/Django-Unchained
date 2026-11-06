// Notes. Every edit autosaves, and saves for one note always go out in order.
(() => {
  const root = document.getElementById("notes");
  const { el } = SQ;
  const $ = (id) => document.getElementById(id);
  const AUTOSAVE_MS = 600;
  const base = root.dataset.itemsUrl;

  let notes = [];
  let activeId = null;
  let timer = null;
  let dirty = false;
  let saveChain = Promise.resolve();

  const active = () => notes.find((n) => n.id === activeId);
  const displayTitle = (note) => note.title.trim() || "Untitled";

  function sorted(list) {
    return [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updated_at.localeCompare(a.updated_at));
  }

  function renderList() {
    const query = $("search").value.trim().toLowerCase();
    const visible = sorted(notes).filter((n) => `${n.title}\n${n.body}`.toLowerCase().includes(query));
    if (!visible.length) {
      const message = notes.length ? "No notes match that search." : "No notes yet. Press New to write one.";
      $("note-list").replaceChildren(SQ.emptyState("journal", message));
      return;
    }
    $("note-list").replaceChildren(...visible.map((note) => el("button", {
      class: `note-item${note.id === activeId ? " is-active" : ""}`, type: "button",
      "aria-current": note.id === activeId ? "true" : undefined, onclick: () => openNote(note.id),
    },
    el("div", { class: "name" }, note.pinned ? el("i", { class: "bi bi-pin-fill" }) : null, displayTitle(note)),
    el("div", { class: "snippet", text: note.body.slice(0, 80) || "Empty" }))));
  }

  function setStatus(text) { $("save-status").textContent = text; }

  function updateCounts() {
    const text = $("note-body").value;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    $("word-count").textContent = `${words} word${words === 1 ? "" : "s"} · ${text.length} character${text.length === 1 ? "" : "s"}`;
  }

  function renderPin(pinned) {
    $("pin").setAttribute("aria-pressed", String(pinned));
    $("pin").querySelector("i").className = `bi bi-pin-angle${pinned ? "-fill" : ""}`;
  }

  function showEditor() {
    const note = active();
    $("editor").hidden = !note;
    $("editor-empty").hidden = Boolean(note);
    if (!note) {
      $("editor-empty").replaceChildren(SQ.emptyState("pencil", notes.length ? "Pick a note to open it." : "Your notes will live here."));
      return;
    }
    $("note-title").value = note.title;
    $("note-body").value = note.body;
    renderPin(note.pinned);
    updateCounts();
    setStatus(`Saved ${new Date(note.updated_at).toLocaleString()}`);
  }

  /** Queue a PATCH so an older save can never land after a newer one. */
  function patch(id, data, { keepalive = false } = {}) {
    saveChain = saveChain.then(async () => {
      const saved = await SQ.api(`${base}${id}/`, { method: "PATCH", data, keepalive });
      notes = notes.map((n) => (n.id === id ? { ...n, updated_at: saved.updated_at, pinned: saved.pinned } : n));
      return saved;
    });
    const result = saveChain;
    saveChain = saveChain.catch(() => {}); // A failed save must not block later ones.
    return result;
  }

  async function flush(options) {
    clearTimeout(timer);
    if (!dirty || !active()) return;
    dirty = false;
    const id = activeId;
    const data = { title: $("note-title").value, body: $("note-body").value };
    setStatus("Saving…");
    try {
      const saved = await patch(id, data, options);
      if (id === activeId && !dirty) setStatus(`Saved ${new Date(saved.updated_at).toLocaleTimeString()}`);
      renderList();
    } catch (error) {
      dirty = true; // Keep it marked, so the next edit or leaving the note tries again.
      setStatus(`Not saved: ${error.message}`);
      SQ.toast(`Note not saved: ${error.message}`, "error");
    }
  }

  function onEdit() {
    const note = active();
    if (!note) return;
    note.title = $("note-title").value;
    note.body = $("note-body").value;
    dirty = true;
    setStatus("Unsaved changes");
    updateCounts();
    clearTimeout(timer);
    timer = setTimeout(flush, AUTOSAVE_MS);
    renderList();
  }

  async function openNote(id) {
    await flush();
    activeId = id;
    showEditor();
    renderList();
  }

  $("new-note").addEventListener("click", async () => {
    await flush();
    try {
      const note = await SQ.api(base, { method: "POST", data: {} });
      notes.unshift(note);
      $("search").value = "";
      await openNote(note.id);
      $("note-title").focus();
    } catch (error) { SQ.toast(error.message, "error"); }
  });

  $("pin").addEventListener("click", async () => {
    const note = active();
    if (!note) return;
    try {
      const saved = await patch(note.id, { pinned: !note.pinned });
      note.pinned = saved.pinned;
      renderPin(saved.pinned);
      renderList();
    } catch (error) { SQ.toast(error.message, "error"); }
  });

  $("export").addEventListener("click", () => {
    const note = active();
    const name = displayTitle(note).replace(/[^\w -]+/g, "").trim().replaceAll(" ", "-") || "note";
    SQ.download(`${name}.txt`, `${note.title}\n\n${note.body}`);
  });

  $("confirm-delete").addEventListener("click", async () => {
    const id = activeId;
    clearTimeout(timer);
    dirty = false;
    try {
      await SQ.api(`${base}${id}/`, { method: "DELETE" });
      notes = notes.filter((n) => n.id !== id);
      activeId = null;
      showEditor();
      renderList();
      SQ.toast("Note deleted", "success");
    } catch (error) { SQ.toast(error.message, "error"); }
  });

  $("note-title").addEventListener("input", onEdit);
  $("note-body").addEventListener("input", onEdit);
  $("search").addEventListener("input", renderList);
  // Leaving or hiding the page saves right away. keepalive lets the request outlive the page.
  document.addEventListener("visibilitychange", () => { if (document.hidden) flush({ keepalive: true }); });
  window.addEventListener("beforeunload", (event) => {
    if (dirty) {
      flush({ keepalive: true });
      event.preventDefault();
    }
  });

  (async () => {
    try {
      notes = (await SQ.api(base)).notes;
    } catch (error) {
      $("note-list").replaceChildren(SQ.emptyState("wifi-off", error.message));
      return;
    }
    activeId = notes[0] ? sorted(notes)[0].id : null;
    showEditor();
    renderList();
  })();
})();
