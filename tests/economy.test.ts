import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  APPROACH_SEC,
  DIESEL_LPS,
  FILL_MEAN,
  PETROL_LPS,
  START_92_LITERS,
} from "../src/config.ts";
import {
  attractiveness,
  dieselGiftProfit,
  fuelMargin,
  kDayCycleAverage,
  occupancySeconds,
  pumpAccepts,
  pumpQuote,
  shopABonus,
  startStateCheck,
  startWageShare,
  tankerCost,
  wageInCorridor,
} from "../src/economy/calculations.ts";
import { Game } from "../src/game.ts";
import { deserializeGame, serializeGame } from "../src/save.ts";
import { mulberry32 } from "../src/rng.ts";
import type { Pump, ShopState } from "../src/types.ts";

describe("economy calculations", () => {
  it("H08: column speed 6/18 l/s + 4s approach", () => {
    const petrol = occupancySeconds(32, "92", 0);
    assert.equal(petrol, APPROACH_SEC + 32 / PETROL_LPS);
    const diesel = occupancySeconds(320, "diesel", 0);
    assert.equal(diesel, APPROACH_SEC + 320 / DIESEL_LPS);
    assert.ok(diesel / petrol > 2 && diesel / petrol < 3);
  });

  it("H09: fill ratio mean 80%", () => {
    const rng = mulberry32(42);
    let sum = 0;
    const n = 5000;
    for (let i = 0; i < n; i++) sum += (0.6 + rng() * 0.4) * 40;
    const mean = sum / n / 40;
    assert.ok(Math.abs(mean - FILL_MEAN) < 0.02);
  });

  it("H10: start tanks and money", () => {
    const s = startStateCheck();
    assert.equal(s.money, 8000);
    assert.equal(s.liters92, 350);
    assert.equal(s.litersDiesel, 1800);
  });

  it("H12: small 92 tanker costs 9400", () => {
    assert.equal(tankerCost("92", "small").total, 9400);
  });

  it("H13: first 95 column at 2 pumps = 20400", () => {
    assert.equal(pumpQuote(2, "95", false).total, 5000 + 4000 + 11400);
  });

  it("H14: diesel gift profit", () => {
    assert.equal(dieselGiftProfit(), 1800 * fuelMargin("diesel"));
    assert.equal(dieselGiftProfit(), 12600);
  });

  it("H15: A start 1.0, empty 92 penalty", () => {
    const base = {
      pumps: [
        { id: 1, fuel: "92" as const, idle: 0, occupant: null },
        { id: 2, fuel: "diesel" as const, idle: 0, occupant: null },
      ],
      tanks: [
        { fuel: "92" as const, capacity: 2000, liters: 350 },
        { fuel: "diesel" as const, capacity: 3000, liters: 1800 },
      ],
      shop: { coffee: false, hotdog: false, drinks: false, toilet: false, sign: false },
      phase: "day" as const,
      leftInWindow: 0,
    };
    assert.equal(attractiveness(base), 1);
    assert.equal(attractiveness({ ...base, tanks: [{ ...base.tanks[0], liters: 0 }, base.tanks[1]] }), 0.65);
  });

  it("H16: shop A capped at 0.50 by day", () => {
    const shop: ShopState = { coffee: true, hotdog: true, drinks: true, toilet: true, sign: true };
    assert.equal(shopABonus(shop, "day"), 0.5);
  });

  it("H17: wage share in corridor", () => {
    assert.equal(startWageShare(), 400 / 7100);
    assert.ok(wageInCorridor(startWageShare()));
  });

  it("H18: k day cycle average", () => {
    assert.equal(kDayCycleAverage(), 4.975);
  });

  it("H19: pump 100 accepts 95 after 8s idle", () => {
    const pump: Pump = { id: 1, fuel: "100", idle: 8, occupant: null };
    assert.equal(pumpAccepts(pump, "95"), true);
    pump.idle = 7;
    assert.equal(pumpAccepts(pump, "95"), false);
  });
});

describe("game simulation", () => {
  it("H11: ~200L 92 used in 90s metronome", () => {
    const g = new Game({ seed: 7, metronome: true, fillRatio: 0.8 });
    const start = g.tanks.find((t) => t.fuel === "92")!.liters;
    g.tick(90);
    const used = start - g.tanks.find((t) => t.fuel === "92")!.liters;
    assert.ok(used > 150 && used < 260, `used ${used}`);
  });

  it("serialize roundtrip", () => {
    const g = new Game({ seed: 3 });
    g.tick(30);
    const g2 = deserializeGame(serializeGame(g));
    assert.equal(Math.round(g2.money), Math.round(g.money));
    assert.equal(g2.served, g.served);
  });
});
