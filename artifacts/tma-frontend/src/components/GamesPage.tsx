import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gamepad2, Gift, Zap } from "lucide-react";
import { GamesPage as EmpireGame } from "./games/EmpireGame";
import { FlipCardGame } from "./games/FlipCardGame";
import { TapGame } from "./games/TapGame";
import { XPTiers } from "./games/XPTiers";

type GameSubTab = "empire" | "minigames" | "xp";

export function GamesPage() {
  const [activeSubTab, setActiveSubTab] = useState<GameSubTab>("empire");

  return (
    <div className="flex flex-col h-full bg-[#08090f] text-white font-inter overflow-hidden">
      {/* Sub-tab Switcher */}
      <div className="px-5 pt-4 shrink-0 z-50">
        <div className="flex p-1 bg-[rgba(20,20,32,0.88)] backdrop-blur-xl border border-white/5 rounded-2xl">
          <button
            onClick={() => setActiveSubTab("empire")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === "empire" 
                ? "bg-violet-600/20 text-violet-400 border border-violet-500/30 shadow-lg shadow-violet-500/10" 
                : "text-white/40 border border-transparent"
            }`}
          >
            <Gamepad2 size={14} />
            Империя
          </button>
          <button
            onClick={() => setActiveSubTab("minigames")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === "minigames" 
                ? "bg-violet-600/20 text-violet-400 border border-violet-500/30 shadow-lg shadow-violet-500/10" 
                : "text-white/40 border border-transparent"
            }`}
          >
            <Gift size={14} />
            Мини-игры
          </button>
          <button
            onClick={() => setActiveSubTab("xp")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === "xp" 
                ? "bg-violet-600/20 text-violet-400 border border-violet-500/30 shadow-lg shadow-violet-500/10" 
                : "text-white/40 border border-transparent"
            }`}
          >
            <Zap size={14} />
            Опыт
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto no-scrollbar relative">
        <AnimatePresence mode="wait">
          {activeSubTab === "empire" && (
            <motion.div
              key="empire"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              <EmpireGame />
            </motion.div>
          )}

          {activeSubTab === "minigames" && (
            <motion.div
              key="minigames"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="px-5 py-6 space-y-6 pb-24"
            >
              <FlipCardGame />
              <TapGame />
            </motion.div>
          )}

          {activeSubTab === "xp" && (
            <motion.div
              key="xp"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="px-5 py-6 pb-24"
            >
              <XPTiers />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
