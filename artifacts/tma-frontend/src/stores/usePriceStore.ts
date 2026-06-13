import { create } from "zustand";
import type { PricesMap, FuelPrice } from "@/types";
import { fetchPrices } from "@/api/client";

interface PriceStore {
  prices: PricesMap;
  connected: boolean;
  lastUpdated: Date | null;
  getPrice: (region: string, fuelType: string) => FuelPrice | null;
  initPrices: () => Promise<void>;
  connectWs: () => () => void;
}

export const usePriceStore = create<PriceStore>((set, get) => ({
  prices: {},
  connected: false,
  lastUpdated: null,

  getPrice: (region, fuelType) => {
    const r = get().prices[region];
    if (!r) return null;
    return (r[fuelType] as FuelPrice) ?? null;
  },

  initPrices: async () => {
    try {
      const data = await fetchPrices();
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
            const msg = JSON.parse(evt.data as string) as { type: string; data?: PricesMap };
            if (msg.type === "prices" && msg.data) {
              set({ prices: msg.data, lastUpdated: new Date() });
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
