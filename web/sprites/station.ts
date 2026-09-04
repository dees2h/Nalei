import type { Fuel } from "../../src/types.ts";
import { drawSlabs, glass, groundShadow, makeLift, rr, rgba, shade, type Slab } from "../lib/draw.ts";

export const FUEL_COLOR: Record<Fuel, string> = {
  "92": "#4caf50",
  "95": "#2196f3",
  "100": "#ffca28",
  diesel: "#8d6e4a",
};

export const FUEL_LABEL: Record<Fuel, string> = {
  "92": "92",
  "95": "95",
  "100": "100",
  diesel: "ДТ",
};

const CONCRETE = "#c9ced6";
const METAL = "#dfe4ea";

/** Бетонный островок под колонку. */
export function drawIsland(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const lift = makeLift(0);
  ctx.save();
  ctx.translate(x, y);
  groundShadow(ctx, w, h, 6, 4, 0.22);
  drawSlabs(ctx, [{ w, h, r: 6, z0: 0, z1: 4, color: CONCRETE, top: "#e3e7ec", ao: 0.22 }], lift);
  const p = lift(4);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = "#f0c04a";
  rr(ctx, 0, -h / 2 + 2.5, w - 8, 2.5, 1.2);
  ctx.fill();
  rr(ctx, 0, h / 2 - 2.5, w - 8, 2.5, 1.2);
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

/** Топливораздаточная колонка: корпус, дисплей, пистолеты. */
export function drawPump(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  fuel: Fuel,
  opts: { busy?: boolean; empty?: boolean; pulse?: number } = {},
): void {
  const lift = makeLift(0);
  const accent = FUEL_COLOR[fuel];
  ctx.save();
  ctx.translate(x, y);
  groundShadow(ctx, 27, 19, 3, 36, 0.3);

  const slabs: Slab[] = [
    { w: 32, h: 22, r: 3, z0: 4, z1: 8, color: "#8d949d", ao: 0.2 },
    { w: 25, h: 16, r: 3, z0: 8, z1: 26, color: METAL, top: "#f2f5f8" },
    { w: 25, h: 16, r: 3, z0: 26, z1: 30, color: accent, top: shade(accent, 0.2) },
    { w: 19, h: 12, r: 2, z0: 30, z1: 36, color: "#2b323b", top: "#39424d" },
  ];
  drawSlabs(ctx, slabs, lift);

  // пистолеты по бокам
  for (const side of [-1, 1]) {
    drawSlabs(
      ctx,
      [{ w: 6, h: 4, r: 1.6, z0: 15, z1: 22, dy: side * 10, color: shade(accent, -0.25), top: accent }],
      lift,
    );
  }

  const top = lift(36);
  ctx.save();
  ctx.translate(top.x, top.y);
  ctx.fillStyle = opts.busy ? "#0e2a18" : "#101820";
  rr(ctx, 0, 0, 15, 8, 1.8);
  ctx.fill();
  ctx.fillStyle = opts.empty ? "#ef4444" : opts.busy ? "#7bf59a" : "#5f6b78";
  ctx.font = "bold 7px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(FUEL_LABEL[fuel], 0, 0.5);
  ctx.restore();

  // цветовая метка на асфальте — видно даже под навесом
  ctx.fillStyle = rgba(accent, 0.85);
  ctx.font = "bold 11px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(FUEL_LABEL[fuel], 0, 20);

  ctx.restore();
}

/** Шланг от колонки к машине. */
export function drawHose(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  fuel: Fuel,
): void {
  ctx.save();
  ctx.strokeStyle = "rgba(20,24,30,0.75)";
  ctx.lineWidth = 2.4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(fromX, fromY - 6);
  ctx.bezierCurveTo(fromX, fromY - 18, (fromX + toX) / 2, toY + 12, toX, toY);
  ctx.stroke();
  ctx.fillStyle = FUEL_COLOR[fuel];
  ctx.beginPath();
  ctx.arc(toX, toY, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export interface CanopyRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Тень навеса на асфальте — рисуется до объектов. */
export function drawCanopyShadow(ctx: CanvasRenderingContext2D, rect: CanopyRect): void {
  ctx.save();
  ctx.fillStyle = "rgba(10,16,24,0.16)";
  rr(ctx, rect.x + 14, rect.y + 22, rect.w, rect.h, 14);
  ctx.fill();
  ctx.restore();
}

/** Навес: опоры непрозрачны, крыша полупрозрачна, чтобы не прятать колонки. */
export function drawCanopy(ctx: CanvasRenderingContext2D, rect: CanopyRect, lit: boolean): void {
  const lift = makeLift(0);
  const px = [rect.x - rect.w / 2 + 14, rect.x + rect.w / 2 - 14];
  const py = [rect.y - rect.h / 2 + 14, rect.y + rect.h / 2 - 14];

  ctx.save();
  for (const cx of px) {
    for (const cy of py) {
      ctx.save();
      ctx.translate(cx, cy);
      groundShadow(ctx, 10, 10, 2, 48, 0.3);
      drawSlabs(ctx, [{ w: 10, h: 10, r: 2, z0: 0, z1: 48, color: "#cfd6de", top: "#eef2f6" }], lift);
      ctx.restore();
    }
  }
  ctx.restore();

  // крыша прозрачная: пост под ней должен читаться
  ctx.save();
  ctx.translate(rect.x, rect.y);
  const bottom = lift(48);
  const p = lift(56);

  ctx.fillStyle = "rgba(146,162,180,0.13)";
  rr(ctx, bottom.x, bottom.y, rect.w, rect.h, 14);
  ctx.fill();

  ctx.fillStyle = "rgba(226,234,242,0.09)";
  rr(ctx, p.x, p.y, rect.w, rect.h, 14);
  ctx.fill();

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.strokeStyle = "rgba(238,244,250,0.7)";
  ctx.lineWidth = 2.5;
  rr(ctx, 0, 0, rect.w, rect.h, 14);
  ctx.stroke();
  // фризовая полоса бренда по краю навеса
  ctx.fillStyle = "#2f6fed";
  rr(ctx, 0, -rect.h / 2 + 4, rect.w - 30, 8, 4);
  ctx.fill();
  ctx.fillStyle = "#f2f6fb";
  ctx.font = "bold 8px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Н А Л Е Й", 0, -rect.h / 2 + 4.5);
  if (lit) {
    ctx.fillStyle = "rgba(255,244,200,0.5)";
    for (let i = -1; i <= 1; i++) {
      rr(ctx, (i * rect.w) / 3.2, 0, 26, 5, 2.5);
      ctx.fill();
    }
  }
  ctx.restore();
  ctx.restore();
}

export interface ShopFlags {
  coffee: boolean;
  hotdog: boolean;
  drinks: boolean;
  toilet: boolean;
  sign: boolean;
}

/** Магазин-операторная: коробка со скатной крышей, витрины к площадке. */
export function drawShop(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  flags: ShopFlags,
  lit: boolean,
): void {
  const lift = makeLift(0);
  ctx.save();
  ctx.translate(x, y);
  groundShadow(ctx, w, h, 8, 38, 0.34);

  drawSlabs(
    ctx,
    [
      { w, h, r: 6, z0: 0, z1: 30, color: "#ddd2bd", top: "#efe6d5" },
      { w: w - 14, h: h - 14, r: 6, z0: 30, z1: 38, color: "#525c69", top: "#6f7a88" },
    ],
    lift,
  );

  const rw = w - 14;
  const rh = h - 14;
  const roof = lift(38);
  ctx.save();
  ctx.translate(roof.x, roof.y);
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 1;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo((i * rw) / 5.5, -rh / 2 + 4);
    ctx.lineTo((i * rw) / 5.5, rh / 2 - 4);
    ctx.stroke();
  }
  ctx.strokeStyle = "#8f99a5";
  ctx.lineWidth = 2.5;
  rr(ctx, 0, 0, rw, rh, 6);
  ctx.stroke();
  // вентиляция, кондиционеры, люк
  ctx.fillStyle = "#98a2ad";
  rr(ctx, -rw * 0.3, rh * 0.06, 20, 14, 3);
  ctx.fill();
  rr(ctx, rw * 0.08, -rh * 0.14, 14, 12, 3);
  ctx.fill();
  ctx.fillStyle = "#727c88";
  rr(ctx, rw * 0.34, rh * 0.22, 12, 12, 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  rr(ctx, -rw * 0.3, rh * 0.06, 13, 7, 2);
  ctx.fill();
  ctx.restore();

  // витрина, вход и вывеска со стороны площадки
  const face = lift(30);
  ctx.save();
  ctx.translate(face.x, face.y);
  glass(ctx, -w * 0.12, -h / 2 + 5, w * 0.52, 8, 2.5, lit ? "#f7e6a8" : "#2b3d4f");
  ctx.fillStyle = "#2f6fed";
  rr(ctx, w * 0.3, -h / 2 + 5, w * 0.2, 9, 2.5);
  ctx.fill();
  ctx.fillStyle = "#f4f8fd";
  ctx.font = "bold 6px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("ВХОД", w * 0.3, -h / 2 + 5.5);
  ctx.fillStyle = "#2f6fed";
  rr(ctx, -w * 0.12, h / 2 - 5, w * 0.7, 9, 4);
  ctx.fill();
  ctx.fillStyle = "#eef4fb";
  ctx.font = "bold 7px system-ui, sans-serif";
  ctx.fillText("НАЛЕЙ · МАРКЕТ", -w * 0.12, h / 2 - 4.5);
  ctx.restore();

  // козырёк над входом
  drawSlabs(ctx, [{ w: w * 0.5, h: 11, r: 3, z0: 26, z1: 29, dx: -w * 0.06, dy: -h / 2 - 6, color: "#2f6fed", top: "#5a8ef5" }], lift);

  // иконки услуг на крыше
  const icons: string[] = [];
  if (flags.coffee) icons.push("☕");
  if (flags.hotdog) icons.push("🌭");
  if (flags.drinks) icons.push("🥤");
  if (flags.toilet) icons.push("WC");
  if (icons.length) {
    ctx.save();
    ctx.translate(face.x, face.y);
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    icons.forEach((icon, i) => {
      const ix = -((icons.length - 1) * 20) / 2 + i * 20;
      ctx.fillStyle = "rgba(16,22,30,0.6)";
      rr(ctx, ix, -h / 2 - 6, 17, 15, 4);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillText(icon, ix, -h / 2 - 5);
    });
    ctx.restore();
  }

  ctx.restore();
}

/** Стела с ценами у дороги. */
export function drawTotem(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  stars: number,
  hasSign: boolean,
  lit: boolean,
): void {
  const lift = makeLift(0);
  ctx.save();
  ctx.translate(x, y);
  groundShadow(ctx, 12, 12, 3, 60, 0.32);
  drawSlabs(
    ctx,
    [
      { w: 14, h: 14, r: 3, z0: 0, z1: 6, color: "#9aa3ad" },
      { w: 8, h: 8, r: 2, z0: 6, z1: 58, color: "#b9c1c9", top: "#d7dee5" },
      { w: 34, h: 26, r: 4, z0: 58, z1: 66, color: hasSign ? "#2f6fed" : "#48505b", top: hasSign ? "#4b86ff" : "#5d6772" },
    ],
    lift,
  );
  const p = lift(66);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = lit && hasSign ? "#fff6cc" : "#e8eef5";
  ctx.font = "bold 9px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("НАЛЕЙ", 0, -6);
  ctx.font = "7px system-ui, sans-serif";
  ctx.fillStyle = "#ffd166";
  ctx.fillText("★".repeat(Math.max(1, stars)), 0, 6);
  ctx.restore();
  ctx.restore();
}

/** Люк подземного резервуара. */
export function drawHatch(ctx: CanvasRenderingContext2D, x: number, y: number, fuel: Fuel, ratio: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#5b6068";
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#767d86";
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = FUEL_COLOR[fuel];
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.02, ratio));
  ctx.stroke();
  ctx.fillStyle = "#e8eef5";
  ctx.font = "bold 6px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(FUEL_LABEL[fuel], 0, 0.5);
  ctx.restore();
}

export function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number): void {
  const lift = makeLift(0);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  groundShadow(ctx, 20, 20, 10, 30, 0.3);
  drawSlabs(
    ctx,
    [
      { w: 7, h: 7, r: 3, z0: 0, z1: 14, color: "#5b4530" },
      { w: 26, h: 26, r: 13, z0: 14, z1: 22, color: "#2f6b3d", ao: 0.4 },
      { w: 21, h: 21, r: 10.5, z0: 22, z1: 28, color: "#3d8049" },
      { w: 13, h: 13, r: 6.5, z0: 28, z1: 32, color: "#4e9a58", top: "#63b16c" },
    ],
    lift,
  );
  ctx.restore();
}

export function drawBush(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const lift = makeLift(0);
  ctx.save();
  ctx.translate(x, y);
  groundShadow(ctx, 14, 12, 6, 10, 0.24);
  drawSlabs(
    ctx,
    [
      { w: 16, h: 13, r: 6.5, z0: 0, z1: 7, color: "#356b3c" },
      { w: 11, h: 9, r: 4.5, z0: 7, z1: 11, color: "#4a8c50", top: "#5da562" },
    ],
    lift,
  );
  ctx.restore();
}

export function drawLamp(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const lift = makeLift(0);
  ctx.save();
  ctx.translate(x, y);
  groundShadow(ctx, 8, 8, 3, 44, 0.3);
  drawSlabs(
    ctx,
    [
      { w: 10, h: 10, r: 3, z0: 0, z1: 4, color: "#7d848d" },
      { w: 5, h: 5, r: 2, z0: 4, z1: 42, color: "#a8b0b8", top: "#c6ced6" },
      { w: 14, h: 8, r: 3, z0: 42, z1: 46, color: "#5d6670", top: "#fff2c0" },
    ],
    lift,
  );
  ctx.restore();
}

export function drawTrashBin(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const lift = makeLift(0);
  ctx.save();
  ctx.translate(x, y);
  groundShadow(ctx, 10, 10, 3, 14, 0.24);
  drawSlabs(
    ctx,
    [
      { w: 11, h: 11, r: 3, z0: 0, z1: 12, color: "#2f6fed" },
      { w: 12, h: 12, r: 3, z0: 12, z1: 14, color: "#1f2a36", top: "#2c3947" },
    ],
    lift,
  );
  ctx.restore();
}

/** Заправщик в жилете. */
export function drawAttendant(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, idle: boolean): void {
  const lift = makeLift(angle);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  groundShadow(ctx, 9, 9, 4.5, 18, 0.3);
  drawSlabs(
    ctx,
    [
      { w: 8, h: 9, r: 3, z0: 0, z1: 8, color: "#25313f" },
      { w: 9, h: 10, r: 3.5, z0: 8, z1: 15, color: idle ? "#c9a227" : "#f2a007", top: "#ffc23d" },
      { w: 6.5, h: 6.5, r: 3.2, z0: 15, z1: 19, color: "#d9a377", top: "#eec099" },
    ],
    lift,
  );
  const p = lift(19);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = "#2b3038";
  rr(ctx, -0.5, 0, 5.5, 5.5, 2.6);
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

/** Бензовоз поставщика. */
export function drawTanker(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, fuel: Fuel): void {
  const lift = makeLift(angle);
  const L = 118;
  const W = 30;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  groundShadow(ctx, L * 0.94, W, 8, 32, 0.36);

  const slabs: Slab[] = [];
  for (const dx of [L * 0.4, L * 0.28, -L * 0.02, -L * 0.16, -L * 0.3, -L * 0.42]) {
    for (const side of [-1, 1]) {
      slabs.push({ w: 13, h: 6, r: 2.5, z0: 0, z1: 7, dx, dy: side * (W / 2 - 1.5), color: "#15181c", top: "#23272c", ao: 0.2 });
    }
  }
  slabs.push({ w: L * 0.24, h: W, r: 5, z0: 5, z1: 32, dx: L * 0.36, color: "#2f6fed", top: "#4d87f7" });
  slabs.push({ w: L * 0.1, h: W * 0.5, r: 2, z0: 6, z1: 14, dx: L * 0.2, color: "#39414a" });
  slabs.push({ w: L * 0.62, h: W * 0.86, r: 4, z0: 4, z1: 8, dx: -L * 0.12, color: "#4a525c" });

  const tankColor = FUEL_COLOR[fuel];
  for (let i = 0; i < 8; i++) {
    const t = i / 7;
    const prof = Math.sin(Math.PI * (0.12 + 0.76 * t));
    const h = W * (0.5 + 0.48 * prof);
    slabs.push({
      w: L * 0.6,
      h,
      r: h / 2,
      z0: 8 + i * 2.6,
      z1: 10.6 + i * 2.6,
      dx: -L * 0.12,
      color: "#d3dae1",
      top: i === 7 ? "#eef3f8" : undefined,
      ao: 0.24,
    });
  }
  drawSlabs(ctx, slabs, lift);

  const p = lift(29);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = tankColor;
  rr(ctx, -L * 0.12, 0, L * 0.34, 8, 4);
  ctx.fill();
  ctx.fillStyle = "#182029";
  ctx.font = "bold 8px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(FUEL_LABEL[fuel], -L * 0.12, 0.5);
  ctx.restore();

  const cab = lift(32);
  ctx.save();
  ctx.translate(cab.x, cab.y);
  glass(ctx, L * 0.45, 0, 5, W * 0.74, 2, "#1d2b3a");
  ctx.restore();

  ctx.restore();
}
