#!/usr/bin/env tsx
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { DAY_LENGTH } from "../config.ts";
import { tankerCost } from "../economy/calculations.ts";
import { Game } from "../game.ts";
import { deserializeGame, serializeGame } from "../save.ts";

function printSnap(g: Game): void {
  const s = g.snapshot();
  console.log(
    [
      `t=${s.time.toFixed(0)}s day=${s.dayIndex} ${s.phase}`,
      `₽${s.money}`,
      `A=${s.a}`,
      `★${s.stars}`,
      `q=${s.queue}/${s.queueLimit}`,
      `served=${s.served}`,
      s.raining ? "🌧" : "",
    ].join(" | "),
  );
  for (const t of s.tanks) {
    console.log(`  tank ${t.fuel}: ${Math.round(t.liters)}/${t.capacity} л`);
  }
  if (s.tanker) console.log(`  tanker ${s.tanker.fuel} eta=${s.tanker.eta.toFixed(0)}s`);
  if (s.lastToast) console.log(`  >> ${s.lastToast}`);
}

function simDay(seed = 1): void {
  const g = new Game({ seed });
  const startMoney = g.money;
  g.tick(DAY_LENGTH);
  const s = g.snapshot();
  console.log("=== Sim day ===");
  console.log(`money ${startMoney} -> ${s.money} (Δ ${s.money - startMoney})`);
  console.log(`served=${s.served} left=${s.left} A=${s.a} stars=${s.stars}`);
  printSnap(g);
}

async function interactive(): Promise<void> {
  const g = new Game({ seed: Date.now() % 1_000_000 });
  const rl = readline.createInterface({ input, output });
  console.log("Налей CLI. Команды: tick <сек>, order, hire, coffee, sign, pump <92|95|100|diesel>, snap, save, load, quit");
  printSnap(g);

  while (true) {
    const line = (await rl.question("> ")).trim();
    const [cmd, arg] = line.split(/\s+/);
    if (cmd === "quit" || cmd === "q") break;
    if (cmd === "tick" || cmd === "t") g.tick(Number(arg) || 10);
    else if (cmd === "order" || cmd === "o") g.orderTanker("92", "small");
    else if (cmd === "hire") g.hireAttendant();
    else if (cmd === "coffee") g.buyShop("coffee");
    else if (cmd === "sign") g.buyShop("sign");
    else if (cmd === "pump" && arg) g.buildPump(arg as "92" | "95" | "100" | "diesel");
    else if (cmd === "snap" || cmd === "s") printSnap(g);
    else if (cmd === "save") {
      const path = arg || "save.json";
      await import("node:fs/promises").then((fs) => fs.writeFile(path, JSON.stringify(serializeGame(g), null, 2)));
      console.log(`saved ${path}`);
    } else if (cmd === "load") {
      const path = arg || "save.json";
      const raw = await import("node:fs/promises").then((fs) => fs.readFile(path, "utf8"));
      Object.assign(g, deserializeGame(JSON.parse(raw)));
      console.log(`loaded ${path}`);
    } else if (cmd === "help") {
      console.log(`small 92 costs ${tankerCost("92", "small").total}`);
    } else console.log("unknown");
    printSnap(g);
  }
  rl.close();
}

const args = process.argv.slice(2);
if (args.includes("--sim-day")) simDay(Number(args[args.indexOf("--seed") + 1]) || 1);
else interactive().catch(console.error);
