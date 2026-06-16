import { create } from "zustand";
import { persist } from "zustand/middleware";

interface FavoritesStore {
  favoriteRegions: string[];
  addFavorite: (region: string) => void;
  removeFavorite: (region: string) => void;
  isFavorite: (region: string) => boolean;

  favoriteStations: number[];
  toggleStationFavorite: (id: number) => void;
  isStationFavorite: (id: number) => boolean;
}

export const useFavoritesStore = create<FavoritesStore>()(
  persist(
    (set, get) => ({
      favoriteRegions: [],
      addFavorite: (region) => {
        const cur = get().favoriteRegions;
        if (!cur.includes(region)) set({ favoriteRegions: [...cur, region] });
      },
      removeFavorite: (region) =>
        set({ favoriteRegions: get().favoriteRegions.filter((r) => r !== region) }),
      isFavorite: (region) => get().favoriteRegions.includes(region),

      favoriteStations: [],
      toggleStationFavorite: (id) => {
        const cur = get().favoriteStations;
        set({ favoriteStations: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
      },
      isStationFavorite: (id) => get().favoriteStations.includes(id),
    }),
    { name: "tma-region-favorites" }
  )
);
