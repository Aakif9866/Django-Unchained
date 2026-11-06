// Maze Runner UI. Generation and solving live in maze-core.js.
(() => {
  const root = document.getElementById("maze");
  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const $ = (id) => document.getElementById(id);
  const { generate, shortestPath, canMove, N, E, S, W } = window.MazeCore;

  const SIZES = { easy: 12, medium: 20, hard: 30 };
  const KEY_MOVES = {
    ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
    w: "up", s: "down", a: "left", d: "right", W: "up", S: "down", A: "left", D: "right",
  };
  const DIRECTION = {
    up: { bit: N, dx: 0, dy: -1 }, right: { bit: E, dx: 1, dy: 0 },
    down: { bit: S, dx: 0, dy: 1 }, left: { bit: W, dx: -1, dy: 0 },
  };

  let maze, player, moves, startedAt, finishedMs, clock, solverUsed, showPath, trail;

  const difficulty = () => document.querySelector('input[name="difficulty"]:checked').value;
  const goal = () => ({ x: maze.size - 1, y: maze.size - 1 });
  const seconds = (ms) => `${(ms / 1000).toFixed(1)}s`;

  function newMaze() {
    maze = generate(SIZES[difficulty()]);
    $("hud-optimal").textContent = shortestPath(maze, { x: 0, y: 0 }, goal()).length - 1;
    restart();
  }

  function restart() {
    clearInterval(clock);
    player = { x: 0, y: 0 };
    moves = 0;
    startedAt = null;
    finishedMs = null;
    solverUsed = false;
    showPath = false;
    trail = new Set(["0,0"]);
    $("overlay").hidden = true;
    $("hud-time").textContent = "0.0s";
    $("hud-moves").textContent = "0";
    setSolveLabel();
    draw();
  }

  function move(name) {
    if (finishedMs !== null) return;
    const { bit, dx, dy } = DIRECTION[name];
    if (!canMove(maze, player.x, player.y, bit)) return;
    if (startedAt === null) {
      startedAt = performance.now();
      clock = setInterval(() => { $("hud-time").textContent = seconds(performance.now() - startedAt); }, 100);
    }
    player = { x: player.x + dx, y: player.y + dy };
    moves += 1;
    trail.add(`${player.x},${player.y}`);
    $("hud-moves").textContent = moves;
    draw();
    if (player.x === goal().x && player.y === goal().y) finish();
  }

  async function finish() {
    finishedMs = Math.round(performance.now() - startedAt);
    clearInterval(clock);
    $("hud-time").textContent = seconds(finishedMs);
    const optimal = shortestPath(maze, { x: 0, y: 0 }, goal()).length - 1;
    $("overlay-title").textContent = "You made it out!";
    $("overlay-text").textContent = `${seconds(finishedMs)} in ${moves} moves. The shortest route was ${optimal}.`;
    $("overlay").hidden = false;
    $("next-maze").focus();

    if (solverUsed) {
      $("overlay-text").textContent += " Practice run: you used Show path, so it wasn't saved.";
      return;
    }
    if (!SQ.isAuth) {
      $("overlay-text").textContent += " Sign in to save runs.";
      return;
    }
    try {
      render(await SQ.api(root.dataset.saveUrl, {
        method: "POST",
        data: { difficulty: difficulty(), time_ms: finishedMs, moves },
      }));
      SQ.toast("Run saved", "success");
    } catch (error) {
      SQ.toast(`Run not saved: ${error.message}`, "error");
    }
  }

  function setSolveLabel() {
    $("solve").replaceChildren(SQ.el("i", { class: "bi bi-signpost" }), showPath ? " Hide path" : " Show path");
  }

  function draw() {
    const style = getComputedStyle(root);
    const surface = style.getPropertyValue("--surface");
    const wall = style.getPropertyValue("--text");
    const app = style.getPropertyValue("--app");
    const success = style.getPropertyValue("--success");
    const accent = style.getPropertyValue("--accent");
    const margin = 8;
    const cell = (canvas.width - margin * 2) / maze.size;
    const px = (n) => margin + n * cell;

    ctx.fillStyle = surface;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.globalAlpha = 0.18;
    ctx.fillStyle = app;
    for (const key of trail) {
      const [x, y] = key.split(",").map(Number);
      ctx.fillRect(px(x), px(y), cell, cell);
    }
    ctx.globalAlpha = 1;

    if (showPath) {
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(2, cell * 0.16);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.setLineDash([cell * 0.1, cell * 0.3]);
      ctx.beginPath();
      shortestPath(maze, player, goal()).forEach((point, i) => {
        const cx = px(point.x) + cell / 2, cy = px(point.y) + cell / 2;
        if (i) ctx.lineTo(cx, cy); else ctx.moveTo(cx, cy);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.fillStyle = success;
    ctx.beginPath();
    ctx.roundRect(px(maze.size - 1) + cell * .15, px(maze.size - 1) + cell * .15, cell * .7, cell * .7, cell * .15);
    ctx.fill();

    ctx.strokeStyle = wall;
    ctx.lineWidth = Math.max(1.5, cell * 0.07);
    ctx.lineCap = "square";
    ctx.beginPath();
    for (let y = 0; y < maze.size; y += 1) {
      for (let x = 0; x < maze.size; x += 1) {
        if (!canMove(maze, x, y, N)) { ctx.moveTo(px(x), px(y)); ctx.lineTo(px(x + 1), px(y)); }
        if (!canMove(maze, x, y, W)) { ctx.moveTo(px(x), px(y)); ctx.lineTo(px(x), px(y + 1)); }
        if (x === maze.size - 1) { ctx.moveTo(px(x + 1), px(y)); ctx.lineTo(px(x + 1), px(y + 1)); }
        if (y === maze.size - 1) { ctx.moveTo(px(x), px(y + 1)); ctx.lineTo(px(x + 1), px(y + 1)); }
      }
    }
    ctx.stroke();

    ctx.fillStyle = app;
    ctx.beginPath();
    ctx.arc(px(player.x) + cell / 2, px(player.y) + cell / 2, cell * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  function render({ leaderboard, history }) {
    SQ.renderLeaderboard($("leaderboard"), leaderboard, (row) => seconds(row.time_ms));
    if (!SQ.isAuth) return;
    if (!history.length) {
      $("history").replaceChildren(SQ.emptyState("signpost-split", "No finished mazes yet."));
      return;
    }
    $("history").replaceChildren(...history.map((run) => SQ.el("div", { class: "run-row" },
      SQ.el("span", { text: run.difficulty[0].toUpperCase() + run.difficulty.slice(1) }),
      SQ.el("span", { text: `${seconds(run.time_ms)} · ${run.moves} moves` }))));
  }

  async function loadBoard() {
    const level = difficulty();
    $("board-level").textContent = level[0].toUpperCase() + level.slice(1);
    try {
      render(await SQ.api(`${root.dataset.boardUrl}?difficulty=${level}`));
    } catch (error) {
      $("leaderboard").replaceChildren(SQ.emptyState("wifi-off", error.message));
    }
  }

  $("new-maze").addEventListener("click", newMaze);
  $("next-maze").addEventListener("click", newMaze);
  $("restart").addEventListener("click", restart);
  $("solve").addEventListener("click", () => {
    showPath = !showPath;
    if (showPath && finishedMs === null) solverUsed = true;
    setSolveLabel();
    draw();
  });
  $("difficulty").addEventListener("change", () => { newMaze(); loadBoard(); });
  document.addEventListener("keydown", (event) => {
    if (KEY_MOVES[event.key] && !/INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || (KEY_MOVES[event.key] && event.target.type === "radio")) {
      event.preventDefault();
      move(KEY_MOVES[event.key]);
    }
  });
  document.querySelectorAll(".dpad button").forEach((button) =>
    button.addEventListener("pointerdown", (event) => { event.preventDefault(); move(button.dataset.dir); }));
  document.addEventListener("sq:themechange", draw);

  newMaze();
  loadBoard();
})();
