import { create } from "zustand";
import type { GasStation } from "@/types";
import { fetchStations } from "@/api/client";

interface StationStore {
  stations: GasStation[];
  loading: boolean;
  error: string | null;
  lastFetched: number | null;
  fetch: () => Promise<void>;
  updateReport: (stationId: number, delta: number) => void;
}

const CACHE_MS = 5 * 60 * 1000; // 5 min client-side cache

export const useStationStore = create<StationStore>()((set, get) => ({
  stations: [],
  loading: false,
  error: null,
  lastFetched: null,

  fetch: async () => {
    const { lastFetched } = get();
    if (lastFetched && Date.now() - lastFetched < CACHE_MS) return;

    set({ loading: true, error: null });
    try {
      const stations = await fetchStations();
      set({ stations, loading: false, lastFetched: Date.now() });
    } catch (e: unknown) {
      set({ error: String(e), loading: false });
    }
  },

  updateReport: (stationId, delta) => {
    set((state) => ({
      stations: state.stations.map((s) =>
        s.id !== stationId
          ? s
          : {
              ...s,
              fuel_statuses: s.fuel_statuses.map((fs) => ({
                ...fs,
                availability_pct: Math.max(0, Math.min(100, fs.availability_pct + delta)),
              })),
            }
      ),
    }));
  },
}));
