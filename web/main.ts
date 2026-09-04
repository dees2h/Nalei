import { tankerCost } from "../src/economy/calculations.ts";
import { Game } from "../src/game.ts";
import { detectLang, t, type Lang, type StringKey } from "../src/i18n.ts";
import { loadFromLocal, saveToLocal } from "../src/save.ts";
import { Scene } from "./scene.ts";

const FUEL_LABEL: Record<string, string> = { "92": "92", "95": "95", "100": "100", diesel: "ДТ" };

const params = new URLSearchParams(location.search);
const warm = Number(params.get("warm") ?? 0);

let lang: Lang = detectLang();
let game = params.has("fresh") || warm > 0 ? new Game({ seed: 7 }) : loadFromLocal() ?? new Game({ seed: Date.now() % 1_000_000 });
if (warm > 0) game.tick(Math.min(3600, warm));
let paused = false;
let selectedCarId: number | null = null;
let last = performance.now();
let saveTimer = 0;
let hudTimer = 0;
let actionsKey = "";

const canvas = document.getElementById("scene") as HTMLCanvasElement;
const toastEl = document.getElementById("toast") as HTMLDivElement;
const tanksEl = document.getElementById("tanks") as HTMLDivElement;
const actionsEl = document.getElementById("actions") as HTMLDivElement;
const scene = new Scene(canvas);

function $(id: string) {
  return document.getElementById(id)!;
}

function label(key: StringKey): string {
  return t(lang, key);
}

function applyI18n(): void {
  $("title").textContent = label("title");
  $("tagline").textContent = label("tagline");
  $("lbl-money").textContent = label("money");
  $("lbl-queue").textContent = label("queue");
  $("btn-pause").textContent = paused ? label("resume") : label("pause");
  $("btn-new").textContent = label("newGame");
}

interface ActionSpec {
  text: string;
  run: () => void;
  enabled: () => boolean;
  primary?: boolean;
}

function actionSpecs(): ActionSpec[] {
  const specs: ActionSpec[] = [
    {
      text: label("order92"),
      run: () => game.orderTanker("92", "small"),
      enabled: () => game.tanker === null && game.money >= tankerCost("92", "small").total,
      primary: true,
    },
    { text: label("skipTanker"), run: () => game.skipTankerWait(), enabled: () => !!game.tanker && !game.tanker.adSkipUsed },
    { text: label("boost"), run: () => game.activateBoost(), enabled: () => game.boostLeft === 0 && game.boostCd === 0 },
    {
      text: label("debtBarrel"),
      run: () => game.takeDebtBarrel(),
      enabled: () => game.debtBarrel === 0 && (game.tanks.find((t) => t.fuel === "92")?.liters ?? 1) <= 0,
    },
    { text: label("priority"), run: () => selectedCarId != null && game.setPriority(selectedCarId), enabled: () => selectedCarId != null },
    { text: label("hold"), run: () => selectedCarId != null && game.holdCar(selectedCarId), enabled: () => selectedCarId != null },
    { text: label("hire"), run: () => game.hireAttendant(), enabled: () => game.attendantCount < 2 && game.money >= 2500 },
  ];
  if (game.attendantDebt > 0) {
    specs.push({ text: label("payDebt"), run: () => game.payAttendantDebt(), enabled: () => game.money >= game.attendantDebt });
  }
  for (const fuel of ["92", "95", "100", "diesel"] as const) {
    const key = fuel === "diesel" ? "pumpDiesel" : (`pump${fuel}` as StringKey);
    specs.push({
      text: `${label(key as StringKey)} · ${game.quotePump(fuel).total}`,
      run: () => game.buildPump(fuel),
      enabled: () => game.pumps.length < 6 && game.money >= game.quotePump(fuel).total,
    });
  }
  specs.push(
    { text: label("coffee"), run: () => game.buyShop("coffee"), enabled: () => !game.shop.coffee && game.money >= 3000 },
    { text: label("hotdog"), run: () => game.buyShop("hotdog"), enabled: () => !game.shop.hotdog && game.money >= 6000 },
    { text: label("drinks"), run: () => game.buyShop("drinks"), enabled: () => !game.shop.drinks && game.money >= 4500 },
    { text: label("toilet"), run: () => game.buyShop("toilet"), enabled: () => !game.shop.toilet && game.money >= 8000 },
    { text: label("sign"), run: () => game.buyShop("sign"), enabled: () => !game.shop.sign && game.money >= 5000 },
    { text: label("tank92"), run: () => game.upgradeTank92(), enabled: () => game.money >= 4500 },
    {
      text: label("contract"),
      run: () => game.buyContract(),
      enabled: () => !game.contract && game.deliveredTankers >= 15 && game.money >= 3500,
    },
  );
  return specs;
}

function renderActions(): void {
  const specs = actionSpecs();
  const key = specs.map((s) => `${s.text}|${s.enabled() ? 1 : 0}`).join(";");
  if (key === actionsKey) return;
  actionsKey = key;
  actionsEl.innerHTML = "";
  for (const spec of specs) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = spec.text;
    if (spec.primary) b.classList.add("primary");
    b.disabled = !spec.enabled();
    b.onclick = () => {
      spec.run();
      syncHud();
    };
    actionsEl.appendChild(b);
  }
}

function syncHud(): void {
  const s = game.snapshot();
  $("money").textContent = s.money.toLocaleString("ru-RU");
  $("queue").textContent = `${s.queue}/${s.queueLimit}`;
  $("stars").textContent = "★".repeat(s.stars);
  $("attract").textContent = s.a.toFixed(2);

  const phaseKey = s.phase === "day" ? "phaseDay" : s.phase === "evening" ? "phaseEvening" : "phaseNight";
  $("phase").textContent = `${label(phaseKey)} · ${label("stars")} ${s.stars}`;
  $("rain").classList.toggle("hidden", !s.raining);

  const eta = $("tanker-eta");
  if (s.tanker) {
    eta.textContent = `${label("tankerEta")} ${FUEL_LABEL[s.tanker.fuel]}: ${Math.ceil(s.tanker.eta)}s`;
    eta.classList.remove("hidden");
  } else eta.classList.add("hidden");

  tanksEl.innerHTML = "";
  for (const tank of s.tanks) {
    const row = document.createElement("div");
    row.className = "tank-row";
    const pct = Math.round((tank.liters / tank.capacity) * 100);
    const color = tank.fuel === "diesel" ? "dt" : tank.fuel;
    row.innerHTML = `<div><span class="dot" style="background:var(--${color})"></span>${FUEL_LABEL[tank.fuel]} · ${Math.round(
      tank.liters,
    )} / ${tank.capacity} ${label("liters")}</div>
      <div class="tank-bar"><div class="tank-fill" style="width:${pct}%;background:var(--${color})"></div></div>`;
    tanksEl.appendChild(row);
  }

  if (s.lastToast) {
    toastEl.textContent = s.lastToast;
    toastEl.classList.remove("hidden");
  } else toastEl.classList.add("hidden");

  renderActions();
}

canvas.addEventListener("pointerdown", (e) => {
  const id = scene.pick(e.clientX, e.clientY, game);
  selectedCarId = id;
  syncHud();
});

function loop(now: number): void {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!paused) {
    game.tick(dt);
    saveTimer += dt;
    if (saveTimer >= 5) {
      saveToLocal(game);
      saveTimer = 0;
    }
  }
  if (selectedCarId != null && !game.queue.some((c) => c.id === selectedCarId)) selectedCarId = null;
  scene.update(game, paused ? 0 : dt);
  scene.draw(game, selectedCarId);
  hudTimer += dt;
  if (hudTimer >= 0.2) {
    hudTimer = 0;
    syncHud();
  }
}

$("btn-pause").onclick = () => {
  paused = !paused;
  $("btn-pause").textContent = paused ? label("resume") : label("pause");
  if (paused) saveToLocal(game);
};

$("btn-new").onclick = () => {
  if (!confirm(lang === "ru" ? "Начать заново?" : "Start new game?")) return;
  game = new Game({ seed: Date.now() % 1_000_000 });
  selectedCarId = null;
  saveToLocal(game);
  syncHud();
};

document.addEventListener("visibilitychange", () => {
  paused = document.hidden;
  $("btn-pause").textContent = paused ? label("resume") : label("pause");
  if (document.hidden) saveToLocal(game);
});

window.addEventListener("resize", () => scene.resize());

applyI18n();
scene.resize();
syncHud();
requestAnimationFrame(loop);
