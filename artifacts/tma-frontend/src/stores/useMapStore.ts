import { create } from "zustand";
import { persist } from "zustand/middleware";

interface MapViewport {
  lat: number;
  lng: number;
  zoom: number;
}

interface MapStore {
  viewport: MapViewport;
  selectedStationId: number | null;
  filterStatus: "all" | "green" | "yellow" | "red";
  filterRegion: string | null;
  filterFuel: string | null;
  setViewport: (vp: MapViewport) => void;
  selectStation: (id: number | null) => void;
  setFilter: (key: "filterStatus" | "filterRegion" | "filterFuel", value: string | null) => void;
}

export const useMapStore = create<MapStore>()(
  persist(
    (set) => ({
      viewport: { lat: 44.6, lng: 33.5, zoom: 7 },
      selectedStationId: null,
      filterStatus: "all",
      filterRegion: null,
      filterFuel: null,

      setViewport: (viewport) => set({ viewport }),
      selectStation: (id) => set({ selectedStationId: id }),
      setFilter: (key, value) => set({ [key]: value } as Pick<MapStore, typeof key>),
    }),
    { name: "tma-map" }
  )
);
