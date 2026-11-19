/**
 * Fixed-timestep loop: logic always advances in exact 1/60 s steps (deterministic,
 * frame-rate independent); rendering gets the leftover fraction to interpolate.
 */
export interface Loop {
  start(): void;
  stop(): void;
  readonly running: boolean;
}

export const STEP = 1 / 60;

export function createLoop(
  update: (dt: number) => void,
  render: (alpha: number) => void,
  maxFps: () => number = () => 60,
): Loop {
  let raf = 0;
  let last = 0;
  let acc = 0;
  let lastRender = 0;
  let running = false;

  const frame = (t: number) => {
    raf = requestAnimationFrame(frame);
    const now = t / 1000;
    acc += Math.min(now - last, 0.25); // clamp: a stalled tab must not fast-forward the game
    last = now;
    while (acc >= STEP) {
      update(STEP);
      acc -= STEP;
    }
    const cap = maxFps();
    if (cap < 60 && now - lastRender < 1 / cap - 0.004) return;
    lastRender = now;
    render(acc / STEP);
  };

  return {
    start() {
      if (running) return;
      running = true;
      last = performance.now() / 1000;
      acc = 0;
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    get running() {
      return running;
    },
  };
}
