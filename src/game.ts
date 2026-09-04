import {
  ATTENDANT_HIRE,
  ATTENDANT_WAGE,
  BOOST_COOLDOWN,
  BOOST_DURATION,
  CONTRACT_AFTER_TANKERS,
  CONTRACT_COST,
  DAY_LENGTH,
  DEBT_SHARE,
  FAIL_REFUND,
  FAIL_REFUND_DELAY,
  LATE_MIX,
  LEAVE_AFTER,
  RAIN_CHANCE,
  RAIN_DURATION,
  SECOND_SUPPLIER_COST,
  SHOP,
  START_92_CAPACITY,
  START_92_LITERS,
  START_DIESEL_CAPACITY,
  START_DIESEL_LITERS,
  START_MIX,
  START_MONEY,
  TANK92_UPGRADE,
  TANK_100_CAPACITY,
  TANK_95_CAPACITY,
  TANKER,
  TOASTS,
  UNCLE_AFTER,
  UNCLE_LITERS,
  VEHICLES,
  tankerAllowed,
} from "./config.ts";
import {
  applyDebtPayment,
  attractiveness,
  attendantSpeedK,
  dayPhase,
  failChance,
  fillLiters,
  flowPerSecond,
  fuelProfit,
  fuelRevenue,
  occupancySeconds,
  pumpAccepts,
  pumpQuote,
  queueLimit,
  snackProfit,
  tankerCost,
  tankerWaitSeconds,
} from "./economy/index.ts";
import { expInterval, mulberry32, pickWeighted, type Rng } from "./rng.ts";
import type {
  AttendantStatus,
  Car,
  Fuel,
  GameEvent,
  Pump,
  ShopId,
  ShopState,
  Snapshot,
  Tank,
  TankerOrder,
  TankerSize,
  FailedTanker,
} from "./types.ts";

export interface GameOptions {
  seed?: number;
  metronome?: boolean;
  fillRatio?: number;
}

export class Game {
  time = 0;
  dayIndex = 0;
  timeInDay = 0;
  money = START_MONEY;
  dayProfit = 0;
  dayRevenue = 0;
  prevDayProfit = START_MONEY > 0 ? 0 : 0;
  served = 0;
  stars = 1;
  raining = false;
  rainLeft = 0;
  rainRolled = false;
  uncleUsed = false;
  empty92For = 0;
  leftLog: number[] = [];
  leftToday = 0;
  leftLast3 = [0, 0, 0];
  nightNoEmpty92 = true;

  tanks: Tank[] = [
    { fuel: "92", capacity: START_92_CAPACITY, liters: START_92_LITERS },
    { fuel: "diesel", capacity: START_DIESEL_CAPACITY, liters: START_DIESEL_LITERS },
  ];
  pumps: Pump[] = [
    { id: 1, fuel: "92", idle: 0, occupant: null },
    { id: 2, fuel: "diesel", idle: 0, occupant: null },
  ];
  queue: Car[] = [];
  nextCarId = 1;
  priorityId: number | null = null;
  nextArrival = 0;

  tanker: TankerOrder | null = null;
  failed: FailedTanker | null = null;
  deliveredTankers = 0;
  contract = false;
  secondSupplier = false;

  attendantCount = 0;
  attendantPaid = false;
  attendantDebt = 0;
  unpaidMornings = 0;
  status: AttendantStatus = "none";

  shop: ShopState = {
    coffee: false,
    hotdog: false,
    drinks: false,
    toilet: false,
    sign: false,
  };

  debtBarrel = 0;
  boostLeft = 0;
  boostCd = 0;
  nightClean = true;
  toast: string | null = null;
  events: GameEvent[] = [];
  readonly seed: number;
  rainDuration = 0;

  private rng: Rng;
  private metronome: boolean;
  private fillRatio: number | null;

  constructor(options: GameOptions = {}) {
    this.seed = options.seed ?? 1;
    this.rng = mulberry32(this.seed);
    this.metronome = options.metronome ?? false;
    this.fillRatio = options.fillRatio ?? null;
    this.scheduleArrival();
  }

  get phase() {
    return dayPhase(this.timeInDay);
  }

  get a(): number {
    return attractiveness({
      pumps: this.pumps,
      tanks: this.tanks,
      shop: this.shop,
      phase: this.phase,
      leftInWindow: this.leftInWindow(),
    });
  }

  snapshot(): Snapshot {
    return {
      time: this.time,
      dayIndex: this.dayIndex,
      phase: this.phase,
      raining: this.raining,
      money: Math.round(this.money),
      a: Number(this.a.toFixed(3)),
      stars: this.stars,
      served: this.served,
      left: this.leftLog.length,
      queue: this.queue.length,
      queueLimit: queueLimit(this.pumps.length),
      tanks: this.tanks.map((t) => ({ ...t, liters: Math.round(t.liters) })),
      pumps: this.pumps.map((p) => ({
        id: p.id,
        fuel: p.fuel,
        busy: p.occupant !== null,
        idle: Number(p.idle.toFixed(1)),
      })),
      tanker: this.tanker,
      failed: this.failed,
      attendant: this.status,
      attendantCount: this.attendantCount,
      shop: { ...this.shop },
      debtBarrel: Math.round(this.debtBarrel),
      lastToast: this.toast,
    };
  }

  tick(dt: number): void {
    if (dt <= 0) return;
    const end = this.time + dt;
    while (this.time < end) {
      const step = Math.min(0.25, end - this.time);
      this.step(step);
    }
  }

  orderTanker(fuel: Fuel, size: TankerSize): boolean {
    if (this.tanker) return this.failAction("Бензовоз уже едет.");
    const tank = this.tankOf(fuel);
    if (!tank) return this.failAction("Нет бака под это топливо.");
    if (!tankerAllowed(fuel, size, tank.capacity)) return this.failAction("Такой партии нет.");
    const cost = tankerCost(fuel, size);
    if (this.money < cost.total) return this.failAction("Не хватает денег.");
    this.money -= cost.total;
    this.tanker = {
      fuel,
      size,
      liters: cost.liters,
      paid: cost.total,
      eta: tankerWaitSeconds(size, this.rng, this.raining),
      rainStretched: this.raining,
      adSkipUsed: false,
    };
    this.push("tanker-order", `Заказали ${fuel}, ${cost.liters} л за ${cost.total}.`);
    return true;
  }

  skipTankerWait(): boolean {
    if (!this.tanker || this.tanker.adSkipUsed) return false;
    this.tanker.eta = 0;
    this.tanker.adSkipUsed = true;
    this.push("ad-skip", "Реклама: бензовоз уже на съезде.");
    return true;
  }

  retryFailedTanker(): boolean {
    if (!this.failed) return false;
    this.failed = null;
    this.push("ad-retry", "Реклама: повтор без потери 20%.");
    return true;
  }

  takeDebtBarrel(): boolean {
    if (this.debtBarrel > 0) return false;
    const t92 = this.tankOf("92");
    if (!t92 || t92.liters > 0) return false;
    if (this.money >= tankerCost("92", "small").total) return false;
    const load = tankerCost("92", "small");
    t92.liters = Math.min(t92.capacity, t92.liters + load.liters);
    this.debtBarrel = load.total;
    this.toast = TOASTS.debt;
    this.push("debt-barrel", TOASTS.debt);
    return true;
  }

  setPriority(carId: number): boolean {
    if (!this.queue.some((c) => c.id === carId)) return false;
    this.priorityId = carId;
    return true;
  }

  holdCar(carId: number): boolean {
    const car = this.queue.find((c) => c.id === carId);
    if (!car || car.heldOnce) return false;
    car.wait = 0;
    car.heldOnce = true;
    car.leaving = false;
    this.toast = TOASTS.hold;
    return true;
  }

  hireAttendant(): boolean {
    const next = this.attendantCount + 1;
    if (next > 2) return false;
    const cost = ATTENDANT_HIRE[next];
    if (this.money < cost) return this.failAction("Не хватает на найм.");
    this.money -= cost;
    this.attendantCount = next;
    this.attendantPaid = true;
    this.unpaidMornings = 0;
    this.attendantDebt = 0;
    this.status = "working";
    this.push("hire", `Заправщик ${next} вышел в жилете.`);
    return true;
  }

  payAttendantDebt(): boolean {
    if (this.attendantDebt <= 0) return false;
    if (this.money < this.attendantDebt) return false;
    this.money -= this.attendantDebt;
    this.attendantDebt = 0;
    this.attendantPaid = true;
    this.status = "working";
    return true;
  }

  buildPump(fuel: Fuel): boolean {
    if (this.pumps.length >= 6) return false;
    const already = this.pumps.some((p) => p.fuel === fuel);
    const quote = pumpQuote(this.pumps.length, fuel, already);
    if (this.money < quote.total) return this.failAction("Не хватает на колонку.");
    this.money -= quote.total;
    this.pumps.push({
      id: this.pumps.length + 1,
      fuel,
      idle: 0,
      occupant: null,
    });
    if (!already && (fuel === "95" || fuel === "100")) {
      const cap = fuel === "95" ? TANK_95_CAPACITY : TANK_100_CAPACITY;
      this.tanks.push({ fuel, capacity: cap, liters: 0 });
      this.tanker = {
        fuel,
        size: "small",
        liters: TANKER.small.liters,
        paid: quote.firstLoad,
        eta: tankerWaitSeconds("small", this.rng, this.raining),
        rainStretched: this.raining,
        adSkipUsed: false,
      };
    }
    this.push("build-pump", `Колонка ${fuel} за ${quote.total}.`);
    this.refreshStars();
    return true;
  }

  buyShop(id: ShopId): boolean {
    if (this.shop[id]) return false;
    const spec = SHOP[id];
    if (this.money < spec.cost) return false;
    this.money -= spec.cost;
    this.shop[id] = true;
    this.push("shop", `Купили ${id}.`);
    this.refreshStars();
    return true;
  }

  upgradeTank92(): boolean {
    const tank = this.tankOf("92");
    if (!tank) return false;
    const next = TANK92_UPGRADE.find((u) => u.capacity > tank.capacity);
    if (!next) return false;
    if (this.money < next.cost) return false;
    this.money -= next.cost;
    tank.capacity = next.capacity;
    this.push("tank-92", `Бак 92 теперь ${next.capacity} л.`);
    return true;
  }

  buyContract(): boolean {
    if (this.contract || this.deliveredTankers < CONTRACT_AFTER_TANKERS) return false;
    if (this.money < CONTRACT_COST) return false;
    this.money -= CONTRACT_COST;
    this.contract = true;
    this.refreshStars();
    return true;
  }

  buySecondSupplier(): boolean {
    if (!this.contract || this.secondSupplier) return false;
    if (this.money < SECOND_SUPPLIER_COST) return false;
    this.money -= SECOND_SUPPLIER_COST;
    this.secondSupplier = true;
    return true;
  }

  activateBoost(): boolean {
    if (this.boostCd > 0 || this.boostLeft > 0) return false;
    this.boostLeft = BOOST_DURATION;
    return true;
  }

  quotePump(fuel: Fuel) {
    return pumpQuote(
      this.pumps.length,
      fuel,
      this.pumps.some((p) => p.fuel === fuel),
    );
  }

  private step(dt: number): void {
    this.time += dt;
    this.timeInDay += dt;
    if (this.boostLeft > 0) {
      this.boostLeft = Math.max(0, this.boostLeft - dt);
      if (this.boostLeft === 0) this.boostCd = BOOST_COOLDOWN;
    }
    if (this.boostCd > 0) this.boostCd = Math.max(0, this.boostCd - dt);
    this.advanceRain(dt);
    this.advanceTanker(dt);
    this.advancePumps(dt);
    this.advanceQueue(dt);
    this.spawn(dt);
    this.assign();
    this.maybeUncle(dt);
    if (this.timeInDay >= DAY_LENGTH) this.dawn();
    this.refreshStars();
  }

  private advanceRain(dt: number): void {
    if (!this.rainRolled) {
      this.rainRolled = true;
      if (this.rng() < RAIN_CHANCE) {
        const dur = RAIN_DURATION[0] + this.rng() * (RAIN_DURATION[1] - RAIN_DURATION[0]);
        const start = this.rng() * (DAY_LENGTH - dur);
        this.rainLeft = -start;
        this.rainDuration = dur;
      }
    }
    if (this.rainDuration > 0) {
      this.rainLeft += dt;
      this.raining = this.rainLeft >= 0 && this.rainLeft <= this.rainDuration;
    }
  }

  private advanceTanker(dt: number): void {
    if (this.failed) {
      this.failed.refundIn -= dt;
      if (this.failed.refundIn <= 0) {
        this.money += this.failed.refund;
        this.push("tanker-refund", `Вернули ${Math.round(this.failed.refund)}.`);
        this.failed = null;
      }
    }
    if (!this.tanker) return;
    if (this.raining && !this.tanker.rainStretched) {
      this.tanker.eta *= 1.25;
      this.tanker.rainStretched = true;
    }
    this.tanker.eta -= dt;
    if (this.tanker.eta > 0) return;
    const order = this.tanker;
    this.tanker = null;
    if (this.rng() < failChance(this.contract, this.secondSupplier)) {
      const line = TOASTS.tankerFail[Math.floor(this.rng() * TOASTS.tankerFail.length)];
      this.toast = line;
      this.failed = {
        fuel: order.fuel,
        size: order.size,
        liters: order.liters,
        refund: order.paid * FAIL_REFUND,
        refundIn: FAIL_REFUND_DELAY,
      };
      this.push("tanker-fail", line);
      return;
    }
    const tank = this.tankOf(order.fuel);
    if (tank) tank.liters = Math.min(tank.capacity, tank.liters + order.liters);
    this.deliveredTankers += 1;
    this.push("tanker-ok", `Слили ${order.liters} л ${order.fuel}.`);
  }

  private advancePumps(dt: number): void {
    for (const pump of this.pumps) {
      const occ = pump.occupant;
      if (!occ) {
        pump.idle += dt;
        continue;
      }
      pump.idle = 0;
      if (occ.approachLeft > 0) {
        occ.approachLeft = Math.max(0, occ.approachLeft - dt);
        continue;
      }
      occ.fillLeft -= dt;
      if (occ.fillLeft > 0) continue;
      this.finishFill(pump);
    }
  }

  private finishFill(pump: Pump): void {
    const occ = pump.occupant;
    if (!occ) return;
    pump.occupant = null;
    pump.idle = 0;
    const tank = this.tankOf(occ.fuel);
    if (tank) tank.liters = Math.max(0, tank.liters - occ.liters);
    let profit = fuelProfit(occ.fuel, occ.liters);
    let revenue = fuelRevenue(occ.fuel, occ.liters);
    const snack = snackProfit(this.shop, occ.vehicle, this.raining, this.rng);
    profit += snack;
    if (this.boostLeft > 0) {
      profit *= 2;
      revenue *= 2;
    }
    const debtPay = applyDebtPayment(revenue, this.debtBarrel, DEBT_SHARE);
    this.debtBarrel = debtPay.debtLeft;
    this.money += debtPay.moneyGain;
    this.dayRevenue += revenue;
    this.dayProfit += profit;
    this.served += 1;
    this.push("sold", `${VEHICLES[occ.vehicle].name}: ${occ.liters.toFixed(0)} л ${occ.fuel}.`);
  }

  private advanceQueue(dt: number): void {
    const keep: Car[] = [];
    for (const car of this.queue) {
      car.wait += dt;
      if (car.wait >= LEAVE_AFTER) {
        this.leftLog.push(this.time);
        this.leftToday += 1;
        this.toast = TOASTS.left;
        this.push("left", TOASTS.left);
        if (this.priorityId === car.id) this.priorityId = null;
        continue;
      }
      keep.push(car);
    }
    this.queue = keep;
  }

  private spawn(dt: number): void {
    this.nextArrival -= dt;
    while (this.nextArrival <= 0) {
      this.trySpawn();
      this.scheduleArrival();
      if (!Number.isFinite(this.nextArrival)) break;
    }
  }

  private trySpawn(): void {
    if (this.queue.length >= queueLimit(this.pumps.length)) return;
    const mix = this.pumps.some((p) => p.fuel === "95" || p.fuel === "100") ? LATE_MIX : START_MIX;
    let vehicle = pickWeighted(this.rng, mix);
    if (vehicle === "baron" && !this.pumps.some((p) => p.fuel === "100")) {
      vehicle = this.pumps.some((p) => p.fuel === "95") ? "aurum" : "semya";
    }
    if ((vehicle === "steppe" || vehicle === "lynx") && !this.pumps.some((p) => p.fuel === "95" || p.fuel === "100")) {
      vehicle = "semya";
    }
    const def = VEHICLES[vehicle];
    let fuel = def.fuel;
    if (vehicle === "semya" && this.pumps.some((p) => p.fuel === "95") && this.rng() < 0.65) fuel = "95";
    if (vehicle === "aurum" && !this.pumps.some((p) => p.fuel === "100")) fuel = "95";
    const liters = this.fillRatio == null ? fillLiters(def.tankLiters, this.rng) : def.tankLiters * this.fillRatio;
    this.queue.push({
      id: this.nextCarId++,
      vehicle,
      fuel,
      liters,
      wait: 0,
      heldOnce: false,
      leaving: false,
    });
  }

  private assign(): void {
    const ordered = [...this.queue].sort((a, b) => {
      if (a.id === this.priorityId) return -1;
      if (b.id === this.priorityId) return 1;
      return 0;
    });
    for (const car of ordered) {
      const tank = this.tankOf(car.fuel);
      if (!tank || tank.liters < car.liters) continue;
      const pump = this.bestPump(car.fuel);
      if (!pump) continue;
      const working = this.status === "working" ? this.attendantCount : 0;
      const fill = occupancySeconds(car.liters, pump.fuel === "diesel" ? "diesel" : car.fuel, working) - 4;
      pump.occupant = {
        carId: car.id,
        vehicle: car.vehicle,
        fuel: car.fuel,
        liters: car.liters,
        fillLeft: Math.max(0.1, fill),
        fillTotal: Math.max(0.1, fill),
        approachLeft: 4,
      };
      this.queue = this.queue.filter((c) => c.id !== car.id);
      if (this.priorityId === car.id) this.priorityId = null;
    }
  }

  private bestPump(fuel: Fuel): Pump | null {
    const exact = this.pumps.find((p) => !p.occupant && p.fuel === fuel);
    if (exact) return exact;
    return this.pumps.find((p) => pumpAccepts(p, fuel)) ?? null;
  }

  private maybeUncle(dt: number): void {
    const t92 = this.tankOf("92");
    if (!t92 || t92.liters > 0) {
      this.empty92For = 0;
      return;
    }
    if (this.phase === "night") this.nightClean = false;
    this.empty92For += dt;
    if (this.uncleUsed) return;
    if (this.money >= tankerCost("92", "small").total) return;
    if (this.empty92For < UNCLE_AFTER) return;
    t92.liters += UNCLE_LITERS;
    this.uncleUsed = true;
    this.toast = TOASTS.uncle;
    this.push("uncle", TOASTS.uncle);
  }

  private dawn(): void {
    this.leftLast3 = [this.leftToday, this.leftLast3[0], this.leftLast3[1]];
    this.prevDayProfit = this.dayProfit;
    this.dayProfit = 0;
    this.dayRevenue = 0;
    this.leftToday = 0;
    this.timeInDay -= DAY_LENGTH;
    this.dayIndex += 1;
    this.rainRolled = false;
    this.raining = false;
    this.rainLeft = 0;
    this.rainDuration = 0;
    this.uncleUsed = false;
    this.empty92For = 0;
    if (this.boostLeft === 0 && this.boostCd === 0) this.boostCd = 0;
    if (this.boostLeft <= 0 && this.boostCd < BOOST_COOLDOWN && this.boostLeft === 0) {
      /* keep existing cd */
    }
    this.payDawn();
    this.refreshStars();
  }

  private payDawn(): void {
    if (this.attendantCount <= 0) return;
    const wage = ATTENDANT_WAGE[this.attendantCount];
    if (this.money >= wage) {
      this.money -= wage;
      this.attendantPaid = true;
      this.attendantDebt = 0;
      this.unpaidMornings = 0;
      this.status = "working";
      this.push("wage", `Зарплата. Снова. −${wage}`);
      return;
    }
    this.attendantPaid = false;
    this.attendantDebt = wage;
    this.unpaidMornings += 1;
    this.status = "unpaid";
    this.toast = TOASTS.unpaid;
    if (this.unpaidMornings >= 2) {
      this.attendantCount = 0;
      this.attendantDebt = 0;
      this.status = "none";
      this.unpaidMornings = 0;
      this.toast = TOASTS.quit;
      this.push("quit", TOASTS.quit);
    }
  }

  private refreshStars(): void {
    const left3 = this.leftLast3.reduce((s, n) => s + n, 0);
    const has95 = this.pumps.some((p) => p.fuel === "95");
    const has100 = this.pumps.some((p) => p.fuel === "100");
    const two95 = this.pumps.filter((p) => p.fuel === "95").length >= 2;
    if (this.stars < 2 && this.served >= 80 && this.shop.sign) this.stars = 2;
    if (this.stars < 3 && has95 && left3 <= 5 && this.dayIndex >= 3) this.stars = 3;
    if (this.stars < 4 && (has100 || two95) && this.attendantCount >= 1 && this.contract) this.stars = 4;
    if (
      this.stars < 5 &&
      this.pumps.length >= 4 &&
      this.shop.sign &&
      this.served >= 500 &&
      this.nightClean
    ) {
      this.stars = 5;
    }
  }

  private scheduleArrival(): void {
    const lambda = flowPerSecond(this.a, this.phase, this.shop.sign, this.raining);
    this.nextArrival = this.metronome ? (lambda > 0 ? 1 / lambda : 999) : expInterval(this.rng, lambda);
  }

  private tankOf(fuel: Fuel): Tank | undefined {
    return this.tanks.find((t) => t.fuel === fuel);
  }

  private leftInWindow(): number {
    const from = this.time - 120;
    this.leftLog = this.leftLog.filter((t) => t >= from);
    return this.leftLog.length;
  }

  private failAction(message: string): boolean {
    this.toast = message;
    return false;
  }

  private push(kind: string, message: string): void {
    this.events.push({ at: this.time, kind, message });
    if (this.events.length > 80) this.events.shift();
  }
}
