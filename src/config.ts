import type { Fuel, ShopId, TankerSize, VehicleDef, VehicleId } from "./types.ts";

export const DAY_LENGTH = 360;
export const PHASES = {
  day: { duration: 210, k: 1 },
  evening: { duration: 60, k: 0.8 },
  night: { duration: 90, k: 0.45 },
} as const;

export const BASE_FLOW_PER_MIN = 4;
export const K_DAY_AVERAGE = 3.5 * 1 + 1 * 0.8 + 1.5 * 0.45;

export const START_MONEY = 8000;
export const START_92_LITERS = 350;
export const START_92_CAPACITY = 2000;
export const START_DIESEL_LITERS = 1800;
export const START_DIESEL_CAPACITY = 3000;
export const TANK_95_CAPACITY = 2000;
export const TANK_100_CAPACITY = 1500;

export const FILL_MIN = 0.6;
export const FILL_MAX = 1.0;
export const FILL_MEAN = 0.8;

export const PETROL_LPS = 6;
export const DIESEL_LPS = 18;
export const APPROACH_SEC = 4;

export const ATTENDANT_K = [1, 0.7, 0.56] as const;
export const ATTENDANT_HIRE = [0, 2500, 6000] as const;
export const ATTENDANT_WAGE = [0, 400, 650] as const;
export const WAGE_PROFIT_MIN = 0.05;
export const WAGE_PROFIT_MAX = 0.08;
export const START_DAY_PROFIT_REF = 7100;

export const LEAVE_AFTER = 25;
export const PUMP100_IDLE_ACCEPT_95 = 8;
export const PREMIUM_HINT_SEC = 10;

export const QUEUE_LIMITS = [4, 4, 4, 6, 8, 10, 10] as const;
export const SLOT_BASE = [5000, 7000, 10000, 14000] as const;
export const TYPE_SURCHARGE: Record<Fuel, number> = {
  "92": 0,
  diesel: 800,
  "95": 4000,
  "100": 8000,
};

export const FUEL_PRICE = {
  "92": { wholesale: 9, retail: 15 },
  "95": { wholesale: 11, retail: 23 },
  "100": { wholesale: 14, retail: 32 },
  diesel: { wholesale: 10, retail: 17 },
} as const;

export const TANKER = {
  small: { liters: 1000, fee: 400, wait: [25, 40] as const },
  medium: { liters: 2500, fee: 700, wait: [40, 70] as const },
  large: { liters: 6000, fee: 1200, wait: [70, 110] as const },
} as const;

export const FAIL_CHANCE = { base: 0.12, contract: 0.06, second: 0.03 } as const;
export const FAIL_REFUND = 0.8;
export const FAIL_REFUND_DELAY = 10;
export const CONTRACT_COST = 3500;
export const CONTRACT_AFTER_TANKERS = 15;
export const SECOND_SUPPLIER_COST = 8000;

export const TANK92_UPGRADE = [
  { capacity: 4000, cost: 4500 },
  { capacity: 8000, cost: 9000 },
] as const;

export const SHOP: Record<
  ShopId,
  { cost: number; a: number; costGoods?: number; price?: number; chance?: number }
> = {
  coffee: { cost: 3000, a: 0.08, costGoods: 8, price: 35, chance: 0.3 },
  hotdog: { cost: 6000, a: 0.12, costGoods: 15, price: 70, chance: 0.22 },
  drinks: { cost: 4500, a: 0.08, costGoods: 10, price: 45, chance: 0.28 },
  toilet: { cost: 8000, a: 0.12 },
  sign: { cost: 5000, a: 0.1 },
};

export const SIGN_A_NIGHT = 0.3;
export const SHOP_A_CAP = 0.5;
export const A_MIN = 0.35;
export const A_MAX = 3.2;
export const A_PER_EXTRA_PUMP = 0.12;
export const A_HAS_95 = 0.2;
export const A_HAS_100 = 0.25;
export const A_LEFT = 0.08;
export const A_LEFT_MAX = 0.4;
export const A_EMPTY = { "92": 0.35, "95": 0.2, "100": 0.15, diesel: 0.05 } as const;
export const LEFT_WINDOW = 120;
export const NIGHT_NO_SIGN = 0.67;

export const RAIN_CHANCE = 0.35;
export const RAIN_DURATION = [45, 90] as const;
export const K_RAIN = 0.75;
export const RAIN_TANKER = 1.25;
export const RAIN_SNACK = 1.4;

export const BOOST_DURATION = 120;
export const BOOST_COOLDOWN = 480;
export const DEBT_SHARE = 0.25;
export const UNCLE_LITERS = 200;
export const UNCLE_AFTER = 45;

export const VEHICLES: Record<VehicleId, VehicleDef> = {
  kometa: { id: "kometa", name: "Kometa 7", tankLiters: 40, fuel: "92", snackChance: 0.15 },
  malysh: { id: "malysh", name: "Malysh", tankLiters: 35, fuel: "92", snackChance: 0.25 },
  semya: { id: "semya", name: "Semya", tankLiters: 55, fuel: "92", snackChance: 0.25 },
  steppe: { id: "steppe", name: "Steppe X", tankLiters: 60, fuel: "95", snackChance: 0.4 },
  lynx: { id: "lynx", name: "Lynx 4", tankLiters: 52, fuel: "95", snackChance: 0.4 },
  aurum: { id: "aurum", name: "Aurum", tankLiters: 70, fuel: "100", snackChance: 0.45 },
  baron: { id: "baron", name: "Baron", tankLiters: 80, fuel: "100", snackChance: 0.55 },
  taiga: { id: "taiga", name: "Taiga", tankLiters: 70, fuel: "diesel", snackChance: 0.25 },
  magistral: { id: "magistral", name: "Magistral", tankLiters: 400, fuel: "diesel", snackChance: 0.1 },
};

export const START_MIX: { item: VehicleId; weight: number }[] = [
  { item: "kometa", weight: 50 },
  { item: "malysh", weight: 27 },
  { item: "semya", weight: 15 },
  { item: "taiga", weight: 6 },
  { item: "magistral", weight: 2 },
];

export const LATE_MIX: { item: VehicleId; weight: number }[] = [
  { item: "kometa", weight: 22 },
  { item: "malysh", weight: 14 },
  { item: "semya", weight: 9 },
  { item: "steppe", weight: 14 },
  { item: "lynx", weight: 11 },
  { item: "aurum", weight: 6 },
  { item: "baron", weight: 4 },
  { item: "taiga", weight: 5 },
  { item: "magistral", weight: 3 },
];

export const TOASTS = {
  tankerFail: [
    "Ушёл заправляться сам.",
    "Перепутал съезд.",
    "Встал. Говорит, дождь.",
  ],
  left: "Поеду на соседний километр.",
  hold: "Ладно, ещё минутку.",
  unpaid: "Жду расчёт.",
  quit: "Пошёл на соседнюю Каплю. Там сосиски.",
  uncle: "Дядя Вова заехал. Говорит, не привыкай.",
  debt: "Вернёте. Мы знаем, где вы стоите.",
  wrongPump: "Тут сотый, ему нужен 92.",
} as const;

export function pumpSpeed(fuel: Fuel): number {
  return fuel === "diesel" ? DIESEL_LPS : PETROL_LPS;
}

export function tankerAllowed(fuel: Fuel, size: TankerSize, tankCapacity: number): boolean {
  if (size === "large") return fuel !== "diesel" && tankCapacity >= 6000;
  return true;
}
