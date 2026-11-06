// Regex Playground. The engine runs in a worker; this file owns the interface.
(() => {
  const root = document.getElementById("regex");
  const { el } = SQ;
  const $ = (id) => document.getElementById(id);
  const TIMEOUT_MS = 1000;

  const EXAMPLES = [
    { name: "Email address", pattern: String.raw`[\w.+-]+@[\w-]+(?:\.[\w-]+)+`, flags: "g", text: "Write to ada@example.com or grace.h+news@navy.mil.\nNot an address: @nope, nope@" },
    { name: "URL", pattern: String.raw`https?:\/\/[^\s/$.?#][^\s]*`, flags: "gi", text: "Docs at https://docs.djangoproject.com/en/ and http://example.org?q=1\nftp://not-this.one" },
    { name: "IPv4 address", pattern: String.raw`\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b`, flags: "g", text: "Gateway 192.168.1.1, DNS 8.8.8.8, invalid 999.1.1.1" },
    { name: "ISO date (named groups)", pattern: String.raw`(?<year>\d{4})-(?<month>0[1-9]|1[0-2])-(?<day>0[1-9]|[12]\d|3[01])`, flags: "g", text: "Released 2026-11-07, patched 2026-12-31. Bad: 2026-13-01" },
    { name: "Hex colour", pattern: String.raw`#(?:[0-9a-f]{3}){1,2}\b`, flags: "gi", text: "Teal is #2dd4bf, short form #fff, and #12 is too short." },
    { name: "UUID", pattern: String.raw`\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b`, flags: "gi", text: "id=3f2b8c1e-7a4d-4e9b-9c11-2d5e8f7a6b10 and not-a-uuid-1234" },
    { name: "Phone number", pattern: String.raw`\+?\d{1,3}[ -]?\(?\d{3}\)?[ -]?\d{3}[ -]?\d{4}`, flags: "g", text: "Call +1 (555) 010-4477 or 91 98765 4 3210\nOffice: +44 203 555 0199" },
    { name: "HTML tag", pattern: String.raw`<([a-z][a-z0-9]*)\b[^>]*>`, flags: "gi", text: '<div class="card"><a href="#">Link</a></div>' },
    { name: "Repeated word", pattern: String.raw`\b(\w+)\s+\1\b`, flags: "gi", text: "This is is a test of the the backreference." },
  ];

  let worker = null;
  let pending = null;
  let requestId = 0;
  let debounce = null;

  const flags = () => [...$("flags").querySelectorAll("input:checked")].map((box) => box.value).join("");

  function startWorker() {
    worker = new Worker(root.dataset.workerUrl);
    worker.onmessage = ({ data }) => {
      if (!pending || data.id !== pending.id) return;
      clearTimeout(pending.timer);
      pending = null;
      if (data.error) showError(data.error);
      else showMatches(data.matches, data.capped);
    };
  }

  function evaluate() {
    const pattern = $("pattern").value;
    const text = $("test-text").value;
    $("flags-preview").textContent = flags();
    hideError();
    if (pending) { // A run is still busy: kill it, the input has moved on.
      clearTimeout(pending.timer);
      worker.terminate();
      startWorker();
      pending = null;
    }
    if (!pattern) {
      paint(text, []);
      $("match-count").textContent = "No pattern yet";
      $("matches").replaceChildren(SQ.emptyState("braces-asterisk", "Type a pattern, or pick a common one."));
      return;
    }
    const id = (requestId += 1);
    pending = {
      id,
      timer: setTimeout(() => {
        worker.terminate();
        startWorker();
        pending = null;
        showError(`Stopped after ${TIMEOUT_MS} ms. This pattern likely has catastrophic backtracking: look for nested quantifiers like (a+)+.`);
      }, TIMEOUT_MS),
    };
    worker.postMessage({ id, pattern, flags: flags(), text });
  }

  function showError(message) {
    $("regex-error").textContent = message;
    $("regex-error").hidden = false;
    $("pattern").classList.add("is-invalid");
    $("match-count").textContent = "Error";
    paint($("test-text").value, []);
    $("matches").replaceChildren(SQ.emptyState("exclamation-triangle", "Fix the pattern to see matches."));
  }

  function hideError() {
    $("regex-error").hidden = true;
    $("pattern").classList.remove("is-invalid");
  }

  function paint(text, matches) {
    const nodes = [];
    let cursor = 0;
    for (const match of matches) {
      if (!match.text) continue; // Nothing visible to highlight for empty matches.
      nodes.push(text.slice(cursor, match.index), el("mark", { text: match.text }));
      cursor = match.index + match.text.length;
    }
    nodes.push(text.slice(cursor), "\n"); // Trailing newline keeps the backdrop height honest.
    $("backdrop").replaceChildren(...nodes);
    $("backdrop").scrollTop = $("test-text").scrollTop;
  }

  function groupChips(match) {
    const named = Object.entries(match.named || {});
    const namedValues = new Set(named.map(([, value]) => value));
    const chips = named.map(([name, value]) => chip(name, value));
    match.groups.forEach((value, i) => {
      if (!namedValues.has(value)) chips.push(chip(`$${i + 1}`, value));
    });
    return chips.length ? chips : el("span", { class: "text-muted", text: "none" });
  }

  const chip = (label, value) => el("span", { class: "group-chip mono" },
    el("b", { text: label }), value === undefined ? "undefined" : value);

  function showMatches(matches, capped) {
    paint($("test-text").value, matches);
    const count = `${matches.length}${capped ? "+" : ""} match${matches.length === 1 ? "" : "es"}`;
    $("match-count").textContent = capped ? `${count} (showing the first ${matches.length})` : count;
    if (!matches.length) {
      $("matches").replaceChildren(SQ.emptyState("search", "No matches in this text."));
      return;
    }
    const rows = matches.slice(0, 200).map((match, i) => el("tr", {},
      el("td", { class: "text-muted", text: i + 1 }),
      el("td", { class: "mono", text: match.text || "(empty)" }),
      el("td", { class: "text-muted", text: match.index }),
      el("td", {}, groupChips(match))));
    $("matches").replaceChildren(el("table", { class: "table table-sm" },
      el("thead", {}, el("tr", {}, ["#", "Match", "Index", "Groups"].map((t) => el("th", { text: t })))),
      el("tbody", {}, rows)));
  }

  function schedule() {
    clearTimeout(debounce);
    debounce = setTimeout(evaluate, 120);
  }

  function load({ pattern, flags: newFlags, text }) {
    $("pattern").value = pattern;
    $("flags").querySelectorAll("input").forEach((box) => { box.checked = newFlags.includes(box.value); });
    if (text !== undefined) $("test-text").value = text;
    evaluate();
  }

  // Saved patterns (signed-in only)
  const savedBox = $("saved");

  function renderSaved(items) {
    if (!items.length) {
      savedBox.replaceChildren(SQ.emptyState("bookmark", "Nothing saved yet."));
      return;
    }
    savedBox.replaceChildren(...items.map((item) => el("div", { class: "saved-row" },
      el("button", { class: "load", type: "button", onclick: () => load(item) },
        el("span", { text: item.name }), el("small", { text: `/${item.pattern}/${item.flags}` })),
      el("button", {
        class: "icon-btn", type: "button", "aria-label": `Delete ${item.name}`,
        onclick: async () => {
          try {
            await SQ.api(`${root.dataset.patternsUrl}${item.id}/`, { method: "DELETE" });
            SQ.toast("Pattern deleted", "success");
            loadSaved();
          } catch (error) { SQ.toast(error.message, "error"); }
        },
      }, el("i", { class: "bi bi-trash" })))));
  }

  async function loadSaved() {
    try {
      renderSaved((await SQ.api(root.dataset.patternsUrl)).patterns);
    } catch (error) {
      savedBox.replaceChildren(SQ.emptyState("wifi-off", error.message));
    }
  }

  if (savedBox) {
    $("save-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!$("pattern").value) return SQ.toast("Type a pattern first.", "error");
      try {
        await SQ.api(root.dataset.patternsUrl, {
          method: "POST",
          data: { name: $("save-name").value, pattern: $("pattern").value, flags: flags() },
        });
        $("save-name").value = "";
        SQ.toast("Pattern saved", "success");
        loadSaved();
      } catch (error) { SQ.toast(error.message, "error"); }
    });
    loadSaved();
  }

  $("examples").replaceChildren(...EXAMPLES.map((example) =>
    el("button", { class: "example-btn", type: "button", text: example.name, onclick: () => load(example) })));
  $("pattern").addEventListener("input", schedule);
  $("test-text").addEventListener("input", schedule);
  $("flags").addEventListener("change", evaluate);
  $("test-text").addEventListener("scroll", () => { $("backdrop").scrollTop = $("test-text").scrollTop; });

  startWorker();
  load(EXAMPLES[0]);
})();
