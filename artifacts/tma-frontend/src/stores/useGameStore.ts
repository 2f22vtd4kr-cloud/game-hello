import { create } from "zustand";
import { persist } from "zustand/middleware";

interface GameStore {
  tapHighScore: number;
  tapLastScore: number;
  lastFlipResult: string | null;
  flipsRemaining: number;
  setTapScore: (score: number) => void;
  setFlipResult: (result: string, remaining: number) => void;
  setFlipsRemaining: (n: number) => void;
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      tapHighScore: 0,
      tapLastScore: 0,
      lastFlipResult: null,
      flipsRemaining: 3,

      setTapScore: (score) => {
        const { tapHighScore } = get();
        set({
          tapLastScore: score,
          tapHighScore: Math.max(tapHighScore, score),
        });
      },

      setFlipResult: (result, remaining) =>
        set({ lastFlipResult: result, flipsRemaining: remaining }),

      setFlipsRemaining: (n) => set({ flipsRemaining: n }),
    }),
    { name: "tma-game" }
  )
);
