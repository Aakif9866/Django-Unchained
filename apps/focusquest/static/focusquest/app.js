// FocusQuest. The browser runs the visible clock. The server decides whether XP was earned.
(() => {
  const root = document.getElementById("focus");
  const { el } = SQ;
  const $ = (id) => document.getElementById(id);
  const PRESETS = { pomodoro: { focus: 25, rest: 5 }, deep: { focus: 50, rest: 10 } };
  const RING_LENGTH = 2 * Math.PI * 90;
  const baseTitle = document.title;

  let phase = "idle"; // idle | focus | break
  let running = false;
  let endsAt = 0; // Wall-clock target, so throttled background tabs can't drift the timer.
  let remainingMs = 0;
  let totalMs = 0;
  let sessionId = null;
  let breakMinutes = 5;
  let ticker = null;
  let chart = null;

  const mode = () => document.querySelector('input[name="mode"]:checked').value;

  function plan() {
    if (mode() === "custom") {
      return { focus: Math.round(Number($("custom-focus").value)), rest: Math.max(0, Math.round(Number($("custom-break").value) || 0)) };
    }
    return PRESETS[mode()];
  }

  const format = (ms) => {
    const seconds = Math.ceil(ms / 1000);
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  };

  function paint() {
    const label = format(remainingMs);
    $("time").textContent = label;
    $("ring").style.strokeDasharray = RING_LENGTH;
    $("ring").style.strokeDashoffset = totalMs ? RING_LENGTH * (1 - remainingMs / totalMs) : 0;
    document.title = phase === "idle" ? baseTitle : `${label} · ${phase === "focus" ? "Focus" : "Break"}`;
    root.classList.toggle("is-break", phase === "break");
  }

  function setControls() {
    const idle = phase === "idle";
    const icon = running ? "pause-fill" : "play-fill";
    const label = idle ? " Start" : running ? " Pause" : " Resume";
    $("start").replaceChildren(el("i", { class: `bi bi-${icon}` }), label);
    $("reset").disabled = idle;
    $("skip-break").hidden = phase !== "break";
    $("modes").querySelectorAll("input").forEach((input) => { input.disabled = !idle; });
    $("custom-focus").disabled = !idle;
    $("custom-break").disabled = !idle;
    const text = { idle: "Ready to focus", focus: running ? "Focusing" : "Paused", break: running ? "On a break" : "Break paused" };
    $("phase").textContent = text[phase];
  }

  function showIdle() {
    phase = "idle";
    running = false;
    sessionId = null;
    clearInterval(ticker);
    totalMs = plan().focus * 60000 || 0;
    remainingMs = totalMs;
    paint();
    setControls();
  }

  function runClock(ms, total) {
    remainingMs = ms;
    totalMs = total;
    endsAt = Date.now() + ms;
    running = true;
    clearInterval(ticker);
    ticker = setInterval(tick, 250);
    paint();
    setControls();
  }

  function tick() {
    remainingMs = Math.max(0, endsAt - Date.now());
    paint();
    if (remainingMs === 0) {
      clearInterval(ticker);
      running = false;
      if (phase === "focus") finishFocus();
      else finishBreak();
    }
  }

  function chime() {
    try {
      const audio = new AudioContext();
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.frequency.value = 660;
      gain.gain.setValueAtTime(0.15, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.8);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start();
      oscillator.stop(audio.currentTime + 0.8);
    } catch { /* Sound is a nicety. */ }
  }

  async function beginFocus() {
    const { focus, rest } = plan();
    if (!Number.isInteger(focus) || focus < 1 || focus > Number($("custom-focus").max)) {
      return SQ.toast(`Choose between 1 and ${$("custom-focus").max} focus minutes.`, "error");
    }
    breakMinutes = rest;
    if (SQ.isAuth) {
      try {
        const session = await SQ.api(root.dataset.startUrl, { method: "POST", data: { mode: mode(), minutes: focus } });
        sessionId = session.id;
      } catch (error) {
        return SQ.toast(error.message, "error");
      }
    }
    phase = "focus";
    runClock(focus * 60000, focus * 60000);
  }

  async function finishFocus() {
    chime();
    if (SQ.isAuth && sessionId) {
      try {
        const result = await SQ.api(`${root.dataset.completeBase}${sessionId}/complete/`, { method: "POST" });
        SQ.toast(`Session complete: +${result.xp_awarded} XP`, "success");
        result.unlocked.forEach((name) => SQ.toast(`Achievement unlocked: ${name}`, "success"));
        renderState(result.state);
      } catch (error) {
        SQ.toast(error.message, "error");
      }
    } else {
      SQ.toast("Session complete. Sign in to earn XP for these.", "success");
    }
    sessionId = null;
    if (breakMinutes > 0) {
      phase = "break";
      runClock(breakMinutes * 60000, breakMinutes * 60000);
    } else {
      showIdle();
    }
  }

  function finishBreak() {
    chime();
    SQ.toast("Break over. Ready for another round?");
    showIdle();
  }

  async function reset() {
    const wasFocus = phase === "focus";
    showIdle();
    if (wasFocus && SQ.isAuth) {
      try {
        renderState(await SQ.api(root.dataset.abandonUrl, { method: "POST" }));
      } catch (error) { SQ.toast(error.message, "error"); }
    }
  }

  function toggle() {
    if (phase === "idle") return beginFocus();
    if (running) {
      remainingMs = Math.max(0, endsAt - Date.now());
      clearInterval(ticker);
      running = false;
      paint();
      setControls();
    } else {
      runClock(remainingMs, totalMs);
    }
    return undefined;
  }

  function renderState(state) {
    $("level").textContent = state.level;
    const span = state.level_next_xp - state.level_floor_xp;
    const into = state.xp - state.level_floor_xp;
    $("xp-label").textContent = `${state.xp} XP · ${state.level_next_xp - state.xp} to level ${state.level + 1}`;
    $("xp-bar").style.width = `${(into / span) * 100}%`;
    $("xp-bar-wrap").setAttribute("aria-valuenow", Math.round((into / span) * 100));
    $("s-streak").textContent = state.streak;
    $("s-longest").textContent = state.longest_streak;
    $("s-sessions").textContent = state.sessions;
    $("s-minutes").textContent = state.minutes.toLocaleString();

    $("achievements").replaceChildren(...state.achievements.map((a) => el("div", {
      class: `achievement${a.unlocked_at ? " is-unlocked" : ""}`,
      title: a.unlocked_at ? `Unlocked ${new Date(a.unlocked_at).toLocaleDateString()}` : "Locked",
    }, el("i", { class: `bi bi-${a.unlocked_at ? a.icon : "lock"}` }),
    el("div", {}, el("strong", { text: a.name }), el("small", { text: a.description })))));

    if (!state.history.length) {
      $("history").replaceChildren(SQ.emptyState("hourglass", "Finished sessions appear here."));
    } else {
      $("history").replaceChildren(...state.history.map((s) => el("div", { class: "session-row" },
        el("span", { text: `${s.minutes} min · ${new Date(s.started_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` }),
        el("span", { class: s.status === "completed" ? "sq-badge sq-badge-ok" : "sq-badge", text: s.status === "completed" ? `+${s.xp} XP` : "Abandoned" }))));
    }
    drawWeek(state.week);
  }

  function drawWeek(week) {
    const style = getComputedStyle(root);
    const muted = style.getPropertyValue("--muted").trim();
    const border = style.getPropertyValue("--border").trim();
    const color = style.getPropertyValue("--app").trim();
    if (chart) chart.destroy();
    chart = new Chart($("week-chart"), {
      type: "bar",
      data: {
        // Dates are calendar days from the server; noon keeps them on that day in any timezone.
        labels: week.map((d) => new Date(`${d.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" })),
        datasets: [{ label: "Minutes", data: week.map((d) => d.minutes), backgroundColor: color, borderRadius: 4 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: SQ.prefersReducedMotion() ? false : undefined,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: muted }, grid: { display: false } },
          y: { beginAtZero: true, ticks: { color: muted, precision: 0 }, grid: { color: border } },
        },
      },
    });
  }

  async function loadState() {
    try {
      const state = await SQ.api(root.dataset.stateUrl);
      renderState(state);
      // A reload mid-session picks the clock back up from the server's start time.
      if (state.active && phase === "idle") {
        const total = state.active.planned_minutes * 60000;
        sessionId = state.active.id;
        document.getElementById(`m-${state.active.mode}`).checked = true;
        syncModeFields();
        if (state.active.mode === "custom") $("custom-focus").value = state.active.planned_minutes;
        breakMinutes = plan().rest;
        phase = "focus";
        runClock(Math.max(0, total - state.active.elapsed_seconds * 1000), total);
      }
    } catch (error) {
      SQ.toast(error.message, "error");
    }
  }

  function syncModeFields() {
    $("custom-fields").hidden = mode() !== "custom";
  }

  $("start").addEventListener("click", toggle);
  $("reset").addEventListener("click", reset);
  $("skip-break").addEventListener("click", () => { clearInterval(ticker); finishBreak(); });
  $("modes").addEventListener("change", () => { syncModeFields(); showIdle(); });
  $("custom-focus").addEventListener("input", () => { if (phase === "idle") showIdle(); });

  showIdle();
  if (SQ.isAuth) {
    document.addEventListener("sq:themechange", loadState);
    loadState();
  }
})();
