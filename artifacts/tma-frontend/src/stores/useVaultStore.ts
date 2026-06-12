import { create } from "zustand";
import type { Purchase } from "@/types";
import { fetchVault } from "@/api/client";

interface VaultStore {
  purchases: Purchase[];
  loading: boolean;
  error: string | null;
  fetch: (userId: number) => Promise<void>;
  addPurchase: (purchase: Purchase) => void;
}

export const useVaultStore = create<VaultStore>()((set) => ({
  purchases: [],
  loading: false,
  error: null,

  fetch: async (userId) => {
    set({ loading: true, error: null });
    try {
      const purchases = await fetchVault(userId);
      set({ purchases, loading: false });
    } catch (e: unknown) {
      set({ error: String(e), loading: false });
    }
  },

  addPurchase: (purchase) =>
    set((state) => ({ purchases: [purchase, ...state.purchases] })),
}));
