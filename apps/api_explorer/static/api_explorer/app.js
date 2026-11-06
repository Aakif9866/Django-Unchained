// API Explorer interface. The request itself is made by Django, through the SSRF guard in safe_http.py.
(() => {
  const root = document.getElementById("explorer");
  const { el } = SQ;
  const $ = (id) => document.getElementById(id);
  let lastResponseText = "";

  function pairRow(list, name = "", value = "") {
    const row = el("div", { class: "pair-row" },
      el("input", { class: "form-control mono", placeholder: "name", value: name, "aria-label": "Name", maxLength: 4096, spellcheck: false }),
      el("input", { class: "form-control mono", placeholder: "value", value, "aria-label": "Value", maxLength: 4096, spellcheck: false }),
      el("button", { class: "icon-btn", type: "button", "aria-label": "Remove", onclick: () => row.remove() }, el("i", { class: "bi bi-x-lg" })));
    list.append(row);
  }

  const readPairs = (list) => [...list.querySelectorAll(".pair-row")]
    .map((row) => [...row.querySelectorAll("input")].map((input) => input.value))
    .filter(([name]) => name.trim())
    .map(([name, value]) => [name.trim(), value]);

  const setPairs = (list, pairs) => {
    list.replaceChildren();
    pairs.forEach(([name, value]) => pairRow(list, name, value));
  };

  function readRequest() {
    const usesBody = !["GET", "HEAD"].includes($("method").value);
    return {
      method: $("method").value,
      url: $("url").value.trim(),
      params: readPairs($("params")),
      headers: readPairs($("headers")),
      body: usesBody ? $("body").value : "",
    };
  }

  function loadRequest({ method, url, params = [], headers = [], body = "" }) {
    $("method").value = method;
    $("url").value = url;
    setPairs($("params"), params);
    setPairs($("headers"), headers);
    $("body").value = body;
    checkBody();
  }

  function checkBody() {
    const text = $("body").value.trim();
    const status = $("body-status");
    if (!text) { status.textContent = ""; return; }
    try {
      JSON.parse(text);
      status.textContent = "Valid JSON";
      status.style.color = "var(--success)";
    } catch (error) {
      status.textContent = `Not valid JSON: ${error.message}`;
      status.style.color = "var(--danger)";
    }
  }

  function clearResponse() {
    $("res-status").hidden = true;
    $("res-time").textContent = "";
    $("res-size").textContent = "";
    $("res-note").hidden = true;
    $("res-tabs").hidden = true;
    $("copy-response").hidden = true;
  }

  function showFailure(message) {
    clearResponse();
    $("res-empty").replaceChildren(SQ.emptyState("shield-exclamation", message));
  }

  function showResponse(result) {
    $("res-empty").replaceChildren();
    const badge = $("res-status");
    badge.hidden = false;
    badge.textContent = `${result.status} ${result.reason}`;
    badge.className = `sq-badge status-${Math.floor(result.status / 100)}`;
    $("res-time").textContent = `${result.elapsed_ms} ms`;
    $("res-size").textContent = `${result.size.toLocaleString()} bytes`;

    const notes = [];
    if (result.truncated) notes.push("Response was cut off at the 1 MB limit.");
    if (result.redirects.length) notes.push(`Followed ${result.redirects.length} redirect${result.redirects.length > 1 ? "s" : ""} to ${result.final_url}`);
    $("res-note").textContent = notes.join(" ");
    $("res-note").hidden = !notes.length;

    let raw = result.body;
    let pretty = raw;
    if (raw === null) {
      raw = pretty = "(Binary response. Not shown as text.)";
    } else if (raw === "") {
      raw = pretty = "(Empty response body.)";
    } else {
      try { pretty = JSON.stringify(JSON.parse(raw), null, 2); } catch { /* Not JSON, so show as is. */ }
    }
    lastResponseText = result.body ?? "";
    $("res-pretty").textContent = pretty;
    $("res-raw").textContent = raw;
    $("res-header-count").textContent = result.headers.length;
    $("res-headers").replaceChildren(el("tbody", {}, result.headers.map(([name, value]) =>
      el("tr", {}, el("td", { text: name }), el("td", { text: value })))));
    $("res-tabs").hidden = false;
    $("copy-response").hidden = !lastResponseText;
    bootstrap.Tab.getOrCreateInstance($("pretty-tab")).show();
  }

  async function send(event) {
    event.preventDefault();
    const button = $("send");
    const label = [...button.childNodes];
    button.disabled = true;
    button.replaceChildren(el("span", { class: "sq-spinner" }), " Sending");
    clearResponse();
    try {
      showResponse(await SQ.api(root.dataset.sendUrl, { method: "POST", data: readRequest() }));
    } catch (error) {
      showFailure(error.message);
    } finally {
      button.disabled = false;
      button.replaceChildren(...label);
      if (SQ.isAuth) loadHistory();
    }
  }

  // Saved requests and history (signed-in only).
  async function loadSaved() {
    const box = $("saved");
    try {
      const { saved } = await SQ.api(root.dataset.savedUrl);
      if (!saved.length) return box.replaceChildren(SQ.emptyState("bookmark", "Nothing saved yet."));
      box.replaceChildren(...saved.map((item) => el("div", { class: "list-row" },
        el("button", { class: "load", type: "button", onclick: () => loadRequest(item) },
          el("span", { text: item.name }),
          el("small", {}, el("span", { class: "method-tag", text: item.method }), item.url)),
        el("button", {
          class: "icon-btn", type: "button", "aria-label": `Delete ${item.name}`,
          onclick: async () => {
            try {
              await SQ.api(`${root.dataset.savedUrl}${item.id}/`, { method: "DELETE" });
              SQ.toast("Request deleted", "success");
              loadSaved();
            } catch (error) { SQ.toast(error.message, "error"); }
          },
        }, el("i", { class: "bi bi-trash" })))));
    } catch (error) {
      box.replaceChildren(SQ.emptyState("wifi-off", error.message));
    }
  }

  function renderHistory(history) {
    const box = $("history");
    if (!history.length) return box.replaceChildren(SQ.emptyState("clock-history", "Requests you send appear here."));
    box.replaceChildren(...history.map((log) => el("div", { class: "list-row" },
      el("button", { class: "load", type: "button", title: new Date(log.created_at).toLocaleString(), onclick: () => loadRequest({ method: log.method, url: log.url }) },
        el("small", {}, el("span", { class: "method-tag", text: log.method }), log.url),
        el("small", { text: log.status ? `${log.status} · ${log.elapsed_ms} ms` : "Failed" })))));
  }

  async function loadHistory() {
    try {
      renderHistory((await SQ.api(root.dataset.historyUrl)).history);
    } catch (error) {
      $("history").replaceChildren(SQ.emptyState("wifi-off", error.message));
    }
  }

  $("request-form").addEventListener("submit", send);
  $("add-param").addEventListener("click", () => pairRow($("params")));
  $("add-header").addEventListener("click", () => pairRow($("headers")));
  $("body").addEventListener("input", checkBody);
  $("format-body").addEventListener("click", () => {
    try {
      $("body").value = JSON.stringify(JSON.parse($("body").value), null, 2);
      checkBody();
    } catch (error) { SQ.toast(`Not valid JSON: ${error.message}`, "error"); }
  });
  $("copy-response").addEventListener("click", () => SQ.copy(lastResponseText, "Response copied"));

  if (SQ.isAuth) {
    $("save-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!$("url").value.trim()) return SQ.toast("Enter a URL first.", "error");
      try {
        await SQ.api(root.dataset.savedUrl, { method: "POST", data: { name: $("save-name").value, ...readRequest(), body: $("body").value } });
        $("save-name").value = "";
        SQ.toast("Request saved", "success");
        loadSaved();
      } catch (error) { SQ.toast(error.message, "error"); }
    });
    $("clear-history").addEventListener("click", async () => {
      try {
        renderHistory((await SQ.api(root.dataset.historyUrl, { method: "DELETE" })).history);
      } catch (error) { SQ.toast(error.message, "error"); }
    });
    loadSaved();
    loadHistory();
  }

  pairRow($("params"));
  pairRow($("headers"));
  $("res-empty").replaceChildren(SQ.emptyState("send", "Send a request to see the response."));
})();
