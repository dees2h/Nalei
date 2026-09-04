/**
 * Чистая экономика «Налей» — только расчёты, без игрового цикла.
 * Источник чисел: src/config.ts и docs/GDD-REQUIREMENTS.md
 */
import {
  A_EMPTY,
  A_HAS_100,
  A_HAS_95,
  A_LEFT,
  A_LEFT_MAX,
  A_MAX,
  A_MIN,
  A_PER_EXTRA_PUMP,
  APPROACH_SEC,
  ATTENDANT_K,
  ATTENDANT_WAGE,
  FAIL_CHANCE,
  FILL_MAX,
  FILL_MIN,
  FUEL_PRICE,
  K_RAIN,
  NIGHT_NO_SIGN,
  PHASES,
  PUMP100_IDLE_ACCEPT_95,
  QUEUE_LIMITS,
  SHOP,
  SHOP_A_CAP,
  SIGN_A_NIGHT,
  SLOT_BASE,
  START_DAY_PROFIT_REF,
  START_DIESEL_LITERS,
  START_MONEY,
  START_92_LITERS,
  TANKER,
  TYPE_SURCHARGE,
  VEHICLES,
  WAGE_PROFIT_MAX,
  WAGE_PROFIT_MIN,
  pumpSpeed,
} from "../config.ts";
import type { Rng } from "../rng.ts";
import type { DayPhase, Fuel, Pump, ShopState, Tank, TankerSize, VehicleId } from "../types.ts";

export function clampA(value: number): number {
  return Math.min(A_MAX, Math.max(A_MIN, value));
}

export function dayPhase(timeInDay: number): DayPhase {
  if (timeInDay < PHASES.day.duration) return "day";
  if (timeInDay < PHASES.day.duration + PHASES.evening.duration) return "evening";
  return "night";
}

export function kDay(phase: DayPhase, sign: boolean): number {
  const k = PHASES[phase].k;
  if (phase === "night" && !sign) return k * NIGHT_NO_SIGN;
  return k;
}

/** Средний k суток за цикл (в минуто-эквивалентах), GDD §9.2 = 4.975 */
export function kDayCycleAverage(): number {
  return (
    (PHASES.day.duration / 60) * PHASES.day.k +
    (PHASES.evening.duration / 60) * PHASES.evening.k +
    (PHASES.night.duration / 60) * PHASES.night.k
  );
}

export function fillLiters(tankLiters: number, rng: Rng): number {
  return (FILL_MIN + rng() * (FILL_MAX - FILL_MIN)) * tankLiters;
}

export function fillLitersFixed(tankLiters: number, ratio: number): number {
  const r = Math.min(FILL_MAX, Math.max(FILL_MIN, ratio));
  return r * tankLiters;
}

export function fuelMargin(fuel: Fuel): number {
  return FUEL_PRICE[fuel].retail - FUEL_PRICE[fuel].wholesale;
}

export function fuelProfit(fuel: Fuel, liters: number): number {
  return liters * fuelMargin(fuel);
}

export function fuelRevenue(fuel: Fuel, liters: number): number {
  return liters * FUEL_PRICE[fuel].retail;
}

export function fuelWholesaleCost(fuel: Fuel, liters: number): number {
  return liters * FUEL_PRICE[fuel].wholesale;
}

export function attendantSpeedK(workingCount: number): number {
  return ATTENDANT_K[Math.min(2, Math.max(0, workingCount))];
}

/** Время занятости колонки, сек. Заправщик ускоряет только заливку, не заезд. */
export function occupancySeconds(liters: number, fuel: Fuel, attendantWorking: number): number {
  const k = attendantSpeedK(attendantWorking);
  return APPROACH_SEC + (liters / pumpSpeed(fuel)) * k;
}

export function queueLimit(pumpCount: number): number {
  return QUEUE_LIMITS[Math.min(QUEUE_LIMITS.length - 1, pumpCount)] ?? 10;
}

export function slotBase(pumpCount: number): number {
  const slot = pumpCount - 2;
  if (slot < 0) return 0;
  return SLOT_BASE[Math.min(SLOT_BASE.length - 1, slot)];
}

export function tankerCost(fuel: Fuel, size: TankerSize): { liters: number; fee: number; total: number } {
  const spec = TANKER[size];
  const wholesale = spec.liters * FUEL_PRICE[fuel].wholesale;
  return { liters: spec.liters, fee: spec.fee, total: wholesale + spec.fee };
}

export function tankerWaitSeconds(size: TankerSize, rng: Rng, raining: boolean): number {
  const [min, max] = TANKER[size].wait;
  const wait = min + rng() * (max - min);
  return raining ? wait * 1.25 : wait;
}

export function failChance(contract: boolean, secondSupplier: boolean): number {
  if (secondSupplier) return FAIL_CHANCE.second;
  if (contract) return FAIL_CHANCE.contract;
  return FAIL_CHANCE.base;
}

export function pumpQuote(
  pumpCount: number,
  fuel: Fuel,
  alreadyHasType: boolean,
): { base: number; surcharge: number; firstLoad: number; total: number } {
  const base = slotBase(pumpCount);
  const surcharge = TYPE_SURCHARGE[fuel];
  const firstLoad =
    !alreadyHasType && (fuel === "95" || fuel === "100") ? tankerCost(fuel, "small").total : 0;
  return { base, surcharge, firstLoad, total: base + surcharge + firstLoad };
}

export function shopABonus(shop: ShopState, phase: DayPhase): number {
  let shopA = 0;
  if (shop.coffee) shopA += SHOP.coffee.a;
  if (shop.hotdog) shopA += SHOP.hotdog.a;
  if (shop.drinks) shopA += SHOP.drinks.a;
  if (shop.toilet) shopA += SHOP.toilet.a;
  if (shop.sign && phase !== "night") shopA += SHOP.sign.a;
  return Math.min(SHOP_A_CAP, shopA);
}

export function attractiveness(input: {
  pumps: Pump[];
  tanks: Tank[];
  shop: ShopState;
  phase: DayPhase;
  leftInWindow: number;
}): number {
  const pumpCount = input.pumps.length;
  const has95 = input.pumps.some((p) => p.fuel === "95");
  const has100 = input.pumps.some((p) => p.fuel === "100");

  let a =
    1 +
    A_PER_EXTRA_PUMP * (pumpCount - 2) +
    (has95 ? A_HAS_95 : 0) +
    (has100 ? A_HAS_100 : 0) +
    shopABonus(input.shop, input.phase);

  if (input.shop.sign && input.phase === "night") a += SIGN_A_NIGHT;
  a -= Math.min(A_LEFT_MAX, A_LEFT * input.leftInWindow);

  for (const tank of input.tanks) {
    if (tank.liters > 0) continue;
    if (tank.fuel === "95" && !has95) continue;
    if (tank.fuel === "100" && !has100) continue;
    a -= A_EMPTY[tank.fuel];
  }
  return clampA(a);
}

export function flowPerSecond(a: number, phase: DayPhase, sign: boolean, raining: boolean): number {
  return (4 * a * kDay(phase, sign) * (raining ? K_RAIN : 1)) / 60;
}

export function pumpAccepts(pump: Pump, fuel: Fuel): boolean {
  if (pump.occupant) return false;
  if (pump.fuel === fuel) return true;
  return pump.fuel === "100" && fuel === "95" && pump.idle >= PUMP100_IDLE_ACCEPT_95;
}

export function startWageShare(): number {
  return ATTENDANT_WAGE[1] / START_DAY_PROFIT_REF;
}

export function wageInCorridor(share: number): boolean {
  return share >= WAGE_PROFIT_MIN && share <= WAGE_PROFIT_MAX;
}

export function dieselGiftProfit(): number {
  return START_DIESEL_LITERS * fuelMargin("diesel");
}

export function startStateCheck(): { money: number; liters92: number; litersDiesel: number } {
  return { money: START_MONEY, liters92: START_92_LITERS, litersDiesel: START_DIESEL_LITERS };
}

export function snackProfit(shop: ShopState, vehicle: VehicleId, raining: boolean, rng: Rng): number {
  const chanceMul = raining ? 1.4 : 1;
  const base = VEHICLES[vehicle].snackChance;
  let profit = 0;
  const items = [shop.coffee ? SHOP.coffee : null, shop.hotdog ? SHOP.hotdog : null, shop.drinks ? SHOP.drinks : null];
  for (const item of items) {
    if (!item?.price || !item.costGoods || item.chance == null) continue;
    if (rng() < item.chance * chanceMul * (base / 0.25)) {
      profit += item.price - item.costGoods;
    }
  }
  return profit;
}

export function applyDebtPayment(revenue: number, debt: number, share: number): { moneyGain: number; debtLeft: number } {
  if (debt <= 0) return { moneyGain: revenue, debtLeft: 0 };
  const cut = revenue * share;
  const pay = Math.min(debt, cut);
  return { moneyGain: revenue - pay, debtLeft: debt - pay };
}
