import type { VehicleId } from "../../src/types.ts";
import { drawSlabs, glass, groundShadow, makeLift, rr, shade, type Slab } from "../lib/draw.ts";

export type CarStyle = "sedan" | "hatch" | "wagon" | "crossover" | "premium" | "business" | "pickup" | "truck";

export interface CarLook {
  style: CarStyle;
  len: number;
  wid: number;
  body: string;
  roof: string;
  height: number;
}

const PALETTES: Record<CarStyle, string[]> = {
  sedan: ["#c94f4f", "#4a7bb5", "#d8d8d8", "#5b6472", "#3f7d5a", "#c9a227"],
  hatch: ["#e07a3f", "#59a9d8", "#e2e2e2", "#7b5ea7", "#4caf50"],
  wagon: ["#7d8a99", "#3f6f8f", "#b8bec7", "#6a7f5c"],
  crossover: ["#2f4f6f", "#7a4b2a", "#9aa5b1", "#375f4a", "#b0453a"],
  premium: ["#1f2a36", "#5e6b78", "#8c1c1c", "#d9d9d9"],
  business: ["#14181f", "#26303c", "#5a5f66", "#f0f0f0"],
  pickup: ["#37536b", "#7a3b2e", "#5c6b4a", "#9fa6ad"],
  truck: ["#2f6fb0", "#b03a3a", "#dcdcdc", "#4b5d6b"],
};

const STYLE_OF: Record<VehicleId, CarStyle> = {
  kometa: "sedan",
  malysh: "hatch",
  semya: "wagon",
  steppe: "crossover",
  lynx: "crossover",
  aurum: "premium",
  baron: "business",
  taiga: "pickup",
  magistral: "truck",
};

/** Вертикальный масштаб слоёв: выше стопка — заметнее объём. */
const ZS = 1.4;

const SIZE_OF: Record<CarStyle, { len: number; wid: number; height: number }> = {
  sedan: { len: 66, wid: 30, height: 22 },
  hatch: { len: 56, wid: 29, height: 22 },
  wagon: { len: 71, wid: 30, height: 24 },
  crossover: { len: 69, wid: 33, height: 27 },
  premium: { len: 74, wid: 32, height: 23 },
  business: { len: 76, wid: 32, height: 23 },
  pickup: { len: 76, wid: 33, height: 27 },
  truck: { len: 122, wid: 35, height: 42 },
};

export function carLook(vehicle: VehicleId, seed: number): CarLook {
  const style = STYLE_OF[vehicle];
  const size = SIZE_OF[style];
  const palette = PALETTES[style];
  const body = palette[Math.abs(seed * 2654435761) % palette.length];
  return { style, len: size.len, wid: size.wid, height: size.height, body, roof: shade(body, -0.12) };
}

const TIRE = "#15181c";
const GLASS = "#1d2b3a";

function wheels(len: number, wid: number, rows: number[], z1 = 5): Slab[] {
  const out: Slab[] = [];
  for (const dx of rows) {
    for (const side of [-1, 1]) {
      out.push({
        w: len * 0.17,
        h: 5.5,
        r: 2,
        z0: 0,
        z1,
        dx,
        dy: side * (wid / 2 - 1.2),
        color: TIRE,
        top: "#23272c",
        ao: 0.2,
      });
    }
  }
  return out;
}

function scaleZ(slabs: Slab[]): Slab[] {
  return slabs.map((s) => ({ ...s, z0: s.z0 * ZS, z1: s.z1 * ZS }));
}

function carSlabs(look: CarLook): Slab[] {
  const { len: L, wid: W, body, roof } = look;
  const base: Slab[] = [];

  if (look.style === "truck") {
    base.push(...wheels(L, W, [L * 0.38, -L * 0.05, -L * 0.2, -L * 0.34], 7));
    // кабина
    base.push({ w: L * 0.26, h: W, r: 5, z0: 5, z1: 30, dx: L * 0.35, color: body, top: shade(body, 0.16) });
    // сцепка
    base.push({ w: L * 0.08, h: W * 0.4, r: 2, z0: 6, z1: 12, dx: L * 0.19, color: "#3a3f45" });
    // цистерна: сужение слоёв даёт цилиндр
    const tankLen = L * 0.58;
    const tankX = -L * 0.14;
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      const h = W * (0.62 + 0.36 * Math.sin(Math.PI * (0.15 + 0.7 * (1 - Math.abs(t - 0.5) * 2))));
      base.push({
        w: tankLen,
        h: Math.min(W, h),
        r: Math.min(W, h) / 2,
        z0: 6 + i * 3,
        z1: 9 + i * 3,
        dx: tankX,
        color: "#cfd6dd",
        top: i === 6 ? "#e8eef4" : undefined,
        ao: 0.26,
      });
    }
    return scaleZ(base);
  }

  base.push(...wheels(L, W, [L * 0.3, -L * 0.3]));
  // днище
  base.push({ w: L * 0.96, h: W * 0.84, r: 6, z0: 3, z1: 6, dx: 0, color: shade(body, -0.55), ao: 0.15 });

  switch (look.style) {
    case "pickup": {
      base.push({ w: L, h: W, r: W * 0.22, z0: 6, z1: 13, color: body, top: shade(body, 0.1) });
      // кабина спереди
      base.push({ w: L * 0.34, h: W * 0.86, r: W * 0.22, z0: 13, z1: 19, dx: L * 0.12, color: roof, top: shade(body, 0.14) });
      // борта кузова
      base.push({ w: L * 0.42, h: W * 0.9, r: 4, z0: 13, z1: 16, dx: -L * 0.24, color: shade(body, -0.1) });
      base.push({ w: L * 0.36, h: W * 0.68, r: 3, z0: 12, z1: 13.5, dx: -L * 0.24, color: "#3b3f44", ao: 0.1 });
      break;
    }
    case "crossover": {
      base.push({ w: L, h: W, r: W * 0.24, z0: 6, z1: 14, color: body, top: shade(body, 0.1) });
      base.push({ w: L * 0.6, h: W * 0.88, r: W * 0.26, z0: 14, z1: 19, dx: -L * 0.04, color: roof, top: shade(body, 0.16) });
      // рейлинги
      for (const side of [-1, 1]) {
        base.push({ w: L * 0.4, h: 2, r: 1, z0: 19, z1: 20.5, dx: -L * 0.05, dy: side * W * 0.32, color: "#2b3038" });
      }
      break;
    }
    case "business":
    case "premium": {
      base.push({ w: L, h: W, r: W * 0.24, z0: 6, z1: 12, color: body, top: shade(body, 0.12) });
      base.push({ w: L * 0.5, h: W * 0.84, r: W * 0.3, z0: 12, z1: 16, dx: -L * 0.05, color: roof, top: shade(body, 0.18) });
      // хромированные бамперы
      base.push({ w: 3, h: W * 0.72, r: 1.5, z0: 7, z1: 9, dx: L * 0.48, color: "#c8ccd2", top: "#e9edf2" });
      base.push({ w: 3, h: W * 0.72, r: 1.5, z0: 7, z1: 9, dx: -L * 0.48, color: "#c8ccd2", top: "#e9edf2" });
      break;
    }
    case "wagon": {
      base.push({ w: L, h: W, r: W * 0.22, z0: 6, z1: 12, color: body, top: shade(body, 0.1) });
      base.push({ w: L * 0.62, h: W * 0.86, r: W * 0.24, z0: 12, z1: 17, dx: -L * 0.12, color: roof, top: shade(body, 0.15) });
      break;
    }
    case "hatch": {
      base.push({ w: L, h: W, r: W * 0.24, z0: 6, z1: 12, color: body, top: shade(body, 0.1) });
      base.push({ w: L * 0.5, h: W * 0.84, r: W * 0.28, z0: 12, z1: 16.5, dx: -L * 0.08, color: roof, top: shade(body, 0.16) });
      break;
    }
    default: {
      base.push({ w: L, h: W, r: W * 0.24, z0: 6, z1: 12, color: body, top: shade(body, 0.1) });
      base.push({ w: L * 0.52, h: W * 0.84, r: W * 0.26, z0: 12, z1: 16, dx: -L * 0.03, color: roof, top: shade(body, 0.16) });
    }
  }

  // зеркала
  for (const side of [-1, 1]) {
    base.push({ w: 5, h: 3.5, r: 1.4, z0: 10, z1: 12, dx: L * 0.14, dy: side * (W / 2 + 2), color: shade(body, -0.2) });
  }
  return scaleZ(base);
}

function topDeck(look: CarLook): number {
  const raw = (() => {
    switch (look.style) {
      case "crossover":
      case "pickup":
        return 19;
      case "wagon":
        return 17;
      case "hatch":
        return 16.5;
      case "truck":
        return 30;
      default:
        return 16;
    }
  })();
  return raw * ZS;
}

export interface CarDecor {
  fuelColor?: string;
  fuelLabel?: string;
  progress?: number;
  selected?: boolean;
  waitRatio?: number;
  headlights?: boolean;
}

export function drawCar(
  ctx: CanvasRenderingContext2D,
  look: CarLook,
  x: number,
  y: number,
  angle: number,
  decor: CarDecor = {},
): void {
  const lift = makeLift(angle);
  const { len: L, wid: W } = look;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  groundShadow(ctx, L * 0.94, W * 0.92, W * 0.3, look.height, 0.34);
  drawSlabs(ctx, carSlabs(look), lift);

  const deck = topDeck(look);
  const p = lift(deck);
  ctx.save();
  ctx.translate(p.x, p.y);

  if (look.style === "truck") {
    glass(ctx, L * 0.44, 0, 5, W * 0.72, 2, GLASS);
    ctx.fillStyle = "#39414a";
    rr(ctx, -L * 0.14, 0, L * 0.5, 3, 1.5);
    ctx.fill();
  } else if (look.style === "pickup") {
    glass(ctx, L * 0.23, 0, 5, W * 0.7, 2, GLASS);
    glass(ctx, L * 0.02, 0, 4, W * 0.66, 2, GLASS);
  } else {
    const cabin = look.style === "wagon" ? -L * 0.12 : -L * 0.04;
    const cabLen = look.style === "wagon" ? L * 0.62 : L * 0.52;
    // крыша
    ctx.fillStyle = shade(look.body, 0.05);
    rr(ctx, cabin, 0, cabLen * 0.54, W * 0.66, 3.5);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    rr(ctx, cabin, -W * 0.14, cabLen * 0.42, W * 0.16, 2);
    ctx.fill();
    // лобовое и заднее стекло
    glass(ctx, cabin + cabLen / 2 - 2.2, 0, 4.4, W * 0.66, 2, GLASS);
    glass(ctx, cabin - cabLen / 2 + 2, 0, 3.6, W * 0.58, 1.8, GLASS);
    // боковые окна
    for (const side of [-1, 1]) {
      glass(ctx, cabin, side * W * 0.31, cabLen * 0.5, 2.2, 1.1, shade(GLASS, 0.16));
    }
  }
  ctx.restore();

  // фары и фонари на уровне бампера
  const lp = lift(9 * ZS);
  ctx.save();
  ctx.translate(lp.x, lp.y);
  for (const side of [-1, 1]) {
    ctx.fillStyle = "#ffe9a8";
    rr(ctx, L * 0.45, side * W * 0.28, 4, 5, 1.5);
    ctx.fill();
    ctx.fillStyle = "#d24b4b";
    rr(ctx, -L * 0.46, side * W * 0.3, 3, 5, 1.5);
    ctx.fill();
  }
  ctx.restore();

  ctx.restore();

  // индикаторы поверх сцены, без поворота
  ctx.save();
  ctx.translate(x, y);
  const badgeY = -W * 0.5 - 16;

  if (decor.selected) {
    ctx.strokeStyle = "#ffd166";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    rr(ctx, 0, 0, L + 10, W + 10, 8);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (decor.fuelColor && decor.fuelLabel) {
    ctx.fillStyle = "rgba(12,18,26,0.82)";
    rr(ctx, 0, badgeY, 30, 15, 7);
    ctx.fill();
    ctx.fillStyle = decor.fuelColor;
    ctx.beginPath();
    ctx.arc(-9, badgeY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f2f6fa";
    ctx.font = "bold 9px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(decor.fuelLabel, 4, badgeY + 0.5);
  }

  if (decor.waitRatio != null && decor.waitRatio > 0.02) {
    const w = 30;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    rr(ctx, 0, badgeY + 12, w, 4, 2);
    ctx.fill();
    ctx.fillStyle = decor.waitRatio > 0.65 ? "#ef4444" : "#48c774";
    rr(ctx, -w / 2 + (w * Math.min(1, decor.waitRatio)) / 2, badgeY + 12, w * Math.min(1, decor.waitRatio), 4, 2);
    ctx.fill();
  }

  if (decor.progress != null) {
    const r = 13;
    ctx.strokeStyle = "rgba(10,16,22,0.6)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, badgeY, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "#48c774";
    ctx.beginPath();
    ctx.arc(0, badgeY, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * decor.progress);
    ctx.stroke();
  }
  ctx.restore();
}

export function carHeadlightCone(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, len: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const g = ctx.createLinearGradient(len * 0.4, 0, len * 0.4 + 70, 0);
  g.addColorStop(0, "rgba(255,238,180,0.30)");
  g.addColorStop(1, "rgba(255,238,180,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(len * 0.45, -7);
  ctx.lineTo(len * 0.45 + 72, -24);
  ctx.lineTo(len * 0.45 + 72, 24);
  ctx.lineTo(len * 0.45, 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
