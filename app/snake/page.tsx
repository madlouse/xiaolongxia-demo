"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Direction = "up" | "down" | "left" | "right";

type Point = {
  x: number;
  y: number;
};

type Board = {
  cols: number;
  rows: number;
  cell: number;
  width: number;
  height: number;
  dpr: number;
};

type Status = "ready" | "running" | "gameover";

const HIGHSCORE_KEY = "snake_highscore";
const GRID_TARGET = 28;
const MIN_CELL = 14;
const MAX_CELL = 26;
const TICK_MS = 115;

const directionVectors: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const opposite: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function randomInt(max: number) {
  return Math.floor(Math.random() * max);
}

function spawnFood(snake: Point[], board: Board): Point {
  const occupied = new Set(snake.map((segment) => `${segment.x}-${segment.y}`));
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const x = randomInt(board.cols);
    const y = randomInt(board.rows);
    if (!occupied.has(`${x}-${y}`)) {
      return { x, y };
    }
  }
  return { x: 0, y: 0 };
}

export default function SnakePage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const boardRef = useRef<Board>({
    cols: 0,
    rows: 0,
    cell: 0,
    width: 0,
    height: 0,
    dpr: 1,
  });
  const containerRef = useRef<HTMLDivElement | null>(null);

  const snakeRef = useRef<Point[]>([]);
  const foodRef = useRef<Point>({ x: 0, y: 0 });
  const directionRef = useRef<Direction>("right");
  const pendingDirectionRef = useRef<Direction>("right");

  const [status, setStatus] = useState<Status>("ready");
  const statusRef = useRef<Status>(status);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    if (typeof window === "undefined") {
      return 0;
    }
    const stored = window.localStorage.getItem(HIGHSCORE_KEY);
    if (!stored) return 0;
    const parsed = Number.parseInt(stored, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  });

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const layoutStats = useMemo(
    () => [
      { label: "Score", value: score },
      { label: "High Score", value: highScore },
    ],
    [score, highScore]
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const board = boardRef.current;
    if (!board.cols || !board.rows) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.save();
    ctx.scale(board.dpr, board.dpr);
    ctx.clearRect(0, 0, board.width, board.height);

    const gradient = ctx.createLinearGradient(0, 0, board.width, board.height);
    gradient.addColorStop(0, "#0f172a");
    gradient.addColorStop(1, "#020617");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, board.width, board.height);

    ctx.strokeStyle = "rgba(148, 163, 184, 0.1)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= board.cols; x += 1) {
      ctx.beginPath();
      ctx.moveTo(x * board.cell, 0);
      ctx.lineTo(x * board.cell, board.height);
      ctx.stroke();
    }
    for (let y = 0; y <= board.rows; y += 1) {
      ctx.beginPath();
      ctx.moveTo(0, y * board.cell);
      ctx.lineTo(board.width, y * board.cell);
      ctx.stroke();
    }

    const snake = snakeRef.current;
    snake.forEach((segment, index) => {
      const isHead = index === 0;
      ctx.fillStyle = isHead ? "#38bdf8" : "rgba(59, 130, 246, 0.9)";
      const inset = isHead ? 2 : 3;
      ctx.fillRect(
        segment.x * board.cell + inset,
        segment.y * board.cell + inset,
        board.cell - inset * 2,
        board.cell - inset * 2
      );
    });

    const food = foodRef.current;
    ctx.fillStyle = "#f97316";
    ctx.beginPath();
    ctx.arc(
      food.x * board.cell + board.cell / 2,
      food.y * board.cell + board.cell / 2,
      board.cell * 0.35,
      0,
      Math.PI * 2
    );
    ctx.fill();

    ctx.restore();
  }, []);

  const resetSnake = useCallback(() => {
    const board = boardRef.current;
    if (!board.cols || !board.rows) return;

    const startX = Math.floor(board.cols / 2);
    const startY = Math.floor(board.rows / 2);

    snakeRef.current = [
      { x: startX, y: startY },
      { x: startX - 1, y: startY },
      { x: startX - 2, y: startY },
    ];

    directionRef.current = "right";
    pendingDirectionRef.current = "right";
    foodRef.current = spawnFood(snakeRef.current, board);
    draw();
  }, [draw]);

  const updateBoard = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const bounds = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const cell = clamp(Math.floor(Math.min(bounds.width, bounds.height) / GRID_TARGET), MIN_CELL, MAX_CELL);
    const cols = Math.max(12, Math.floor(bounds.width / cell));
    const rows = Math.max(12, Math.floor(bounds.height / cell));
    const width = cols * cell;
    const height = rows * cell;

    boardRef.current = { cols, rows, cell, width, height, dpr };

    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);

    if (statusRef.current === "ready") {
      resetSnake();
    } else {
      draw();
    }
  }, [draw, resetSnake]);

  const startGame = useCallback(() => {
    if (!boardRef.current.cols) return;
    setScore(0);
    resetSnake();
    setStatus("running");
  }, [resetSnake]);

  const endGame = useCallback(() => {
    setStatus("gameover");
  }, []);

  const tick = useCallback(() => {
    const board = boardRef.current;
    if (!board.cols || !board.rows) return;

    const snake = snakeRef.current;
    const direction = pendingDirectionRef.current;
    directionRef.current = direction;

    const vector = directionVectors[direction];
    const head = snake[0];
    const next = { x: head.x + vector.x, y: head.y + vector.y };

    if (
      next.x < 0 ||
      next.y < 0 ||
      next.x >= board.cols ||
      next.y >= board.rows ||
      snake.some((segment) => segment.x === next.x && segment.y === next.y)
    ) {
      endGame();
      return;
    }

    const hasEaten = next.x === foodRef.current.x && next.y === foodRef.current.y;
    const nextSnake = [next, ...snake];
    if (!hasEaten) {
      nextSnake.pop();
    }

    snakeRef.current = nextSnake;

    if (hasEaten) {
      setScore((current) => {
        const nextScore = current + 1;
        setHighScore((prev) => Math.max(prev, nextScore));
        return nextScore;
      });
      foodRef.current = spawnFood(nextSnake, board);
    }

    draw();
  }, [draw, endGame]);

  useEffect(() => {
    window.localStorage.setItem(HIGHSCORE_KEY, String(highScore));
  }, [highScore]);

  useEffect(() => {
    if (status !== "running") return;

    const handle = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(handle);
  }, [status, tick]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const current = directionRef.current;
      const controls: Record<string, Direction> = {
        arrowup: "up",
        arrowdown: "down",
        arrowleft: "left",
        arrowright: "right",
        w: "up",
        s: "down",
        a: "left",
        d: "right",
      };

      if (key === " " || key === "enter") {
        event.preventDefault();
        if (statusRef.current !== "running") {
          startGame();
        }
        return;
      }

      if (key === "r") {
        event.preventDefault();
        startGame();
        return;
      }

      const nextDirection = controls[key];
      if (!nextDirection) return;

      event.preventDefault();
      if (opposite[current] === nextDirection) return;

      pendingDirectionRef.current = nextDirection;
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [startGame]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      updateBoard();
    });

    observer.observe(container);
    updateBoard();

    return () => observer.disconnect();
  }, [updateBoard]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1e293b_0%,#020617_55%,#01030d_100%)] text-slate-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
        <header className="flex flex-col gap-3">
          <span className="text-xs uppercase tracking-[0.4em] text-slate-400">
            Snake Arcade
          </span>
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold text-white md:text-4xl">
                Neon Trail Snake
              </h1>
              <p className="max-w-xl text-sm text-slate-300 md:text-base">
                Use the arrow keys to guide the snake. Grab the glowing energy
                pellets, avoid the walls, and don’t collide with yourself.
              </p>
            </div>
            <button
              type="button"
              onClick={startGame}
              className="mt-2 inline-flex w-full items-center justify-center rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/20 md:mt-0 md:w-auto"
            >
              {status === "running" ? "Restart" : "Start Game"}
            </button>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-[0_0_40px_rgba(59,130,246,0.15)] sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
              <div className="flex flex-wrap gap-4">
                {layoutStats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2"
                  >
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                      {stat.label}
                    </p>
                    <p className="text-2xl font-semibold text-white">
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.3em] text-slate-300">
                {status === "running" && "Live"}
                {status === "ready" && "Ready"}
                {status === "gameover" && "Game Over"}
              </div>
            </div>

            <div className="relative flex items-center justify-center">
              <div
                ref={containerRef}
                className="relative flex h-[60vh] min-h-[320px] w-full items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/40"
              >
                <canvas ref={canvasRef} className="max-h-full max-w-full" />

                {status !== "running" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 backdrop-blur">
                    <div className="flex max-w-xs flex-col items-center gap-4 text-center">
                      <p className="text-lg font-semibold text-white">
                        {status === "gameover"
                          ? "Crash detected. Try again?"
                          : "Press Enter or Start to begin."}
                      </p>
                      <p className="text-sm text-slate-300">
                        {status === "gameover"
                          ? `Final score: ${score}`
                          : "Collect pellets to grow your trail."}
                      </p>
                      <button
                        type="button"
                        onClick={startGame}
                        className="inline-flex items-center justify-center rounded-full bg-cyan-500 px-5 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/40 transition hover:bg-cyan-400"
                      >
                        {status === "gameover" ? "Restart" : "Start"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          <aside className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-200">
            <h2 className="text-lg font-semibold text-white">How to Play</h2>
            <ul className="mt-4 space-y-3 text-slate-300">
              <li>Arrow keys (or WASD) move the snake.</li>
              <li>Grab the orange pellets to grow and score.</li>
              <li>Hitting walls or your tail ends the run.</li>
              <li>Press Enter to start, and R to restart fast.</li>
            </ul>
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                Tip
              </p>
              <p className="mt-2 text-sm text-slate-200">
                Keep your turns tight when the snake grows. A zig-zag pattern
                buys extra breathing room.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
