// TypeRush. The browser only reports raw counts; the server derives the official WPM and accuracy.
(() => {
  const root = document.getElementById("typerush");
  const $ = (id) => document.getElementById(id);
  const input = $("type-input");
  const passageNode = $("passage");

  const CHARS_PER_WORD = 5;
  let text = "";
  let spans = [];
  let run = null;
  let timer = null;
  let chart = null;
  let loadToken = 0;

  const seconds = () => Number(document.querySelector('input[name="seconds"]:checked').value);
  const mode = () => document.querySelector('input[name="mode"]:checked').value;

  const wpm = (correct, elapsedSeconds) =>
    elapsedSeconds > 0 ? (correct / CHARS_PER_WORD) / (elapsedSeconds / 60) : 0;
  const accuracy = (keystrokes, errors) =>
    keystrokes ? ((keystrokes - errors) / keystrokes) * 100 : 100;

  async function loadPassage() {
    const token = (loadToken += 1);
    stopRun();
    passageNode.replaceChildren(SQ.el("span", { class: "sq-spinner" }));
    input.disabled = true;
    try {
      const data = await SQ.api(`${root.dataset.passageUrl}?mode=${mode()}&seconds=${seconds()}`);
      if (token !== loadToken) return; // A newer request superseded this one.
      setPassage(data.text);
    } catch (error) {
      passageNode.replaceChildren(SQ.emptyState("wifi-off", error.message));
    }
  }

  function setPassage(value) {
    text = value;
    const fragment = document.createDocumentFragment();
    spans = [...text].map((char) => {
      const span = document.createElement("span");
      if (char === "\n") {
        span.textContent = "↵\n";
        span.dataset.newline = "1";
      } else {
        span.textContent = char;
      }
      fragment.append(span);
      return span;
    });
    passageNode.replaceChildren(fragment);
    passageNode.scrollTop = 0;
    resetRun();
  }

  function stopRun() {
    clearInterval(timer);
    timer = null;
    run = null;
  }

  function resetRun() {
    stopRun();
    run = { startedAt: null, keystrokes: 0, errors: 0, previous: "", finished: false };
    input.value = "";
    input.disabled = false;
    spans.forEach((span) => { span.className = span.dataset.newline ? "nl" : ""; });
    if (spans[0]) spans[0].classList.add("cur");
    $("live-time").textContent = seconds();
    $("live-wpm").textContent = "0";
    $("live-accuracy").textContent = "100%";
    $("results").hidden = true;
    $("type-hint").hidden = false;
  }

  function correctCount(typed) {
    let correct = 0;
    for (let i = 0; i < typed.length; i += 1) if (typed[i] === text[i]) correct += 1;
    return correct;
  }

  function onInput() {
    if (!run || run.finished) return;
    let typed = input.value;
    if (typed.length > text.length) { typed = typed.slice(0, text.length); input.value = typed; }
    if (!run.startedAt && typed.length) startTimer();

    const previous = run.previous;
    let shared = 0;
    while (shared < previous.length && shared < typed.length && previous[shared] === typed[shared]) shared += 1;

    // Re-paint only what changed, and count only newly typed characters as keystrokes.
    for (let i = shared; i < Math.max(previous.length, typed.length) + 1 && i < spans.length; i += 1) {
      const span = spans[i];
      span.className = span.dataset.newline ? "nl" : "";
      if (i < typed.length) {
        const good = typed[i] === text[i];
        span.classList.add(good ? "ok" : "bad");
        if (i >= shared) {
          run.keystrokes += 1;
          if (!good) run.errors += 1;
        }
      }
    }
    const cursor = spans[typed.length];
    if (cursor) {
      cursor.classList.add("cur");
      // Keep the current line in view inside the fixed-height box.
      const top = cursor.offsetTop - passageNode.offsetTop;
      if (top - passageNode.scrollTop > passageNode.clientHeight - 62 || top < passageNode.scrollTop) {
        passageNode.scrollTop = Math.max(0, top - 30);
      }
    }
    run.previous = typed;
    updateLive();
  }

  function elapsed() {
    return run.startedAt ? Math.min((performance.now() - run.startedAt) / 1000, seconds()) : 0;
  }

  function updateLive() {
    const seen = elapsed();
    // Live WPM wobbles wildly in the first moments, so measure over at least two seconds.
    $("live-wpm").textContent = Math.round(wpm(correctCount(run.previous), Math.max(seen, 2)));
    $("live-accuracy").textContent = `${Math.round(accuracy(run.keystrokes, run.errors))}%`;
    $("live-time").textContent = Math.ceil(seconds() - seen);
  }

  function startTimer() {
    run.startedAt = performance.now();
    $("type-hint").hidden = true;
    timer = setInterval(() => {
      updateLive();
      if (elapsed() >= seconds()) finish();
    }, 100);
  }

  async function finish() {
    clearInterval(timer);
    run.finished = true;
    input.disabled = true;
    const correct = correctCount(run.previous);
    const finalWpm = wpm(correct, seconds());
    $("live-time").textContent = "0";
    $("res-wpm").textContent = finalWpm.toFixed(1);
    $("res-accuracy").textContent = `${accuracy(run.keystrokes, run.errors).toFixed(1)}%`;
    $("res-correct").textContent = correct;
    $("res-errors").textContent = run.errors;
    $("results").hidden = false;
    $("again").focus();

    if (!SQ.isAuth) {
      $("res-saved").replaceChildren(SQ.el("a", { href: SQ.loginUrl, text: "Sign in" }), " to save results like this.");
      return;
    }
    $("res-saved").textContent = "Saving…";
    try {
      const saved = await SQ.api(root.dataset.saveUrl, {
        method: "POST",
        data: { mode: mode(), seconds: seconds(), correct_chars: correct, keystrokes: run.keystrokes, errors: run.errors },
      });
      $("res-saved").textContent = "Saved to your history.";
      renderStats(saved);
    } catch (error) {
      $("res-saved").textContent = `Not saved: ${error.message}`;
    }
  }

  function renderStats({ leaderboard, history }) {
    SQ.renderLeaderboard($("leaderboard"), leaderboard, (row) => `${row.wpm} WPM`);
    $("board-label").textContent = `${seconds()}s`;
    if (!SQ.isAuth) return;
    if (!history.length) {
      $("history-empty").replaceChildren(SQ.emptyState("graph-up", "Finish a test to start your chart."));
      return;
    }
    $("history-empty").hidden = true;
    $("history-box").hidden = false;
    drawChart([...history].reverse());
  }

  function drawChart(rows) {
    const style = getComputedStyle(root);
    const color = style.getPropertyValue("--app").trim();
    const muted = style.getPropertyValue("--muted").trim();
    const border = style.getPropertyValue("--border").trim();
    if (chart) chart.destroy();
    chart = new Chart($("history-chart"), {
      type: "line",
      data: {
        labels: rows.map((row) => new Date(row.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })),
        datasets: [{ label: "WPM", data: rows.map((row) => row.wpm), borderColor: color, backgroundColor: color, tension: 0.3, pointRadius: 3 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: SQ.prefersReducedMotion() ? false : undefined,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { afterLabel: (item) => `${rows[item.dataIndex].accuracy}% accuracy · ${rows[item.dataIndex].seconds}s ${rows[item.dataIndex].mode}` } },
        },
        scales: {
          x: { ticks: { color: muted }, grid: { color: border } },
          y: { beginAtZero: true, ticks: { color: muted }, grid: { color: border } },
        },
      },
    });
  }

  async function loadStats() {
    try {
      renderStats(await SQ.api(`${root.dataset.statsUrl}?seconds=${seconds()}`));
    } catch (error) {
      $("leaderboard").replaceChildren(SQ.emptyState("wifi-off", error.message));
    }
  }

  input.addEventListener("input", onInput);
  input.addEventListener("paste", (event) => event.preventDefault());
  input.addEventListener("drop", (event) => event.preventDefault());
  input.addEventListener("keydown", (event) => {
    if (event.key === "Tab") event.preventDefault();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { loadPassage().then(() => input.focus()); }
  });
  $("restart").addEventListener("click", () => loadPassage().then(() => input.focus()));
  $("again").addEventListener("click", () => loadPassage().then(() => input.focus()));
  $("durations").addEventListener("change", () => { loadPassage(); loadStats(); });
  $("modes").addEventListener("change", loadPassage);
  document.addEventListener("sq:themechange", loadStats);

  loadPassage();
  loadStats();
})();
