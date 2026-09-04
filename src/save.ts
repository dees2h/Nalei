import { Game, type GameOptions } from "./game.ts";
import type { AttendantStatus, Car, FailedTanker, Fuel, Pump, ShopState, Tank, TankerOrder } from "./types.ts";

export interface SavedGame {
  v: 1;
  seed: number;
  time: number;
  dayIndex: number;
  timeInDay: number;
  money: number;
  dayProfit: number;
  dayRevenue: number;
  prevDayProfit: number;
  served: number;
  stars: number;
  raining: boolean;
  rainLeft: number;
  rainRolled: boolean;
  rainDur: number;
  uncleUsed: boolean;
  empty92For: number;
  leftLog: number[];
  leftToday: number;
  leftLast3: number[];
  nightClean: boolean;
  tanks: Tank[];
  pumps: Pump[];
  queue: Car[];
  nextCarId: number;
  priorityId: number | null;
  nextArrival: number;
  tanker: TankerOrder | null;
  failed: FailedTanker | null;
  deliveredTankers: number;
  contract: boolean;
  secondSupplier: boolean;
  attendantCount: number;
  attendantPaid: boolean;
  attendantDebt: number;
  unpaidMornings: number;
  status: AttendantStatus;
  shop: ShopState;
  debtBarrel: number;
  boostLeft: number;
  boostCd: number;
  toast: string | null;
}

export function serializeGame(game: Game): SavedGame {
  return {
    v: 1,
    seed: game.seed,
    time: game.time,
    dayIndex: game.dayIndex,
    timeInDay: game.timeInDay,
    money: game.money,
    dayProfit: game.dayProfit,
    dayRevenue: game.dayRevenue,
    prevDayProfit: game.prevDayProfit,
    served: game.served,
    stars: game.stars,
    raining: game.raining,
    rainLeft: game.rainLeft,
    rainRolled: game.rainRolled,
    rainDur: game.rainDuration,
    uncleUsed: game.uncleUsed,
    empty92For: game.empty92For,
    leftLog: [...game.leftLog],
    leftToday: game.leftToday,
    leftLast3: [...game.leftLast3],
    nightClean: game.nightClean,
    tanks: game.tanks.map((t) => ({ ...t })),
    pumps: game.pumps.map((p) => ({ ...p, occupant: p.occupant ? { ...p.occupant } : null })),
    queue: game.queue.map((c) => ({ ...c })),
    nextCarId: game.nextCarId,
    priorityId: game.priorityId,
    nextArrival: game.nextArrival,
    tanker: game.tanker ? { ...game.tanker } : null,
    failed: game.failed ? { ...game.failed } : null,
    deliveredTankers: game.deliveredTankers,
    contract: game.contract,
    secondSupplier: game.secondSupplier,
    attendantCount: game.attendantCount,
    attendantPaid: game.attendantPaid,
    attendantDebt: game.attendantDebt,
    unpaidMornings: game.unpaidMornings,
    status: game.status,
    shop: { ...game.shop },
    debtBarrel: game.debtBarrel,
    boostLeft: game.boostLeft,
    boostCd: game.boostCd,
    toast: game.toast,
  };
}

export function deserializeGame(data: SavedGame, options: Omit<GameOptions, "seed"> = {}): Game {
  const game = new Game({ ...options, seed: data.seed });
  Object.assign(game, {
    time: data.time,
    dayIndex: data.dayIndex,
    timeInDay: data.timeInDay,
    money: data.money,
    dayProfit: data.dayProfit,
    dayRevenue: data.dayRevenue,
    prevDayProfit: data.prevDayProfit,
    served: data.served,
    stars: data.stars,
    raining: data.raining,
    rainLeft: data.rainLeft,
    rainRolled: data.rainRolled,
    rainDuration: data.rainDur,
    uncleUsed: data.uncleUsed,
    empty92For: data.empty92For,
    leftLog: [...data.leftLog],
    leftToday: data.leftToday,
    leftLast3: [...data.leftLast3],
    nightClean: data.nightClean,
    tanks: data.tanks.map((t) => ({ ...t })),
    pumps: data.pumps.map((p) => ({ ...p, occupant: p.occupant ? { ...p.occupant } : null })),
    queue: data.queue.map((c) => ({ ...c })),
    nextCarId: data.nextCarId,
    priorityId: data.priorityId,
    nextArrival: data.nextArrival,
    tanker: data.tanker ? { ...data.tanker } : null,
    failed: data.failed ? { ...data.failed } : null,
    deliveredTankers: data.deliveredTankers,
    contract: data.contract,
    secondSupplier: data.secondSupplier,
    attendantCount: data.attendantCount,
    attendantPaid: data.attendantPaid,
    attendantDebt: data.attendantDebt,
    unpaidMornings: data.unpaidMornings,
    status: data.status,
    shop: { ...data.shop },
    debtBarrel: data.debtBarrel,
    boostLeft: data.boostLeft,
    boostCd: data.boostCd,
    toast: data.toast,
  });
  return game;
}

export const SAVE_KEY = "nalei-save-v1";

export function saveToLocal(game: Game): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(SAVE_KEY, JSON.stringify(serializeGame(game)));
}

export function loadFromLocal(options: Omit<GameOptions, "seed"> = {}): Game | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    return deserializeGame(JSON.parse(raw) as SavedGame, options);
  } catch {
    return null;
  }
}
