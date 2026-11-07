// Watch Roulette. Signed-in lists live in Django. Guests get a working list held in page memory.
(() => {
  const root = document.getElementById("roulette");
  const { el } = SQ;
  const $ = (id) => document.getElementById(id);
  const canvas = $("wheel");
  const ctx = canvas.getContext("2d");
  const MAX_SEGMENTS = 12;
  const SPIN_MS = 3600;
  const SEGMENT_COLORS = ["#f87171", "#fb923c", "#fbbf24", "#a3e635", "#34d399", "#2dd4bf", "#38bdf8", "#818cf8", "#c084fc", "#f472b6"];
  const SUGGESTED_GENRES = ["Action", "Animation", "Comedy", "Crime", "Documentary", "Drama", "Fantasy", "Horror", "Romance", "Sci-Fi", "Thriller"];
  const SUGGESTED_LANGUAGES = ["English", "Hindi", "Telugu", "Tamil", "Urdu", "Japanese", "Korean", "French", "Spanish"];

  let titles = [];
  let list = "watchlist";
  let segments = [];
  let rotation = 0; // Radians.
  let spinning = false;
  let picked = null;
  let nextGuestId = -1;

  /** Same operations against the server or against page memory. */
  const store = SQ.isAuth ? {
    load: async () => (await SQ.api(root.dataset.titlesUrl)).titles,
    add: (data) => SQ.api(root.dataset.titlesUrl, { method: "POST", data }),
    update: (id, data) => SQ.api(`${root.dataset.titlesUrl}${id}/`, { method: "PATCH", data }),
    remove: (id) => SQ.api(`${root.dataset.titlesUrl}${id}/`, { method: "DELETE" }),
  } : {
    load: async () => [],
    add: async (data) => {
      if (titles.some((t) => t.name.toLowerCase() === data.name.toLowerCase() && t.kind === data.kind)) {
        throw new Error("That's already on your list.");
      }
      return { ...data, id: (nextGuestId -= 1), favourite: false, watched_at: data.watched ? new Date().toISOString() : null };
    },
    update: async (id, data) => {
      const merged = { ...titles.find((t) => t.id === id), ...data };
      if ("watched" in data) merged.watched_at = data.watched ? new Date().toISOString() : null;
      return merged;
    },
    remove: async () => ({}),
  };

  function candidates() {
    return titles.filter((t) => (!$("f-genre").value || t.genre === $("f-genre").value)
      && (!$("f-language").value || t.language === $("f-language").value)
      && (!$("f-kind").value || t.kind === $("f-kind").value)
      && (!$("f-unwatched").checked || !t.watched)
      && (!$("f-favourites").checked || t.favourite));
  }

  const randomIndex = (size) => {
    // Rejection sampling keeps the pick perfectly uniform.
    const limit = Math.floor(2 ** 32 / size) * size;
    const values = new Uint32Array(1);
    do { crypto.getRandomValues(values); } while (values[0] >= limit);
    return values[0] % size;
  };

  function shuffle(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = randomIndex(i + 1);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function drawWheel() {
    const { width } = canvas;
    const center = width / 2;
    const radius = center - 6;
    const style = getComputedStyle(root);
    ctx.clearRect(0, 0, width, width);
    if (!segments.length) {
      ctx.fillStyle = style.getPropertyValue("--surface-2");
      ctx.beginPath(); ctx.arc(center, center, radius, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = style.getPropertyValue("--muted");
      ctx.font = "500 20px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(titles.length ? "Nothing matches these filters" : "Add a title to get spinning", center, center + 6);
      return;
    }
    const arc = (Math.PI * 2) / segments.length;
    segments.forEach((segment, i) => {
      // Angle 0 is at 12 o'clock, under the pointer.
      const start = rotation + i * arc - Math.PI / 2;
      ctx.fillStyle = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
      ctx.beginPath(); ctx.moveTo(center, center); ctx.arc(center, center, radius, start, start + arc); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#0a0a0a"; ctx.lineWidth = 2; ctx.stroke();
      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(start + arc / 2);
      ctx.fillStyle = "#0a0a0a";
      ctx.font = `600 ${segments.length > 8 ? 15 : 18}px Inter, sans-serif`;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      const label = segment.name.length > 20 ? `${segment.name.slice(0, 19)}…` : segment.name;
      ctx.fillText(label, radius - 14, 0);
      ctx.restore();
    });
    ctx.fillStyle = style.getPropertyValue("--surface");
    ctx.beginPath(); ctx.arc(center, center, 24, 0, Math.PI * 2); ctx.fill();
  }

  function refreshWheel() {
    if (spinning) return;
    const pool = candidates();
    segments = shuffle(pool).slice(0, MAX_SEGMENTS);
    rotation = 0;
    $("candidate-count").textContent = `${pool.length} title${pool.length === 1 ? "" : "s"} in the running`
      + (pool.length > MAX_SEGMENTS ? `. The wheel shows ${MAX_SEGMENTS}, and every title has an equal chance.` : "");
    $("spin").disabled = pool.length === 0;
    drawWheel();
  }

  function spin() {
    const pool = candidates();
    if (spinning || !pool.length) return;
    // The winner is drawn from the whole pool first. The wheel is then arranged to land on it.
    picked = pool[randomIndex(pool.length)];
    const others = shuffle(pool.filter((t) => t !== picked)).slice(0, MAX_SEGMENTS - 1);
    segments = shuffle([picked, ...others]);
    const arc = (Math.PI * 2) / segments.length;
    const winner = segments.indexOf(picked);
    // Land somewhere inside the slice, not always dead centre.
    const inside = arc * (0.15 + Math.random() * 0.7);
    const target = -(winner * arc + inside);
    $("result").hidden = true;

    if (SQ.prefersReducedMotion()) {
      rotation = target;
      drawWheel();
      showResult();
      return;
    }
    spinning = true;
    $("spin").disabled = true;
    const from = rotation % (Math.PI * 2);
    const turns = 5 * Math.PI * 2;
    const distance = target - turns - from;
    const started = performance.now();
    const animate = (now) => {
      const t = Math.min(1, (now - started) / SPIN_MS);
      rotation = from + distance * (1 - (1 - t) ** 4);
      drawWheel();
      if (t < 1) requestAnimationFrame(animate);
      else {
        spinning = false;
        $("spin").disabled = false;
        showResult();
      }
    };
    requestAnimationFrame(animate);
  }

  function showResult() {
    $("result").hidden = false;
    $("result-name").textContent = picked.name;
    $("result-meta").textContent = `${picked.kind === "series" ? "Series" : "Movie"} · ${picked.genre} · ${picked.language}`;
    $("result-watched").hidden = picked.watched;
  }

  function syncFilterOptions() {
    const fill = (select, values, anyLabel) => {
      const current = select.value;
      select.replaceChildren(el("option", { value: "", text: anyLabel }), ...values.map((value) => el("option", { value, text: value })));
      select.value = values.includes(current) ? current : "";
    };
    const unique = (key) => [...new Set(titles.map((t) => t[key]))].sort((a, b) => a.localeCompare(b));
    fill($("f-genre"), unique("genre"), "Any");
    fill($("f-language"), unique("language"), "Any");
    const options = (id, values) => $(id).replaceChildren(...values.map((value) => el("option", { value })));
    options("genre-options", [...new Set([...unique("genre"), ...SUGGESTED_GENRES])]);
    options("language-options", [...new Set([...unique("language"), ...SUGGESTED_LANGUAGES])]);
  }

  const LISTS = {
    watchlist: { filter: (t) => !t.watched, empty: ["film", "Nothing to watch yet. Add a title above."] },
    history: { filter: (t) => t.watched, empty: ["clock-history", "Titles you've watched appear here."] },
    favourites: { filter: (t) => t.favourite, empty: ["star", "Star a title to keep it here."] },
  };

  function titleRow(title) {
    const meta = [title.kind === "series" ? "Series" : "Movie", title.genre, title.language];
    if (list === "history" && title.watched_at) meta.push(new Date(title.watched_at).toLocaleDateString());
    return el("div", { class: "title-row" },
      el("div", { class: "title-info" },
        el("div", { class: "title-name", text: title.name }),
        el("div", { class: "title-meta", text: meta.join(" · ") })),
      el("select", {
        class: "form-select form-select-sm", "aria-label": `Rating for ${title.name}`,
        onchange: (event) => change(title, { rating: event.target.value ? Number(event.target.value) : null }),
      }, el("option", { value: "", text: "Rate", selected: !title.rating }),
      [...Array(10)].map((_, i) => el("option", { value: i + 1, text: `${i + 1} / 10`, selected: title.rating === i + 1 }))),
      el("button", {
        class: `icon-btn${title.favourite ? " is-on" : ""}`, type: "button",
        "aria-label": `${title.favourite ? "Unfavourite" : "Favourite"} ${title.name}`, "aria-pressed": String(title.favourite),
        onclick: () => change(title, { favourite: !title.favourite }),
      }, el("i", { class: `bi bi-star${title.favourite ? "-fill" : ""}` })),
      el("button", {
        class: `icon-btn${title.watched ? " is-done" : ""}`, type: "button",
        "aria-label": `Mark ${title.name} as ${title.watched ? "unwatched" : "watched"}`, "aria-pressed": String(title.watched),
        onclick: () => change(title, { watched: !title.watched }),
      }, el("i", { class: `bi bi-${title.watched ? "check-circle-fill" : "circle"}` })),
      el("button", {
        class: "icon-btn", type: "button", "aria-label": `Delete ${title.name}`,
        onclick: () => removeTitle(title),
      }, el("i", { class: "bi bi-trash" })));
  }

  function renderList() {
    const { filter, empty } = LISTS[list];
    const rows = titles.filter(filter);
    if (list === "history") rows.sort((a, b) => (b.watched_at || "").localeCompare(a.watched_at || ""));
    $("title-list").replaceChildren(...(rows.length ? rows.map(titleRow) : [SQ.emptyState(...empty)]));
    Object.entries(LISTS).forEach(([name, config]) => { $(`n-${name}`).textContent = titles.filter(config.filter).length; });
  }

  function refreshAll() {
    syncFilterOptions();
    renderList();
    refreshWheel();
  }

  async function change(title, data) {
    try {
      const updated = await store.update(title.id, data);
      titles = titles.map((t) => (t.id === title.id ? updated : t));
      if (picked && picked.id === title.id) picked = updated;
      refreshAll();
    } catch (error) { SQ.toast(error.message, "error"); }
  }

  async function removeTitle(title) {
    try {
      await store.remove(title.id);
      titles = titles.filter((t) => t.id !== title.id);
      SQ.toast(`Removed ${title.name}`, "success");
      refreshAll();
    } catch (error) { SQ.toast(error.message, "error"); }
  }

  $("add-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const rating = $("a-rating").value;
    try {
      const created = await store.add({
        name: $("a-name").value.trim(), kind: $("a-kind").value, genre: $("a-genre").value.trim(),
        language: $("a-language").value.trim(), rating: rating ? Number(rating) : null, watched: $("a-watched").checked,
      });
      titles = [created, ...titles];
      $("a-name").value = "";
      $("a-rating").value = "";
      $("a-watched").checked = false;
      $("a-name").focus();
      SQ.toast(`Added ${created.name}`, "success");
      refreshAll();
    } catch (error) { SQ.toast(error.message, "error"); }
  });

  $("list-tabs").addEventListener("click", (event) => {
    const button = event.target.closest("[data-list]");
    if (!button) return;
    list = button.dataset.list;
    $("list-tabs").querySelectorAll("[data-list]").forEach((b) => b.classList.toggle("active", b === button));
    renderList();
  });
  ["f-genre", "f-language", "f-kind", "f-unwatched", "f-favourites"].forEach((id) => $(id).addEventListener("change", refreshWheel));
  $("spin").addEventListener("click", spin);
  $("result-watched").addEventListener("click", () => { if (picked) change(picked, { watched: true }); $("result-watched").hidden = true; });
  document.addEventListener("sq:themechange", drawWheel);

  const ratingSelect = $("a-rating");
  for (let n = 1; n <= 10; n += 1) ratingSelect.append(el("option", { value: n, text: `${n} / 10` }));

  (async () => {
    try {
      titles = await store.load();
    } catch (error) { SQ.toast(error.message, "error"); }
    refreshAll();
  })();
})();
