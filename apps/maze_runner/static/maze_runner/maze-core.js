// Pure maze logic with no DOM, so it's easy to reason about and test from the console.
window.MazeCore = (() => {
  const N = 1, E = 2, S = 4, W = 8;
  const MOVES = [
    { bit: N, opposite: S, dx: 0, dy: -1 },
    { bit: E, opposite: W, dx: 1, dy: 0 },
    { bit: S, opposite: N, dx: 0, dy: 1 },
    { bit: W, opposite: E, dx: -1, dy: 0 },
  ];

  /** Randomized depth-first search. Each cell stores a bitmask of its open sides. */
  function generate(size, random = Math.random) {
    const open = new Uint8Array(size * size);
    const visited = new Uint8Array(size * size);
    const stack = [[0, 0]];
    visited[0] = 1;
    while (stack.length) {
      const [x, y] = stack[stack.length - 1];
      const options = MOVES.filter(({ dx, dy }) => {
        const nx = x + dx, ny = y + dy;
        return nx >= 0 && ny >= 0 && nx < size && ny < size && !visited[ny * size + nx];
      });
      if (!options.length) { stack.pop(); continue; }
      const move = options[Math.floor(random() * options.length)];
      const nx = x + move.dx, ny = y + move.dy;
      open[y * size + x] |= move.bit;
      open[ny * size + nx] |= move.opposite;
      visited[ny * size + nx] = 1;
      stack.push([nx, ny]);
    }
    return { size, open };
  }

  /** Breadth-first search: the first time we reach the goal is, by construction, the shortest way. */
  function shortestPath(maze, from, to) {
    const { size, open } = maze;
    const previous = new Int32Array(size * size).fill(-1);
    const start = from.y * size + from.x;
    const goal = to.y * size + to.x;
    previous[start] = start;
    const queue = [start];
    for (let head = 0; head < queue.length; head += 1) {
      const current = queue[head];
      if (current === goal) break;
      const x = current % size, y = Math.floor(current / size);
      for (const { bit, dx, dy } of MOVES) {
        const next = (y + dy) * size + (x + dx);
        if ((open[current] & bit) && previous[next] === -1) {
          previous[next] = current;
          queue.push(next);
        }
      }
    }
    if (previous[goal] === -1) return [];
    const path = [];
    for (let cell = goal; ; cell = previous[cell]) {
      path.unshift({ x: cell % size, y: Math.floor(cell / size) });
      if (cell === start) break;
    }
    return path;
  }

  function canMove(maze, x, y, bit) {
    return Boolean(maze.open[y * maze.size + x] & bit);
  }

  return { generate, shortestPath, canMove, N, E, S, W };
})();
