import { describe, expect, it } from "vitest";
import { createRng } from "@/engine/rng";
import { BONUS_EVERY, boardFor, newGame, tick, tickMs, turn } from "./logic";

describe("coil", () => {
  it("moves one cell per tick and keeps its length", () => {
    const rng = createRng(1);
    const s = newGame(15, 15, rng);
    s.food = { x: 0, y: 0 };
    const head = { ...s.snake[0] };
    expect(tick(s, rng)).toBe("move");
    expect(s.snake[0]).toEqual({ x: head.x + 1, y: head.y });
    expect(s.snake).toHaveLength(3);
  });

  it("ignores reversing straight into itself", () => {
    const s = newGame(15, 15, createRng(1));
    turn(s, "left");
    expect(s.queue).toEqual([]);
  });

  it("buffers quick turns in order", () => {
    const s = newGame(15, 15, createRng(1));
    turn(s, "up");
    turn(s, "left");
    expect(s.queue).toEqual(["up", "left"]);
  });

  it("grows and scores when eating, and food never spawns on the snake", () => {
    const rng = createRng(7);
    const s = newGame(15, 15, rng);
    s.food = { x: s.snake[0].x + 1, y: s.snake[0].y };
    expect(tick(s, rng)).toBe("eat");
    expect(s.snake).toHaveLength(4);
    expect(s.score).toBe(1);
    expect(s.snake.some((p) => p.x === s.food.x && p.y === s.food.y)).toBe(false);
  });

  it("dies on walls", () => {
    const rng = createRng(1);
    const s = newGame(5, 5, rng);
    s.food = { x: 0, y: 4 };
    let r = tick(s, rng);
    while (r !== "dead") r = tick(s, rng);
    expect(s.alive).toBe(false);
    expect(s.snake[0].x).toBe(4); // last legal cell before the wall
  });

  it("dies when biting its body but may follow its own tail", () => {
    const rng = createRng(1);
    const s = newGame(15, 15, rng);
    s.food = { x: 0, y: 0 };
    // A 4-long snake in a tight square: the head steps where the tail just left.
    s.snake = [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 6, y: 6 }, { x: 6, y: 5 }];
    s.dir = "up";
    turn(s, "right");
    expect(tick(s, rng)).toBe("move");
    const t = newGame(15, 15, rng);
    t.food = { x: 0, y: 0 };
    t.snake = [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 6, y: 6 }, { x: 6, y: 5 }, { x: 6, y: 4 }];
    t.dir = "up";
    turn(t, "right");
    expect(tick(t, rng)).toBe("dead");
  });

  it("spawns a timed bonus every few bites", () => {
    const rng = createRng(3);
    const s = newGame(15, 15, rng);
    for (let i = 0; i < BONUS_EVERY; i++) {
      s.food = { x: s.snake[0].x + 1, y: s.snake[0].y };
      if (s.snake[0].x + 1 >= s.w) break;
      tick(s, rng);
    }
    expect(s.bonus).not.toBeNull();
  });

  it("speeds up but never below the floor", () => {
    expect(tickMs(0)).toBeGreaterThan(tickMs(10));
    expect(tickMs(1000)).toBe(70);
  });

  it("shapes the board to the screen", () => {
    expect(boardFor(390, 844)).toEqual({ w: 15, h: 27 });
    expect(boardFor(1440, 900)).toEqual({ w: 24, h: 15 });
  });

  it("survives a snapshot round-trip", () => {
    const rng = createRng(9);
    const s = newGame(15, 20, rng);
    tick(s, rng);
    const copy = JSON.parse(JSON.stringify(s));
    const r2 = createRng(0);
    r2.setState(rng.state());
    expect(tick(copy, r2)).toBe(tick(s, rng));
    expect(copy).toEqual(s);
  });
});
