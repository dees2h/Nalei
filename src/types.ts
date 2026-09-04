export type Fuel = "92" | "95" | "100" | "diesel";

export type DayPhase = "day" | "evening" | "night";

export type TankerSize = "small" | "medium" | "large";

export type ShopId = "coffee" | "hotdog" | "drinks" | "toilet" | "sign";

export type VehicleId =
  | "kometa"
  | "malysh"
  | "semya"
  | "steppe"
  | "lynx"
  | "aurum"
  | "baron"
  | "taiga"
  | "magistral";

export type AttendantStatus = "none" | "working" | "unpaid" | "quit";

export interface VehicleDef {
  id: VehicleId;
  name: string;
  tankLiters: number;
  fuel: Fuel;
  snackChance: number;
}

export interface Car {
  id: number;
  vehicle: VehicleId;
  fuel: Fuel;
  liters: number;
  wait: number;
  heldOnce: boolean;
  leaving: boolean;
}

export interface Pump {
  id: number;
  fuel: Fuel;
  idle: number;
  occupant: PumpOccupant | null;
}

export interface PumpOccupant {
  carId: number;
  vehicle: VehicleId;
  fuel: Fuel;
  liters: number;
  fillLeft: number;
  fillTotal: number;
  approachLeft: number;
}

export interface Tank {
  fuel: Fuel;
  capacity: number;
  liters: number;
}

export interface TankerOrder {
  fuel: Fuel;
  size: TankerSize;
  liters: number;
  paid: number;
  eta: number;
  rainStretched: boolean;
  adSkipUsed: boolean;
}

export interface FailedTanker {
  fuel: Fuel;
  size: TankerSize;
  liters: number;
  refund: number;
  refundIn: number;
}

export interface ShopState {
  coffee: boolean;
  hotdog: boolean;
  drinks: boolean;
  toilet: boolean;
  sign: boolean;
}

export interface GameEvent {
  at: number;
  kind: string;
  message: string;
}

export interface Snapshot {
  time: number;
  dayIndex: number;
  phase: DayPhase;
  raining: boolean;
  money: number;
  a: number;
  stars: number;
  served: number;
  left: number;
  queue: number;
  queueLimit: number;
  tanks: Tank[];
  pumps: { id: number; fuel: Fuel; busy: boolean; idle: number }[];
  tanker: TankerOrder | null;
  failed: FailedTanker | null;
  attendant: AttendantStatus;
  attendantCount: number;
  shop: ShopState;
  debtBarrel: number;
  lastToast: string | null;
}
