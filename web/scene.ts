import type { Game } from "../src/game.ts";
import { LEAVE_AFTER } from "../src/config.ts";
import type { Fuel, VehicleId } from "../src/types.ts";
import { noisePattern, rr } from "./lib/draw.ts";
import { carHeadlightCone, carLook, drawCar, type CarLook } from "./sprites/vehicles.ts";
import {
  FUEL_COLOR,
  FUEL_LABEL,
  drawAttendant,
  drawBush,
  drawCanopy,
  drawCanopyShadow,
  drawHatch,
  drawHose,
  drawIsland,
  drawLamp,
  drawPump,
  drawShop,
  drawTanker,
  drawTotem,
  drawTrashBin,
  drawTree,
  type CanopyRect,
} from "./sprites/station.ts";

const WORLD_W = 500;
const HIGHWAY_H = 150;
const VERGE_H = 22;
const FORECOURT_X0 = 36;
const FORECOURT_X1 = 464;
const APRON_TOP = HIGHWAY_H + VERGE_H;
const QUEUE_ROW_H = 62;
const QUEUE_PER_ROW = 5;
const CELL_H = 120;
const CELL_CX = [142, 358];
const ENTRY_X = 104;
const EXIT_X = 400;

export interface Point {
  x: number;
  y: number;
}

interface Cell {
  island: Point & { w: number; h: number };
  pump: Point;
  spot: Point;
}

interface Layout {
  worldH: number;
  rows: number;
  cells: Cell[];
  queue: Point[];
  queueRows: number[];
  canopy: CanopyRect;
  shop: { x: number; y: number; w: number; h: number };
  gridTop: number;
  gridBottom: number;
  hatches: Point[];
}

function buildLayout(pumps: number): Layout {
  const rows = Math.max(1, Math.ceil(pumps / 2));
  const queueRows: number[] = [APRON_TOP + 42];
  if (pumps > 3) queueRows.push(APRON_TOP + 42 + QUEUE_ROW_H);
  const gridTop = queueRows[queueRows.length - 1] + 50;

  const cells: Cell[] = [];
  for (let i = 0; i < rows * 2; i++) {
    const row = Math.floor(i / 2);
    const cx = CELL_CX[i % 2];
    const cy = gridTop + row * CELL_H + CELL_H / 2;
    cells.push({
      island: { x: cx, y: cy + 32, w: 140, h: 24 },
      pump: { x: cx, y: cy + 32 },
      spot: { x: cx, y: cy - 8 },
    });
  }
  const gridBottom = gridTop + rows * CELL_H;
  const queue: Point[] = [];
  for (const y of queueRows) {
    for (let i = 0; i < QUEUE_PER_ROW; i++) queue.push({ x: 82 + i * 84, y });
  }
  const shop = { x: 236, y: gridBottom + 58, w: 214, h: 80 };
  const hatches: Point[] = [];
  for (let i = 0; i < 4; i++) hatches.push({ x: 438, y: gridBottom + 28 + i * 26 });
  return {
    rows,
    cells,
    queue,
    queueRows,
    gridTop,
    gridBottom,
    shop,
    hatches,
    canopy: { x: 250, y: gridTop + (rows * CELL_H) / 2 - 4, w: 396, h: rows * CELL_H - 18 },
    worldH: shop.y + shop.h / 2 + 42,
  };
}

type CarMode = "queue" | "pump" | "leaving";

interface VCar {
  id: number;
  vehicle: VehicleId;
  fuel: Fuel;
  look: CarLook;
  x: number;
  y: number;
  angle: number;
  path: Point[];
  face: number | null;
  mode: CarMode;
  wait: number;
  progress: number | null;
  gone: number;
}

interface Traffic {
  x: number;
  y: number;
  dir: 1 | -1;
  speed: number;
  look: CarLook;
}

interface Drop {
  x: number;
  y: number;
  len: number;
  speed: number;
}

const TRAFFIC_POOL: VehicleId[] = ["kometa", "malysh", "semya", "steppe", "taiga", "magistral", "lynx"];

function lerpAngle(a: number, b: number, t: number): number {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export class Scene {
  private ctx: CanvasRenderingContext2D;
  private cars = new Map<number, VCar>();
  private traffic: Traffic[] = [];
  private drops: Drop[] = [];
  private grass: CanvasPattern | null = null;
  private asphalt: CanvasPattern | null = null;
  private layout = buildLayout(2);
  private trafficTimer = 0;
  private tankerX = -160;
  private attendants: Point[] = [];
  private view = { scale: 1, ox: 0, oy: 0 };
  private clock = 0;
  private primed = false;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
    this.grass = noisePattern(this.ctx, "#4f7d4d", ["#5d8c58", "#456f44", "#67976a"]);
    this.asphalt = noisePattern(this.ctx, "#4b515a", ["#565d67", "#41474f", "#5f6873"]);
  }

  resize(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = this.canvas.clientWidth || 390;
    const h = this.canvas.clientHeight || 520;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
  }

  update(game: Game, dt: number): void {
    this.clock += dt;
    this.layout = buildLayout(game.pumps.length);
    this.syncCars(game, dt);
    this.moveCars(dt);
    this.updateTraffic(game, dt);
    this.updateTanker(game, dt);
    this.updateAttendants(game);
    this.updateRain(game, dt);
    this.primed = true;
  }

  /** Возвращает id машины в очереди по экранным координатам. */
  pick(clientX: number, clientY: number, game: Game): number | null {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = this.canvas.width / rect.width;
    const px = (clientX - rect.left) * dpr;
    const py = (clientY - rect.top) * dpr;
    const wx = (px - this.view.ox) / this.view.scale;
    const wy = (py - this.view.oy) / this.view.scale;
    let best: number | null = null;
    let bestD = 40;
    for (const car of game.queue) {
      const v = this.cars.get(car.id);
      if (!v) continue;
      const d = Math.hypot(v.x - wx, v.y - wy);
      if (d < bestD) {
        bestD = d;
        best = car.id;
      }
    }
    return best;
  }

  private syncCars(game: Game, dt: number): void {
    const live = new Set<number>();

    game.queue.forEach((car, i) => {
      live.add(car.id);
      const slot = this.layout.queue[Math.min(i, this.layout.queue.length - 1)];
      const v = this.ensure(car.id, car.vehicle, car.fuel, slot);
      v.mode = "queue";
      v.wait = car.wait;
      v.progress = null;
      this.retarget(v, slot, 0);
    });

    game.pumps.forEach((pump, i) => {
      const occ = pump.occupant;
      if (!occ) return;
      live.add(occ.carId);
      const cell = this.layout.cells[i] ?? this.layout.cells[0];
      const v = this.ensure(occ.carId, occ.vehicle, occ.fuel, cell.spot);
      v.mode = "pump";
      v.progress = occ.approachLeft > 0 ? null : 1 - occ.fillLeft / occ.fillTotal;
      v.wait = 0;
      this.retarget(v, cell.spot, 0);
    });

    for (const [id, v] of this.cars) {
      if (live.has(id)) {
        v.gone = 0;
        continue;
      }
      if (v.mode !== "leaving") {
        v.mode = "leaving";
        v.progress = null;
        v.path = [
          { x: EXIT_X, y: Math.max(v.y, APRON_TOP + 30) },
          { x: EXIT_X, y: -110 },
        ];
        v.face = null;
      }
      v.gone += dt;
      if (v.y < -100 || v.gone > 20) this.cars.delete(id);
    }
  }

  /** Машины из загруженного сохранения ставим сразу на места, а новые заезжают с шоссе. */
  private ensure(id: number, vehicle: VehicleId, fuel: Fuel, at: Point): VCar {
    const found = this.cars.get(id);
    if (found) return found;
    const snap = !this.primed;
    const v: VCar = {
      id,
      vehicle,
      fuel,
      look: carLook(vehicle, id),
      x: snap ? at.x : ENTRY_X,
      y: snap ? at.y : -90,
      angle: snap ? 0 : Math.PI / 2,
      path: snap ? [{ ...at }] : [{ x: ENTRY_X, y: APRON_TOP + 24 }, { ...at }],
      face: null,
      mode: "queue",
      wait: 0,
      progress: null,
      gone: 0,
    };
    this.cars.set(id, v);
    return v;
  }

  private retarget(v: VCar, pt: Point, face: number | null): void {
    if (v.path.length === 0) v.path = [{ ...pt }];
    else v.path[v.path.length - 1] = { ...pt };
    v.face = face;
  }

  private moveCars(dt: number): void {
    for (const v of this.cars.values()) {
      const speed = v.mode === "leaving" ? 130 : 108;
      let moved = 0;
      let budget = speed * dt;
      while (budget > 0 && v.path.length > 0) {
        const target = v.path[0];
        const dx = target.x - v.x;
        const dy = target.y - v.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 1.5) {
          if (v.path.length > 1) v.path.shift();
          else break;
          continue;
        }
        const step = Math.min(budget, dist);
        v.x += (dx / dist) * step;
        v.y += (dy / dist) * step;
        budget -= step;
        moved += step;
        if (step > 0.01) v.angle = lerpAngle(v.angle, Math.atan2(dy, dx), Math.min(1, dt * 9));
      }
      if (moved < 0.2 && v.face != null) v.angle = lerpAngle(v.angle, v.face, Math.min(1, dt * 6));
    }
  }

  private updateTraffic(game: Game, dt: number): void {
    const density = game.raining ? 0.9 : game.phase === "night" ? 0.5 : 1.4;
    this.trafficTimer -= dt * density;
    if (this.trafficTimer <= 0) {
      this.trafficTimer = 1.1 + Math.random() * 2.4;
      const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
      const vehicle = TRAFFIC_POOL[Math.floor(Math.random() * TRAFFIC_POOL.length)];
      this.traffic.push({
        x: dir === 1 ? -140 : WORLD_W + 140,
        y: dir === 1 ? 40 + Math.random() * 22 : 92 + Math.random() * 22,
        dir,
        speed: (150 + Math.random() * 90) * (game.raining ? 0.75 : 1),
        look: carLook(vehicle, Math.floor(Math.random() * 9999)),
      });
    }
    for (const car of this.traffic) car.x += car.dir * car.speed * dt;
    this.traffic = this.traffic.filter((c) => c.x > -220 && c.x < WORLD_W + 220);
  }

  private updateTanker(game: Game, dt: number): void {
    const arriving = game.tanker != null && game.tanker.eta < 12;
    const target = arriving ? 250 : -180;
    this.tankerX += (target - this.tankerX) * Math.min(1, dt * 0.9);
  }

  private updateAttendants(game: Game): void {
    const busy = game.pumps
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => p.occupant && p.occupant.approachLeft <= 0)
      .slice(0, Math.max(0, game.status === "working" ? game.attendantCount : 0));
    const spots: Point[] = busy.map(({ i }) => {
      const cell = this.layout.cells[i] ?? this.layout.cells[0];
      return { x: cell.pump.x - 24, y: cell.pump.y - 12 };
    });
    const count = game.status === "none" ? 0 : game.attendantCount;
    while (spots.length < count) {
      spots.push({ x: this.layout.shop.x - 70 - spots.length * 20, y: this.layout.shop.y - this.layout.shop.h / 2 - 18 });
    }
    this.attendants = spots.slice(0, count);
  }

  private updateRain(game: Game, dt: number): void {
    const want = game.raining ? 130 : 0;
    while (this.drops.length < want) {
      this.drops.push({
        x: Math.random() * (WORLD_W + 160) - 80,
        y: Math.random() * this.layout.worldH,
        len: 10 + Math.random() * 14,
        speed: 620 + Math.random() * 260,
      });
    }
    if (this.drops.length > want) this.drops.length = want;
    for (const d of this.drops) {
      d.y += d.speed * dt;
      d.x += d.speed * 0.22 * dt;
      if (d.y > this.layout.worldH) {
        d.y = -20;
        d.x = Math.random() * (WORLD_W + 160) - 80;
      }
    }
  }

  draw(game: Game, selectedId: number | null): void {
    const ctx = this.ctx;
    const { worldH } = this.layout;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const scale = Math.min(cw / WORLD_W, ch / worldH);
    this.view = { scale, ox: (cw - WORLD_W * scale) / 2, oy: (ch - worldH * scale) / 2 };

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#131c28";
    ctx.fillRect(0, 0, cw, ch);
    ctx.setTransform(scale, 0, 0, scale, this.view.ox, this.view.oy);

    this.drawGround(game);
    drawCanopyShadow(ctx, this.layout.canopy);
    this.drawObjects(game, selectedId);
    this.drawNight(game);
    this.drawRain(game);
  }

  private drawGround(game: Game): void {
    const ctx = this.ctx;
    const { worldH, gridBottom } = this.layout;

    ctx.fillStyle = this.grass!;
    ctx.fillRect(0, 0, WORLD_W, worldH);

    // шоссе
    ctx.fillStyle = this.asphalt!;
    ctx.fillRect(0, 0, WORLD_W, HIGHWAY_H);
    ctx.fillStyle = "rgba(0,0,0,0.16)";
    ctx.fillRect(0, 34, WORLD_W, 34);
    ctx.fillRect(0, 86, WORLD_W, 34);
    ctx.fillStyle = "#e8e2cf";
    ctx.fillRect(0, 6, WORLD_W, 3);
    ctx.fillRect(0, HIGHWAY_H - 9, WORLD_W, 3);
    ctx.fillStyle = "#f0c04a";
    for (let x = 0; x < WORLD_W; x += 46) ctx.fillRect(x, 73, 26, 4);

    // обочина
    ctx.fillStyle = this.grass!;
    ctx.fillRect(0, HIGHWAY_H, WORLD_W, VERGE_H);
    ctx.fillStyle = "rgba(120,124,90,0.35)";
    ctx.fillRect(0, HIGHWAY_H, WORLD_W, 7);

    // площадка
    ctx.fillStyle = this.asphalt!;
    rr(ctx, (FORECOURT_X0 + FORECOURT_X1) / 2, (APRON_TOP + worldH - 18) / 2, FORECOURT_X1 - FORECOURT_X0, worldH - 18 - APRON_TOP, 16);
    ctx.fill();

    // съезды с шоссе
    ctx.fillStyle = this.asphalt!;
    for (const x of [ENTRY_X, EXIT_X]) {
      rr(ctx, x, HIGHWAY_H + VERGE_H / 2, 96, VERGE_H + 8, 6);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(240,240,230,0.5)";
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 7]);
    ctx.beginPath();
    ctx.moveTo(ENTRY_X - 46, HIGHWAY_H + 2);
    ctx.lineTo(ENTRY_X - 46, APRON_TOP);
    ctx.moveTo(EXIT_X + 46, HIGHWAY_H + 2);
    ctx.lineTo(EXIT_X + 46, APRON_TOP);
    ctx.stroke();
    ctx.setLineDash([]);

    // разметка очереди
    ctx.strokeStyle = "rgba(255,255,255,0.24)";
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 10]);
    for (const y of this.layout.queueRows) {
      ctx.beginPath();
      ctx.moveTo(FORECOURT_X0 + 12, y + 24);
      ctx.lineTo(FORECOURT_X1 - 12, y + 24);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // стрелка направления
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    for (let i = 0; i < 3; i++) {
      const ax = 150 + i * 90;
      const ay = this.layout.queueRows[0] - 28;
      ctx.beginPath();
      ctx.moveTo(ax, ay - 6);
      ctx.lineTo(ax + 16, ay);
      ctx.lineTo(ax, ay + 6);
      ctx.closePath();
      ctx.fill();
    }

    // разметка постов
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 2;
    for (const cell of this.layout.cells) {
      const y0 = cell.spot.y - 24;
      const y1 = cell.spot.y + 26;
      ctx.beginPath();
      ctx.moveTo(cell.spot.x - 48, y0);
      ctx.lineTo(cell.spot.x - 48, y1);
      ctx.lineTo(cell.spot.x + 48, y1);
      ctx.lineTo(cell.spot.x + 48, y0);
      ctx.stroke();
    }

    // зона у магазина
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    rr(ctx, 250, gridBottom + 16, 300, 16, 6);
    ctx.fill();

    if (game.raining) {
      ctx.fillStyle = "rgba(120,170,210,0.10)";
      ctx.fillRect(0, 0, WORLD_W, worldH);
    }
  }

  private drawObjects(game: Game, selectedId: number | null): void {
    const ctx = this.ctx;
    const { cells, canopy, shop, hatches, worldH, gridBottom } = this.layout;
    const items: { y: number; draw: () => void }[] = [];
    const push = (y: number, draw: () => void) => items.push({ y, draw });

    // озеленение
    push(HIGHWAY_H + 8, () => drawTree(ctx, 16, HIGHWAY_H + 6, 0.9));
    push(HIGHWAY_H + 8, () => drawTree(ctx, WORLD_W - 16, HIGHWAY_H + 10, 0.8));
    push(worldH - 30, () => drawTree(ctx, 18, worldH - 34, 1));
    push(worldH - 26, () => drawTree(ctx, WORLD_W - 20, worldH - 30, 0.95));
    push(worldH - 12, () => drawBush(ctx, 60, worldH - 14));
    push(worldH - 12, () => drawBush(ctx, WORLD_W - 64, worldH - 16));

    push(APRON_TOP + 4, () => drawLamp(ctx, FORECOURT_X0 + 10, APRON_TOP + 4));
    push(APRON_TOP + 4, () => drawLamp(ctx, FORECOURT_X1 - 10, APRON_TOP + 4));
    push(gridBottom + 6, () => drawLamp(ctx, FORECOURT_X0 + 10, gridBottom + 6));
    push(gridBottom + 30, () => drawTrashBin(ctx, FORECOURT_X0 + 34, gridBottom + 30));

    push(HIGHWAY_H + 12, () => drawTotem(ctx, WORLD_W - 78, HIGHWAY_H + 12, game.stars, game.shop.sign, game.phase === "night"));

    hatches.forEach((h, i) => {
      const tank = game.tanks[i];
      if (!tank) return;
      push(h.y, () => drawHatch(ctx, h.x, h.y, tank.fuel, tank.liters / tank.capacity));
    });

    // трафик на шоссе
    for (const c of this.traffic) {
      push(c.y, () => drawCar(ctx, c.look, c.x, c.y, c.dir === 1 ? 0 : Math.PI));
    }

    // бензовоз
    if (game.tanker && this.tankerX > -150) {
      const fuel = game.tanker.fuel;
      push(96, () => drawTanker(ctx, this.tankerX, 100, 0, fuel));
    }

    // острова и колонки
    game.pumps.forEach((pump, i) => {
      const cell = cells[i];
      if (!cell) return;
      const tank = game.tanks.find((t) => t.fuel === pump.fuel);
      const empty = !tank || tank.liters <= 0;
      push(cell.island.y - 6, () => drawIsland(ctx, cell.island.x, cell.island.y, cell.island.w, cell.island.h));
      push(cell.pump.y, () => {
        drawPump(ctx, cell.pump.x, cell.pump.y, pump.fuel, { busy: pump.occupant !== null, empty });
        const occ = pump.occupant;
        const car = occ ? this.cars.get(occ.carId) : undefined;
        if (car && Math.hypot(car.x - cell.spot.x, car.y - cell.spot.y) < 30) {
          drawHose(ctx, cell.pump.x, cell.pump.y - 6, car.x - car.look.len * 0.28, car.y + car.look.wid * 0.42, pump.fuel);
        }
      });
    });

    // машины игрока
    for (const v of this.cars.values()) {
      push(v.y, () =>
        drawCar(ctx, v.look, v.x, v.y, v.angle, {
          fuelColor: v.mode === "queue" ? FUEL_COLOR[v.fuel] : undefined,
          fuelLabel: v.mode === "queue" ? FUEL_LABEL[v.fuel] : undefined,
          waitRatio: v.mode === "queue" ? v.wait / LEAVE_AFTER : undefined,
          progress: v.progress ?? undefined,
          selected: v.id === selectedId,
        }),
      );
    }

    // заправщики
    this.attendants.forEach((a, i) => {
      const idle = game.status !== "working";
      push(a.y + 1, () => drawAttendant(ctx, a.x, a.y + i * 2, Math.PI / 2, idle));
    });

    // навес поверх постов, но перед магазином
    push(canopy.y + canopy.h / 2, () => drawCanopy(ctx, canopy, game.phase === "night"));

    push(shop.y, () => drawShop(ctx, shop.x, shop.y, shop.w, shop.h, game.shop, game.phase === "night"));

    items.sort((a, b) => a.y - b.y);
    for (const item of items) item.draw();
  }

  private drawNight(game: Game): void {
    if (game.phase === "day") return;
    const ctx = this.ctx;
    const { worldH, canopy, shop } = this.layout;
    const dark = game.phase === "night" ? 0.52 : 0.22;

    ctx.save();
    ctx.fillStyle = `rgba(14,22,44,${dark})`;
    ctx.fillRect(0, 0, WORLD_W, worldH);

    ctx.globalCompositeOperation = "lighter";
    const pool = (x: number, y: number, r: number, alpha: number, color = "255,236,180") => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${color},${alpha})`);
      g.addColorStop(1, `rgba(${color},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    };

    for (const cell of this.layout.cells) pool(cell.pump.x, cell.pump.y - 14, 96, 0.28);
    pool(canopy.x, canopy.y, 190, 0.14);
    pool(FORECOURT_X0 + 10, APRON_TOP + 4, 82, 0.22);
    pool(FORECOURT_X1 - 10, APRON_TOP + 4, 82, 0.22);
    pool(FORECOURT_X0 + 10, this.layout.gridBottom + 6, 82, 0.2);
    pool(shop.x - 24, shop.y - shop.h / 2, 78, 0.24, "255,226,150");
    if (game.shop.sign) pool(WORLD_W - 78, HIGHWAY_H + 4, 72, 0.3, "150,200,255");

    for (const v of this.cars.values()) {
      if (v.mode === "leaving" || v.path.length > 1) carHeadlightCone(ctx, v.x, v.y, v.angle, v.look.len);
    }
    for (const c of this.traffic) carHeadlightCone(ctx, c.x, c.y, c.dir === 1 ? 0 : Math.PI, c.look.len);
    ctx.restore();
  }

  private drawRain(game: Game): void {
    if (!game.raining) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = "rgba(190,215,240,0.42)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (const d of this.drops) {
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - d.len * 0.22, d.y - d.len);
    }
    ctx.stroke();

    ctx.strokeStyle = "rgba(200,225,250,0.16)";
    ctx.lineWidth = 1;
    const t = this.clock;
    for (let i = 0; i < 10; i++) {
      const px = ((i * 137) % WORLD_W) + 20;
      const py = APRON_TOP + ((i * 91) % Math.max(40, this.layout.worldH - APRON_TOP - 20));
      const r = ((t * 26 + i * 17) % 22) + 2;
      ctx.globalAlpha = Math.max(0, 1 - r / 24) * 0.6;
      ctx.beginPath();
      ctx.ellipse(px, py, r, r * 0.42, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
