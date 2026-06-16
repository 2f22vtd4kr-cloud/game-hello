import { create } from "zustand";
import type { ResourceId } from "./resources";
import type { BuildingId } from "./buildings";
import { BUILDINGS } from "./buildings";
import { SAVE_KEY, LEVEL_THRESHOLDS, GRID_SIZE_BY_LEVEL, AUTOSAVE_INTERVAL_MS, OFFLINE_MULTIPLIER, OFFLINE_MAX_SEC, DAILY_REWARDS, CRISIS_SHOP } from "./constants";
import { tick } from "./engine";
import { loadEmpireFullState, syncEmpireFullState } from "@/api/client";

export interface PlacedBuilding {
  uid: string;
  id: BuildingId;
  col: number;
  row: number;
  level: number;
}

export interface GameNotification {
  id: number;
  text: string;
  type: "success" | "crisis" | "info";
}

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  type: "coin" | "smoke" | "spark" | "xp" | "oil_drop";
  color: string;
  size: number;
}

export interface GameState {
  version: number;
  lastSaved: number;
  lastRewardDate: string;
  loginDay: number;
  loginStreak: number;
  level: number;
  resources: Record<ResourceId, number>;
  buildings: PlacedBuilding[];
  activeCrisis: string | null;
  crisisTimeLeft: number;
  totalCoinsEarned: number;
  totalOilExtracted: number;
  notifications: GameNotification[];
  particles: Particle[];
  workerTempBonus: number;
  workerTempEndsAt: number;
  productionBoost2x: number;
  productionBoostEndsAt: number;
}

function initialState(): GameState {
  return {
    version: 1,
    lastSaved: Date.now(),
    lastRewardDate: "",
    loginDay: 1,
    loginStreak: 0,
    level: 1,
    resources: { crude_oil: 0, refined_fuel: 0, coins: 500, xp: 0, workers: 0, crisis_tokens: 0 },
    buildings: [],
    activeCrisis: null,
    crisisTimeLeft: 0,
    totalCoinsEarned: 0,
    totalOilExtracted: 0,
    notifications: [],
    particles: [],
    workerTempBonus: 0,
    workerTempEndsAt: 0,
    productionBoost2x: 0,
    productionBoostEndsAt: 0,
  };
}

function saveGame(state: GameState) {
  try {
    const toSave = { ...state, particles: [], notifications: [] };
    localStorage.setItem(SAVE_KEY, JSON.stringify(toSave));
  } catch {}
}

function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<GameState>;
    const base = initialState();
    return {
      ...base,
      ...saved,
      resources: { ...base.resources, ...(saved.resources ?? {}) },
      particles: [],
      notifications: [],
    };
  } catch { return null; }
}

function calcOfflineEarnings(state: GameState): Partial<Record<ResourceId, number>> {
  const now = Date.now();
  const elapsedMs = now - state.lastSaved;
  const elapsedSec = Math.min(elapsedMs / 1000, OFFLINE_MAX_SEC);
  if (elapsedSec < 30) return {};
  const gains: Partial<Record<ResourceId, number>> = {};
  let s = { ...state, particles: [], notifications: [] };
  const steps = Math.min(Math.floor(elapsedSec), 3600);
  for (let i = 0; i < steps; i++) {
    s = tick(s, 1 * OFFLINE_MULTIPLIER);
  }
  for (const k of Object.keys(state.resources) as ResourceId[]) {
    const delta = s.resources[k] - state.resources[k];
    if (delta > 0.5) gains[k] = Math.floor(delta);
  }
  return gains;
}

function getPlayerLevel(xp: number): number {
  let level = 1;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) { level = i + 1; break; }
  }
  return level;
}

export function getGridSize(level: number): number {
  return GRID_SIZE_BY_LEVEL[Math.min(level - 1, GRID_SIZE_BY_LEVEL.length - 1)];
}

interface GameStore {
  state: GameState;
  offlineGains: Partial<Record<ResourceId, number>>;
  lastSyncedUserId: number | null;
  initGame: () => void;
  syncWithBackend: (userId: number) => Promise<void>;
  pushToBackend: (userId: number) => Promise<void>;
  tickGame: (dt: number) => void;
  placeBuilding: (id: BuildingId, col: number, row: number) => string | null;
  upgradeBuilding: (uid: string) => void;
  demolishBuilding: (uid: string) => void;
  claimDailyReward: () => void;
  buyFromCrisisShop: (itemId: string) => void;
  dismissOfflineGains: () => void;
  addParticles: (particles: Particle[]) => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  state: initialState(),
  offlineGains: {},
  lastSyncedUserId: null,

  initGame: () => {
    const saved = loadGame();
    if (!saved) {
      set({ state: initialState(), offlineGains: {} });
      return;
    }
    const gains = calcOfflineEarnings(saved);
    const base = { ...saved };
    for (const [k, v] of Object.entries(gains) as [ResourceId, number][]) {
      base.resources = { ...base.resources, [k]: (base.resources[k] ?? 0) + v };
    }
    base.level = getPlayerLevel(base.resources.xp);
    base.lastSaved = Date.now();
    set({ state: base, offlineGains: gains });
  },

  syncWithBackend: async (userId: number) => {
    try {
      const resp = await loadEmpireFullState(userId);
      if (!resp.state) return; // nothing saved server-side yet
      const remote = resp.state as Partial<GameState>;
      const local = get().state;
      // Prefer whichever state is more recent
      const remoteTs = (remote.lastSaved as number) ?? 0;
      if (remoteTs > local.lastSaved + 5000) {
        // Remote is meaningfully newer — load it and compute offline gains
        const base = { ...initialState(), ...remote, particles: [], notifications: [] } as GameState;
        const gains = calcOfflineEarnings(base);
        for (const [k, v] of Object.entries(gains) as [ResourceId, number][]) {
          base.resources = { ...base.resources, [k]: (base.resources[k] ?? 0) + v };
        }
        base.level = getPlayerLevel(base.resources.xp);
        base.lastSaved = Date.now();
        saveGame(base);
        set({ state: base, offlineGains: gains, lastSyncedUserId: userId });
      } else {
        set({ lastSyncedUserId: userId });
      }
    } catch { /* backend unavailable — silent fallback to localStorage */ }
  },

  pushToBackend: async (userId: number) => {
    try {
      const { state } = get();
      await syncEmpireFullState(userId, state as unknown as Record<string, unknown>);
    } catch { /* silent — localStorage is the source of truth */ }
  },

  tickGame: (dt: number) => {
    const { state } = get();
    const next = tick(state, dt);
    next.level = getPlayerLevel(next.resources.xp);
    if (Date.now() - next.lastSaved > AUTOSAVE_INTERVAL_MS) {
      saveGame(next);
      next.lastSaved = Date.now();
    }
    set({ state: next });
  },

  placeBuilding: (id: BuildingId, col: number, row: number) => {
    const { state } = get();
    const def = BUILDINGS[id];
    if (!def) return "Здание не найдено";
    if (state.level < def.unlockLevel) return `Откройте на уровне ${def.unlockLevel}`;
    for (const [res, cost] of Object.entries(def.buildCost) as [ResourceId, number][]) {
      if ((state.resources[res] ?? 0) < cost) return `Не хватает ${cost} ${res}`;
    }
    if (def.unique && state.buildings.some(b => b.id === id)) return "Уже построено";
    const gridSize = getGridSize(state.level);
    for (let dc = 0; dc < def.tileSize; dc++) {
      for (let dr = 0; dr < def.tileSize; dr++) {
        const nc = col + dc; const nr = row + dr;
        if (nc >= gridSize || nr >= gridSize) return "Выходит за пределы";
        if (state.buildings.some(b => {
          const bd = BUILDINGS[b.id];
          return nc >= b.col && nc < b.col + bd.tileSize && nr >= b.row && nr < b.row + bd.tileSize;
        })) return "Клетка занята";
      }
    }
    const uid = `${id}-${Date.now()}`;
    const newResources = { ...state.resources };
    for (const [res, cost] of Object.entries(def.buildCost) as [ResourceId, number][]) {
      newResources[res] = (newResources[res] ?? 0) - cost;
    }
    const notification: GameNotification = { id: Date.now(), text: `🏗️ Построено: ${def.name}`, type: "success" };
    const placed: PlacedBuilding = { uid, id, col, row, level: 1 };
    set({
      state: {
        ...state,
        resources: { ...newResources, xp: (newResources.xp ?? 0) + def.buildXp },
        buildings: [...state.buildings, placed],
        notifications: [...state.notifications.slice(-4), notification],
      },
    });
    saveGame(get().state);
    return null;
  },

  upgradeBuilding: (uid: string) => {
    const { state } = get();
    const building = state.buildings.find(b => b.uid === uid);
    if (!building) return;
    const def = BUILDINGS[building.id];
    if (building.level >= def.maxLevel) return;
    const cost = Math.round(Object.entries(def.buildCost).reduce((acc, [res, base]) => {
      return { ...acc, [res]: Math.round((base as number) * Math.pow(def.upgradeCostMultiplier, building.level)) };
    }, {} as Partial<Record<ResourceId, number>>)[Object.keys(def.buildCost)[0]] as number);
    const coinCost = Math.round((def.buildCost.coins ?? 0) * Math.pow(def.upgradeCostMultiplier, building.level));
    if ((state.resources.coins ?? 0) < coinCost) return;
    const newResources = { ...state.resources, coins: (state.resources.coins ?? 0) - coinCost };
    const newBuildings = state.buildings.map(b => b.uid === uid ? { ...b, level: b.level + 1 } : b);
    const notification: GameNotification = { id: Date.now(), text: `⬆️ ${def.name} → Ур.${building.level + 1}`, type: "success" };
    set({
      state: {
        ...state,
        resources: newResources,
        buildings: newBuildings,
        notifications: [...state.notifications.slice(-4), notification],
      },
    });
    saveGame(get().state);
  },

  demolishBuilding: (uid: string) => {
    const { state } = get();
    const building = state.buildings.find(b => b.uid === uid);
    if (!building) return;
    const def = BUILDINGS[building.id];
    const refund = Math.floor((def.buildCost.coins ?? 0) * 0.3);
    const newBuildings = state.buildings.filter(b => b.uid !== uid);
    const newCoins = (state.resources.coins ?? 0) + refund;
    const notification: GameNotification = { id: Date.now(), text: `🗑️ Снесено: ${def.name} (+${refund}💰)`, type: "info" };
    set({
      state: {
        ...state,
        resources: { ...state.resources, coins: newCoins },
        buildings: newBuildings,
        notifications: [...state.notifications.slice(-4), notification],
      },
    });
    saveGame(get().state);
  },

  claimDailyReward: () => {
    const { state } = get();
    const today = new Date().toDateString();
    if (state.lastRewardDate === today) return;
    const dayIndex = (state.loginDay - 1) % 7;
    const reward = DAILY_REWARDS[dayIndex];
    const newResources = { ...state.resources };
    newResources.coins = (newResources.coins ?? 0) + reward.coins;
    newResources.xp = (newResources.xp ?? 0) + reward.xp;
    newResources.crisis_tokens = (newResources.crisis_tokens ?? 0) + (reward.crisis_tokens ?? 0);
    const nextDay = state.loginDay >= 7 ? 1 : state.loginDay + 1;
    const notification: GameNotification = {
      id: Date.now(),
      text: `🎁 ${reward.label}: +${reward.coins}💰 +${reward.xp}⭐`,
      type: "success",
    };
    const newState = {
      ...state,
      resources: newResources,
      lastRewardDate: today,
      loginDay: nextDay,
      loginStreak: state.loginStreak + 1,
      notifications: [...state.notifications.slice(-4), notification],
    };
    set({ state: newState });
    saveGame(newState);
  },

  buyFromCrisisShop: (itemId: string) => {
    const { state } = get();
    const item = CRISIS_SHOP.find((i: { id: string }) => i.id === itemId);
    if (!item) return;
    if ((state.resources.crisis_tokens ?? 0) < item.cost) return;
    const newResources = { ...state.resources, crisis_tokens: (state.resources.crisis_tokens ?? 0) - item.cost };
    if (item.reward_type === "cancel_crisis") {
      set({ state: { ...state, resources: newResources, activeCrisis: null, crisisTimeLeft: 0 } });
    } else if (item.reward_type === "workers_temp") {
      set({ state: { ...state, resources: newResources, workerTempBonus: item.reward_value, workerTempEndsAt: Date.now() + 300_000 } });
    } else if (item.reward_type === "boost_2x") {
      set({ state: { ...state, resources: newResources, productionBoost2x: 2, productionBoostEndsAt: Date.now() + item.reward_value * 1000 } });
    } else {
      const rt = item.reward_type as ResourceId;
      newResources[rt] = (newResources[rt] ?? 0) + item.reward_value;
      set({ state: { ...state, resources: newResources } });
    }
    saveGame(get().state);
  },

  dismissOfflineGains: () => set({ offlineGains: {} }),

  addParticles: (particles: Particle[]) => {
    const { state } = get();
    set({ state: { ...state, particles: [...state.particles.slice(-30), ...particles] } });
  },
}));
