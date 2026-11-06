// CSV Detective interface. All profiling and cleaning happens in Pandas on the server.
(() => {
  const root = document.getElementById("csv-detective");
  const { el } = SQ;
  const $ = (id) => document.getElementById(id);
  const MAX_BYTES = Number(root.dataset.maxMb) * 1024 * 1024;
  let currentFile = null;
  let report = null;
  const charts = {};

  const tokens = () => {
    const style = getComputedStyle(root);
    return Object.fromEntries(["--app", "--muted", "--border", "--warn"].map((t) => [t, style.getPropertyValue(t).trim()]));
  };

  function drawChart(key, canvasId, config) {
    if (charts[key]) charts[key].destroy();
    const { "--muted": muted, "--border": border } = tokens();
    charts[key] = new Chart($(canvasId), {
      ...config,
      options: {
        responsive: true, maintainAspectRatio: false, animation: SQ.prefersReducedMotion() ? false : undefined,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: muted, maxRotation: 45 }, grid: { color: border } },
          y: { beginAtZero: true, ticks: { color: muted, precision: 0 }, grid: { color: border } },
        },
        ...config.options,
      },
    });
  }

  async function investigate(file) {
    $("upload-error").hidden = true;
    if (!file) return;
    if (file.size > MAX_BYTES) return showError(`That file is over the ${root.dataset.maxMb} MB limit.`);
    if (!file.name.toLowerCase().endsWith(".csv")) return showError("Please choose a file with a .csv extension.");
    currentFile = file;
    $("loading").hidden = false;
    $("report").hidden = true;
    const formData = new FormData();
    formData.append("file", file);
    try {
      report = await SQ.api(root.dataset.analyzeUrl, { method: "POST", formData });
      renderReport();
    } catch (error) {
      showError(error.message);
    } finally {
      $("loading").hidden = true;
    }
  }

  function showError(message) {
    $("upload-error").textContent = message;
    $("upload-error").hidden = false;
  }

  const stat = (value, label) => el("div", { class: "stat" },
    el("div", { class: "stat-value", text: value ?? "n/a" }), el("div", { class: "stat-label", text: label }));

  function renderReport() {
    $("report").hidden = false;
    $("file-name").textContent = report.file_name;
    $("clean-result").textContent = "";
    $("headline").replaceChildren(
      stat(report.rows.toLocaleString(), "Rows"),
      stat(report.column_count, "Columns"),
      stat(report.missing_cells.toLocaleString(), "Missing cells"),
      stat(report.rows_with_missing.toLocaleString(), "Rows with gaps"),
      stat(report.duplicate_rows.toLocaleString(), "Duplicate rows"));
    renderMissing();
    renderColumnsTable();
    renderPreview();
    $("column-select").replaceChildren(...report.columns.map((c, i) => el("option", { value: i, text: c.name })));
    const firstNumeric = report.columns.findIndex((c) => c.histogram);
    $("column-select").value = Math.max(firstNumeric, 0);
    renderColumn();
    $("report").scrollIntoView({ behavior: SQ.prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  }

  function renderMissing() {
    const gaps = report.columns.filter((c) => c.missing > 0);
    $("no-missing").hidden = gaps.length > 0;
    $("missing-chart").parentElement.hidden = gaps.length === 0;
    if (!gaps.length) return;
    drawChart("missing", "missing-chart", {
      type: "bar",
      data: { labels: gaps.map((c) => c.name), datasets: [{ label: "Missing", data: gaps.map((c) => c.missing), backgroundColor: tokens()["--warn"] }] },
      options: { indexAxis: "y" },
    });
  }

  function renderColumnsTable() {
    const fmt = (v) => (v === null || v === undefined ? "–" : v.toLocaleString());
    const rows = report.columns.map((c, i) => el("tr", {},
      el("td", { class: "mono" }, el("button", {
        class: "btn btn-link btn-sm p-0 text-start", type: "button", text: c.name,
        onclick: () => { $("column-select").value = i; renderColumn(); },
      })),
      el("td", {}, el("span", { class: "sq-badge type-pill", text: c.type })),
      el("td", { text: `${c.missing.toLocaleString()} (${c.missing_pct}%)` }),
      el("td", { text: c.unique.toLocaleString() }),
      el("td", { text: fmt(c.summary?.min) }), el("td", { text: fmt(c.summary?.max) }),
      el("td", { text: fmt(c.summary?.mean) }), el("td", { text: fmt(c.summary?.median) }), el("td", { text: fmt(c.summary?.std) })));
    $("columns-table").replaceChildren(
      el("thead", {}, el("tr", {}, ["Column", "Type", "Missing", "Unique", "Min", "Max", "Mean", "Median", "Std dev"].map((t) => el("th", { text: t })))),
      el("tbody", {}, rows));
  }

  function renderPreview() {
    $("preview-note").textContent = report.rows > report.preview.length ? `(first ${report.preview.length} of ${report.rows.toLocaleString()} rows)` : `(all ${report.rows.toLocaleString()} rows)`;
    $("preview-table").replaceChildren(
      el("thead", {}, el("tr", {}, report.preview_headers.map((h) => el("th", { text: h, title: h })))),
      el("tbody", {}, report.preview.map((row) => el("tr", {}, row.map((cell) => (
        cell === null ? el("td", { class: "is-null", text: "missing" }) : el("td", { text: String(cell), title: String(cell) })))))));
  }

  function renderColumn() {
    const column = report.columns[Number($("column-select").value)];
    const parts = [stat(column.type, "Type"), stat(column.unique.toLocaleString(), "Unique"), stat(column.missing.toLocaleString(), "Missing")];
    if (column.summary) parts.push(stat(column.summary.q1, "1st quartile"), stat(column.summary.q3, "3rd quartile"), stat(column.summary.sum, "Sum"));
    $("column-summary").replaceChildren(...parts);
    const color = tokens()["--app"];
    if (column.histogram) {
      const { counts, edges } = column.histogram;
      drawChart("column", "column-chart", {
        type: "bar",
        data: {
          labels: counts.map((_, i) => `${edges[i]} to ${edges[i + 1]}`),
          datasets: [{ label: "Rows", data: counts, backgroundColor: color, barPercentage: 1, categoryPercentage: 0.95 }],
        },
        options: { scales: { x: { ticks: { display: false }, grid: { display: false } }, y: { beginAtZero: true, ticks: { color: tokens()["--muted"], precision: 0 }, grid: { color: tokens()["--border"] } } } },
      });
    } else {
      const top = column.top || [];
      drawChart("column", "column-chart", {
        type: "bar",
        data: { labels: top.map(([value]) => value), datasets: [{ label: "Rows", data: top.map(([, count]) => count), backgroundColor: color }] },
        options: { indexAxis: "y" },
      });
    }
  }

  async function downloadCleaned(event) {
    event.preventDefault();
    const button = event.submitter;
    const formData = new FormData($("clean-form"));
    formData.append("file", currentFile);
    button.disabled = true;
    try {
      // Plain fetch: this endpoint answers with a file, not JSON.
      const response = await fetch(root.dataset.cleanUrl, {
        method: "POST", body: formData,
        headers: { "X-CSRFToken": document.querySelector('meta[name="csrf-token"]').content },
      });
      if (!response.ok) {
        const failure = await response.json().catch(() => ({}));
        throw new Error(failure.error || `Request failed (${response.status}).`);
      }
      const name = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") || "")?.[1] || "cleaned.csv";
      SQ.download(name, await response.blob());
      const before = Number(response.headers.get("X-Rows-Before"));
      const after = Number(response.headers.get("X-Rows-After"));
      $("clean-result").textContent = `Downloaded ${name}: ${after.toLocaleString()} rows kept, ${(before - after).toLocaleString()} removed.`;
    } catch (error) {
      SQ.toast(error.message, "error");
    } finally {
      button.disabled = false;
    }
  }

  $("file-input").addEventListener("change", (event) => investigate(event.target.files[0]));
  $("column-select").addEventListener("change", renderColumn);
  $("clean-form").addEventListener("submit", downloadCleaned);
  $("try-sample").addEventListener("click", async () => {
    const response = await fetch(root.dataset.sampleUrl);
    investigate(new File([await response.blob()], "sample-orders.csv", { type: "text/csv" }));
  });
  const zone = $("dropzone");
  ["dragenter", "dragover"].forEach((type) => zone.addEventListener(type, (event) => { event.preventDefault(); zone.classList.add("is-over"); }));
  ["dragleave", "drop"].forEach((type) => zone.addEventListener(type, (event) => { event.preventDefault(); zone.classList.remove("is-over"); }));
  zone.addEventListener("drop", (event) => investigate(event.dataTransfer.files[0]));
  document.addEventListener("sq:themechange", () => { if (report) { renderMissing(); renderColumn(); } });
})();
