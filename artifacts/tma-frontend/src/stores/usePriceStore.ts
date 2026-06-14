import { create } from "zustand";
import type { PricesMap, FuelPrice } from "@/types";
import { fetchPrices } from "@/api/client";

export interface PriceAlert {
  id: string;
  fuel: string;
  oldPrice: number;
  newPrice: number;
  pctChange: number;
  direction: "up" | "down";
}

interface PriceStore {
  prices: PricesMap;
  connected: boolean;
  lastUpdated: Date | null;
  priceAlerts: PriceAlert[];
  getPrice: (region: string, fuelType: string) => FuelPrice | null;
  initPrices: () => Promise<void>;
  connectWs: () => () => void;
  dismissAlert: (id: string) => void;
}

const FUELS = ["АИ-92", "АИ-95", "ДТ"];

function avgPrices(prices: PricesMap): Record<string, number> {
  const result: Record<string, number> = {};
  for (const fuel of FUELS) {
    const vals = Object.values(prices)
      .map((r) => ((r as Record<string, { effective?: number }>)[fuel]?.effective) ?? 0)
      .filter((v) => v > 0);
    if (vals.length) result[fuel] = vals.reduce((a, b) => a + b, 0) / vals.length;
  }
  return result;
}

function detectChanges(
  oldPrices: PricesMap,
  newPrices: PricesMap,
): PriceAlert[] {
  if (!Object.keys(oldPrices).length || !Object.keys(newPrices).length) return [];
  const oldAvg = avgPrices(oldPrices);
  const newAvg = avgPrices(newPrices);
  const alerts: PriceAlert[] = [];
  for (const fuel of FUELS) {
    const o = oldAvg[fuel];
    const n = newAvg[fuel];
    if (!o || !n) continue;
    const pct = ((n - o) / o) * 100;
    if (Math.abs(pct) >= 1) {
      alerts.push({
        id: `${fuel}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        fuel,
        oldPrice: Math.round(o * 10) / 10,
        newPrice: Math.round(n * 10) / 10,
        pctChange: Math.round(Math.abs(pct) * 10) / 10,
        direction: pct > 0 ? "up" : "down",
      });
    }
  }
  return alerts;
}

export const usePriceStore = create<PriceStore>((set, get) => ({
  prices: {},
  connected: false,
  lastUpdated: null,
  priceAlerts: [],

  getPrice: (region, fuelType) => {
    const r = get().prices[region];
    if (!r) return null;
    return (r[fuelType] as FuelPrice) ?? null;
  },

  dismissAlert: (id) => {
    set((s) => ({ priceAlerts: s.priceAlerts.filter((a) => a.id !== id) }));
  },

  initPrices: async () => {
    try {
      const data = await fetchPrices();
      // First load sets baseline — no alerts fired
      set({ prices: data, lastUpdated: new Date() });
    } catch {
      // silently ignore — prices stay at last known value
    }
  },

  connectWs: () => {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${proto}//${window.location.host}/ws/prices`;
    let ws: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let alive = true;

    const connect = () => {
      try {
        ws = new WebSocket(url);

        ws.onopen = () => {
          set({ connected: true });
        };

        ws.onmessage = (evt) => {
          try {
            const msg = JSON.parse(evt.data as string) as {
              type: string;
              data?: PricesMap;
            };
            if (msg.type === "prices" && msg.data) {
              const newData = msg.data;
              const oldData = get().prices;
              const alerts = detectChanges(oldData, newData);
              set((s) => ({
                prices: newData,
                lastUpdated: new Date(),
                priceAlerts: alerts.length
                  ? [...s.priceAlerts, ...alerts]
                  : s.priceAlerts,
              }));
            } else if (msg.type === "ping") {
              ws?.send("ping");
            }
          } catch {
            // ignore malformed frames
          }
        };

        ws.onclose = () => {
          set({ connected: false });
          if (alive) {
            retryTimer = setTimeout(connect, 5000);
          }
        };

        ws.onerror = () => {
          ws?.close();
        };
      } catch {
        if (alive) {
          retryTimer = setTimeout(connect, 5000);
        }
      }
    };

    connect();

    return () => {
      alive = false;
      if (retryTimer) clearTimeout(retryTimer);
      ws?.close();
    };
  },
}));
