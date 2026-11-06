// Snake Arena. All game state lives here; Django only stores finished scores.
(() => {
  const root = document.getElementById("snake");
  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const $ = (id) => document.getElementById(id);

  const GRID = 24;
  const CELL = canvas.width / GRID;
  const SETTINGS = {
    easy:   { multiplier: 1, startTick: 170, minTick: 90, obstacles: 0, obstacleEvery: 8 },
    normal: { multiplier: 2, startTick: 135, minTick: 70, obstacles: 6, obstacleEvery: 5 },
    hard:   { multiplier: 3, startTick: 105, minTick: 55, obstacles: 14, obstacleEvery: 3 },
  };
  const POWER_UPS = {
    gold:   { color: "#fbbf24", label: "Gold apple", duration: 0 },
    double: { color: "#e879f9", label: "Double points", duration: 8000 },
    slow:   { color: "#38bdf8", label: "Slow motion", duration: 6000 },
    ghost:  { color: "#d4d4d4", label: "Ghost", duration: 6000 },
  };
  const DIRECTIONS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const KEYS = {
    ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
    w: "up", s: "down", a: "left", d: "right", W: "up", S: "down", A: "left", D: "right",
  };

  let game = null;
  let timer = null;

  const difficulty = () => document.querySelector('input[name="difficulty"]:checked').value;
  const key = (x, y) => `${x},${y}`;
  const randomInt = (max) => Math.floor(Math.random() * max);

  function freeCell(minHeadDistance = 0) {
    const head = game.snake[0];
    for (;;) {
      const x = randomInt(GRID);
      const y = randomInt(GRID);
      const taken = game.snake.some((s) => s.x === x && s.y === y) || game.obstacles.has(key(x, y))
        || (game.food && game.food.x === x && game.food.y === y)
        || (game.powerUp && game.powerUp.x === x && game.powerUp.y === y);
      if (!taken && Math.abs(head.x - x) + Math.abs(head.y - y) >= minHeadDistance) return { x, y };
    }
  }

  function newGame() {
    const config = SETTINGS[difficulty()];
    const mid = GRID >> 1;
    game = {
      level: difficulty(), config,
      snake: [{ x: mid, y: mid }, { x: mid - 1, y: mid }, { x: mid - 2, y: mid }],
      direction: DIRECTIONS.right, queue: [],
      obstacles: new Set(), food: null, powerUp: null,
      score: 0, items: 0, eaten: 0, effects: {},
      startedAt: performance.now(), pausedFor: 0, pausedAt: null, state: "running",
    };
    for (let i = 0; i < config.obstacles; i += 1) addObstacle();
    game.food = freeCell(2);
    $("overlay").hidden = true;
    $("pause").disabled = false;
    $("restart").disabled = false;
    setPauseLabel(false);
    updateHud();
    scheduleTick();
    draw();
  }

  function addObstacle() {
    const { x, y } = freeCell(6); // Never drop a rock right in front of the player.
    game.obstacles.add(key(x, y));
  }

  function tickLength() {
    const { startTick, minTick } = game.config;
    let tick = Math.max(minTick, startTick - game.eaten * 3);
    if (game.effects.slow) tick *= 1.6;
    return tick;
  }

  function scheduleTick() {
    clearTimeout(timer);
    timer = setTimeout(tick, tickLength());
  }

  function tick() {
    if (game.state !== "running") return;
    expireEffects();
    if (game.queue.length) game.direction = game.queue.shift();
    const head = game.snake[0];
    const next = { x: head.x + game.direction[0], y: head.y + game.direction[1] };

    const hitWall = next.x < 0 || next.y < 0 || next.x >= GRID || next.y >= GRID;
    const hitRock = game.obstacles.has(key(next.x, next.y)) && !game.effects.ghost;
    // The tail vacates its cell this tick, unless the snake is about to grow.
    const growing = game.food.x === next.x && game.food.y === next.y;
    const body = growing ? game.snake : game.snake.slice(0, -1);
    const hitSelf = body.some((s) => s.x === next.x && s.y === next.y);
    if (hitWall || hitRock || hitSelf) return gameOver();

    game.snake.unshift(next);
    if (growing) eatFood();
    else game.snake.pop();
    if (game.powerUp && game.powerUp.x === next.x && game.powerUp.y === next.y) collectPowerUp();
    if (game.powerUp && performance.now() > game.powerUp.expires) game.powerUp = null;

    updateHud();
    draw();
    scheduleTick();
  }

  function addPoints(points) {
    game.score += points * game.config.multiplier * (game.effects.double ? 2 : 1);
  }

  function eatFood() {
    addPoints(10);
    game.items += 1;
    game.eaten += 1;
    game.food = freeCell(2);
    if (game.eaten % game.config.obstacleEvery === 0 && game.config.obstacles > 0) addObstacle();
    if (!game.powerUp && game.eaten % 4 === 0) {
      const kinds = Object.keys(POWER_UPS);
      game.powerUp = { ...freeCell(3), kind: kinds[randomInt(kinds.length)], expires: performance.now() + 9000 };
    }
  }

  function collectPowerUp() {
    const { kind } = game.powerUp;
    const { duration, label } = POWER_UPS[kind];
    game.powerUp = null;
    game.items += 1;
    if (kind === "gold") addPoints(50);
    else game.effects[kind] = performance.now() + duration;
    SQ.toast(label, "success");
  }

  function expireEffects() {
    for (const [kind, until] of Object.entries(game.effects)) {
      if (performance.now() > until) delete game.effects[kind];
    }
  }

  function updateHud() {
    $("hud-score").textContent = game.score;
    $("hud-length").textContent = game.snake.length;
    $("hud-speed").textContent = Math.round(game.config.startTick / tickLength() * 10) / 10;
    const active = Object.keys(game.effects).map((k) => POWER_UPS[k].label);
    $("hud-effect").textContent = active.length ? active.join(" + ") : "None";
  }

  function togglePause() {
    if (!game || game.state === "over") return;
    if (game.state === "running") {
      game.state = "paused";
      game.pausedAt = performance.now();
      clearTimeout(timer);
      showOverlay("Paused", "Press Space or Resume to carry on.", "Resume");
      $("difficulty").hidden = true;
      setPauseLabel(true);
    } else {
      const pausedFor = performance.now() - game.pausedAt;
      game.pausedFor += pausedFor;
      // Power-up clocks stop while paused.
      for (const kind of Object.keys(game.effects)) game.effects[kind] += pausedFor;
      if (game.powerUp) game.powerUp.expires += pausedFor;
      game.state = "running";
      $("overlay").hidden = true;
      setPauseLabel(false);
      scheduleTick();
    }
  }

  function setPauseLabel(paused) {
    $("pause").replaceChildren(SQ.el("i", { class: `bi bi-${paused ? "play" : "pause"}-fill` }), paused ? " Resume" : " Pause");
  }

  function showOverlay(title, text, action) {
    $("overlay-title").textContent = title;
    $("overlay-text").textContent = text;
    $("start").textContent = action;
    $("overlay").hidden = false;
    $("start").focus();
  }

  async function gameOver() {
    game.state = "over";
    clearTimeout(timer);
    $("pause").disabled = true;
    draw();
    const summary = `You scored ${game.score} at length ${game.snake.length}.`;
    showOverlay("Game over", summary, "Play again");
    $("difficulty").hidden = false;
    if (!SQ.isAuth) {
      $("overlay-text").textContent = `${summary} Sign in to save scores like this one.`;
      return;
    }
    const seconds = (performance.now() - game.startedAt - game.pausedFor) / 1000;
    if (game.score === 0) return;
    try {
      const result = await SQ.api(root.dataset.saveUrl, {
        method: "POST",
        data: { difficulty: game.level, score: game.score, items_collected: game.items, duration_seconds: seconds },
      });
      renderBoard(result);
      if (result.is_new_best) {
        $("overlay-title").textContent = "New personal best!";
        SQ.toast("New personal best saved", "success");
      }
    } catch (error) {
      SQ.toast(`Score not saved: ${error.message}`, "error");
    }
  }

  function draw() {
    const style = getComputedStyle(document.body);
    ctx.fillStyle = style.getPropertyValue("--surface");
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = style.getPropertyValue("--border");
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < GRID; i += 1) {
      ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, canvas.height);
      ctx.moveTo(0, i * CELL); ctx.lineTo(canvas.width, i * CELL);
    }
    ctx.stroke();
    if (!game) return;

    for (const cell of game.obstacles) {
      const [x, y] = cell.split(",").map(Number);
      block(x, y, game.effects.ghost ? "rgb(115 115 115 / .35)" : "#737373", 3);
    }
    block(game.food.x, game.food.y, "#f87171", 5);
    if (game.powerUp) block(game.powerUp.x, game.powerUp.y, POWER_UPS[game.powerUp.kind].color, 5);

    const snakeColor = getComputedStyle(root).getPropertyValue("--app");
    game.snake.forEach((segment, index) => {
      ctx.globalAlpha = index === 0 ? 1 : Math.max(0.45, 0.9 - index * 0.015);
      if (game.effects.ghost) ctx.globalAlpha *= 0.65;
      block(segment.x, segment.y, snakeColor, index === 0 ? 1 : 2);
    });
    ctx.globalAlpha = 1;
  }

  function block(x, y, color, inset) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x * CELL + inset, y * CELL + inset, CELL - inset * 2, CELL - inset * 2, [7, 0, 7, 0]);
    ctx.fill();
  }

  function steer(name) {
    if (!game || game.state !== "running") return;
    const wanted = DIRECTIONS[name];
    const last = game.queue.length ? game.queue[game.queue.length - 1] : game.direction;
    const reversing = wanted[0] === -last[0] && wanted[1] === -last[1];
    const same = wanted === last;
    if (!reversing && !same && game.queue.length < 2) game.queue.push(wanted);
  }

  function renderBoard({ leaderboard, personal_best: best }) {
    SQ.renderLeaderboard($("leaderboard"), leaderboard, (row) => row.score);
    $("personal-best").textContent = best === null || best === undefined ? "" : `Your best at this level: ${best}`;
  }

  async function loadBoard() {
    const level = difficulty();
    $("board-level").textContent = level[0].toUpperCase() + level.slice(1);
    try {
      renderBoard(await SQ.api(`${root.dataset.boardUrl}?difficulty=${level}`));
    } catch (error) {
      $("leaderboard").replaceChildren(SQ.emptyState("wifi-off", error.message));
    }
  }

  function startOrResume() {
    if (game && game.state === "paused") togglePause();
    else newGame();
  }

  $("start").addEventListener("click", startOrResume);
  $("pause").addEventListener("click", togglePause);
  $("restart").addEventListener("click", newGame);
  $("difficulty").addEventListener("change", loadBoard);
  document.addEventListener("keydown", (event) => {
    if (/INPUT|TEXTAREA|SELECT/.test(event.target.tagName) && event.target.type !== "radio") return;
    if (KEYS[event.key]) {
      event.preventDefault();
      steer(KEYS[event.key]);
    } else if (event.key === " " && game && game.state !== "over" && event.target.tagName !== "BUTTON") {
      event.preventDefault();
      togglePause();
    }
  });
  document.querySelectorAll(".dpad button").forEach((button) =>
    button.addEventListener("pointerdown", (event) => { event.preventDefault(); steer(button.dataset.dir); }));
  document.addEventListener("sq:themechange", draw);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && game && game.state === "running") togglePause();
  });

  draw();
  loadBoard();
})();
