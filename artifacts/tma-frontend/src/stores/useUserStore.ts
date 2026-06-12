import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/types";
import { fetchUser } from "@/api/client";

interface UserStore {
  user: User | null;
  loading: boolean;
  error: string | null;
  init: (userId: number, username?: string) => Promise<void>;
  refresh: () => Promise<void>;
  addXp: (amount: number) => void;
}

export const useUserStore = create<UserStore>()(
  persist(
    (set, get) => ({
      user: null,
      loading: false,
      error: null,

      init: async (userId, username) => {
        set({ loading: true, error: null });
        try {
          const user = await fetchUser(userId, username);
          set({ user, loading: false });
        } catch (e: unknown) {
          set({ error: String(e), loading: false });
        }
      },

      refresh: async () => {
        const { user } = get();
        if (!user) return;
        try {
          const updated = await fetchUser(user.id);
          set({ user: updated });
        } catch {}
      },

      addXp: (amount) => {
        const { user } = get();
        if (!user) return;
        set({ user: { ...user, xp: user.xp + amount } });
      },
    }),
    { name: "tma-user" }
  )
);
