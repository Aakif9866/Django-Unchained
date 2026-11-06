// Shared browser helpers. Every mini-app builds on window.SQ rather than re-implementing these.
(() => {
  const body = document.body;
  const csrfToken = document.querySelector('meta[name="csrf-token"]').content;

  /** Build a DOM node. Text always goes through textContent, so user data can't become markup. */
  function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (value === undefined || value === null || value === false) continue;
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value;
      else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
      else if (key in node && key !== "list") node[key] = value;
      else node.setAttribute(key, value);
    }
    node.append(...children.flat().filter((c) => c !== null && c !== undefined));
    return node;
  }

  function toast(message, kind = "info") {
    const stack = document.getElementById("toasts");
    const node = el("div", { class: `sq-toast is-${kind}`, role: "status", text: message });
    stack.append(node);
    setTimeout(() => {
      node.classList.add("is-leaving");
      setTimeout(() => node.remove(), 220);
    }, 3600);
  }

  /** JSON request with CSRF. Rejects with an Error whose message is safe to show the user. */
  async function api(url, { method = "GET", data, formData, keepalive = false } = {}) {
    const headers = { "X-CSRFToken": csrfToken, Accept: "application/json" };
    const options = { method, headers, credentials: "same-origin", keepalive };
    if (formData) options.body = formData;
    else if (data !== undefined) {
      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(data);
    }
    let response;
    try {
      response = await fetch(url, options);
    } catch {
      throw new Error("Network error. Check your connection and try again.");
    }
    const type = response.headers.get("content-type") || "";
    const payload = type.includes("json") ? await response.json() : null;
    if (!response.ok) {
      const error = new Error((payload && payload.error) || `Request failed (${response.status}).`);
      error.status = response.status;
      error.fields = payload && payload.fields;
      throw error;
    }
    return payload;
  }

  async function copy(text, label = "Copied") {
    try {
      await navigator.clipboard.writeText(text);
      toast(label, "success");
    } catch {
      toast("Your browser blocked clipboard access.", "error");
    }
  }

  function download(filename, content, type = "text/plain") {
    const url = URL.createObjectURL(content instanceof Blob ? content : new Blob([content], { type }));
    const link = el("a", { href: url, download: filename });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function emptyState(icon, message) {
    return el("div", { class: "empty-state" }, el("i", { class: `bi bi-${icon}` }), el("span", { text: message }));
  }

  function readJson(id) {
    const node = document.getElementById(id);
    return node ? JSON.parse(node.textContent) : null;
  }

  /** Render "best per user" rows shared by the game leaderboards. */
  function renderLeaderboard(target, rows, formatter) {
    target.replaceChildren();
    if (!rows.length) {
      target.append(emptyState("trophy", "No scores yet. Be the first."));
      return;
    }
    const me = body.dataset.username;
    target.append(el("ol", { class: "leaderboard" }, rows.map((row) =>
      el("li", { class: row.user === me ? "is-me" : "" },
        el("span", { class: "who", text: row.user }),
        el("span", { class: "what", text: formatter(row) })))));
  }

  const prefersReducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  window.SQ = {
    el, toast, api, copy, download, emptyState, readJson, renderLeaderboard, prefersReducedMotion,
    isAuth: body.dataset.auth === "1",
    loginUrl: `${body.dataset.loginUrl}?next=${encodeURIComponent(location.pathname)}`,
  };

  // Theme switch
  const themeButton = document.getElementById("theme-toggle");
  const syncThemeIcon = () => {
    const dark = document.documentElement.getAttribute("data-bs-theme") === "dark";
    themeButton.querySelector("i").className = `bi bi-${dark ? "sun" : "moon-stars"}`;
    themeButton.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
  };
  themeButton.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-bs-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-bs-theme", next);
    localStorage.setItem("sq-theme", next);
    syncThemeIcon();
    document.dispatchEvent(new CustomEvent("sq:themechange"));
  });
  syncThemeIcon();

  // Django messages arrive as a data block and surface through the same toast system.
  (readJson("django-messages") || []).forEach(([text, level]) =>
    toast(text, level === "error" ? "error" : level === "success" ? "success" : "info"));

  // Favourite stars on any page.
  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-favourite-url]");
    if (!button) return;
    event.preventDefault();
    button.disabled = true;
    try {
      const { favourite } = await api(button.dataset.favouriteUrl, { method: "POST" });
      button.setAttribute("aria-pressed", String(favourite));
      button.querySelector("i").className = `bi bi-star${favourite ? "-fill" : ""}`;
      toast(favourite ? "Added to favourites" : "Removed from favourites", "success");
    } catch (error) {
      toast(error.message, "error");
    } finally {
      button.disabled = false;
    }
  });
})();
