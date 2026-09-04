/**
 * Низкоуровневый рендер псевдо-3D сверху.
 * Объём делается послойной укладкой силуэтов (sprite stacking):
 * каждый слой смещается вдоль PARALLAX, нижние слои темнее.
 */

/** Смещение одного «этажа» высоты в мировых координатах. Камера строго сверху, чуть южнее зенита. */
export const PARALLAX = { x: 0.07, y: -0.55 };

/** Направление тени: свет сверху-слева. */
export const SHADOW = { x: 0.34, y: 0.44 };

export interface Lift {
  (z: number): { x: number; y: number };
}

/** Подъём на высоту z в локальных (уже повёрнутых) координатах объекта. */
export function makeLift(angle: number): Lift {
  const c = Math.cos(-angle);
  const s = Math.sin(-angle);
  return (z: number) => {
    const wx = PARALLAX.x * z;
    const wy = PARALLAX.y * z;
    return { x: wx * c - wy * s, y: wx * s + wy * c };
  };
}

export function rr(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, r: number): void {
  const rad = Math.max(0, Math.min(r, Math.min(Math.abs(w), Math.abs(h)) / 2));
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, cy - h / 2, w, h, rad);
}

/** Принимает как `#rgb`/`#rrggbb`, так и `rgb(r,g,b)` — цвета ходят по цепочке shade(). */
function parseColor(color: string): [number, number, number] {
  if (color.startsWith("rgb")) {
    const [r, g, b] = color.replace(/[^\d,.]/g, "").split(",").map(Number);
    return [r || 0, g || 0, b || 0];
  }
  const v = color.replace("#", "");
  const full = v.length === 3 ? v.split("").map((c) => c + c).join("") : v;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

/** amt > 0 — светлее, amt < 0 — темнее. */
export function shade(hex: string, amt: number): string {
  const [r, g, b] = parseColor(hex);
  const f = (c: number) => {
    const target = amt > 0 ? 255 : 0;
    return Math.round(c + (target - c) * Math.abs(amt));
  };
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = parseColor(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

export interface Slab {
  w: number;
  h: number;
  r?: number;
  z0: number;
  z1: number;
  dx?: number;
  dy?: number;
  color: string;
  /** Цвет верхней грани. По умолчанию — светлее боковин. */
  top?: string;
  /** Затемнение низа слоя (эффект контактной тени). */
  ao?: number;
}

/** Рисует один объём послойно. Вызывать внутри уже повёрнутого контекста. */
export function drawSlab(ctx: CanvasRenderingContext2D, slab: Slab, lift: Lift): void {
  const { w, h, z0, z1, color } = slab;
  const r = slab.r ?? 2;
  const dx = slab.dx ?? 0;
  const dy = slab.dy ?? 0;
  const ao = slab.ao ?? 0.34;
  const span = Math.max(1, z1 - z0);

  for (let z = z0; z <= z1; z += 1) {
    const t = (z - z0) / span;
    const p = lift(z);
    const isTop = z >= z1;
    ctx.fillStyle = isTop ? slab.top ?? shade(color, 0.12) : shade(color, -ao + ao * t * 0.9);
    rr(ctx, dx + p.x, dy + p.y, w, h, r);
    ctx.fill();
  }
}

export function drawSlabs(ctx: CanvasRenderingContext2D, slabs: Slab[], lift: Lift): void {
  for (const slab of [...slabs].sort((a, b) => a.z0 - b.z0)) drawSlab(ctx, slab, lift);
}

/** Мягкая тень под объектом высотой height. */
export function groundShadow(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  r: number,
  height: number,
  alpha = 0.3,
): void {
  const ox = SHADOW.x * height;
  const oy = SHADOW.y * height;
  for (let i = 3; i >= 1; i--) {
    const grow = i * 2.4;
    ctx.fillStyle = `rgba(8,14,20,${(alpha / 3) * (4 - i) * 0.55})`;
    rr(ctx, ox, oy, w + grow, h + grow, r + grow / 2);
    ctx.fill();
  }
}

/** Стеклянная поверхность с бликом. */
export function glass(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  r: number,
  tint = "#1b2a38",
): void {
  const g = ctx.createLinearGradient(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2);
  g.addColorStop(0, shade(tint, 0.28));
  g.addColorStop(0.45, tint);
  g.addColorStop(1, shade(tint, -0.25));
  ctx.fillStyle = g;
  rr(ctx, cx, cy, w, h, r);
  ctx.fill();
}

export function noisePattern(ctx: CanvasRenderingContext2D, base: string, dots: string[], size = 64): CanvasPattern {
  const off = document.createElement("canvas");
  off.width = size;
  off.height = size;
  const o = off.getContext("2d")!;
  o.fillStyle = base;
  o.fillRect(0, 0, size, size);
  for (let i = 0; i < size * 2; i++) {
    o.fillStyle = dots[i % dots.length];
    const x = Math.random() * size;
    const y = Math.random() * size;
    o.globalAlpha = 0.16 + Math.random() * 0.22;
    o.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  o.globalAlpha = 1;
  return ctx.createPattern(off, "repeat")!;
}
