import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore as useMinigameStore } from "@/stores/useGameStore";
import { useGameStore } from "@/game/store";
import { select as hapticSelect, notify as hapticNotify } from "@/lib/haptic";

export function FlipCardGame() {
  const { flipsRemaining, lastFlipResult, setFlipResult } = useMinigameStore();
  const { state, tickGame } = useGameStore(); // To potentially add XP/coins
  const [isFlipping, setIsFlipping] = useState(false);

  const handleFlip = () => {
    if (flipsRemaining <= 0 || isFlipping) return;
    
    hapticSelect();
    setIsFlipping(true);
    
    // Simulate flip animation
    setTimeout(() => {
      const outcomes = ["win_100", "win_500", "win_xp_10", "lose", "lose"];
      const result = outcomes[Math.floor(Math.random() * outcomes.length)];
      
      setFlipResult(result, flipsRemaining - 1);
      setIsFlipping(false);
      
      if (result.startsWith("win")) {
        hapticNotify("success");
      }
    }, 800);
  };

  return (
    <div className="rounded-2xl p-5 bg-[rgba(20,20,32,0.88)] backdrop-blur-xl border border-white/5 shadow-xl relative overflow-hidden">
      <div 
        className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-10 bg-violet-500"
      />
      
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="font-bold text-base">Удача Магната</h3>
          <p className="text-xs text-white/50">Переверни карту и выиграй</p>
        </div>
        <div className="text-right">
          <div className="text-xs font-bold text-violet-400">{flipsRemaining} / 3</div>
          <div className="text-[10px] text-white/30 uppercase">Попыток</div>
        </div>
      </div>

      <div className="flex justify-center py-4">
        <motion.div
          animate={isFlipping ? { rotateY: 180 } : { rotateY: 0 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          onClick={handleFlip}
          className={`
            w-32 h-44 rounded-xl cursor-pointer relative preserve-3d
            ${flipsRemaining <= 0 ? 'opacity-50 grayscale' : ''}
          `}
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Card Back */}
          <div className="absolute inset-0 backface-hidden bg-gradient-to-br from-violet-600 to-indigo-900 border-2 border-white/20 rounded-xl flex items-center justify-center shadow-2xl shadow-violet-500/20">
             <div className="w-16 h-16 rounded-full border-2 border-white/10 flex items-center justify-center">
                <span className="text-3xl font-black text-white/80 italic">F</span>
             </div>
          </div>
          
          {/* Card Front */}
          <div 
            className="absolute inset-0 backface-hidden bg-[rgba(30,30,45,0.95)] border-2 border-violet-500/50 rounded-xl flex flex-col items-center justify-center"
            style={{ transform: 'rotateY(180deg)' }}
          >
             <span className="text-4xl mb-2">
               {lastFlipResult?.startsWith("win") ? "🎁" : "❌"}
             </span>
             <span className="text-xs font-bold text-center px-2">
               {lastFlipResult === "win_100" && "+100 💰"}
               {lastFlipResult === "win_500" && "+500 💰"}
               {lastFlipResult === "win_xp_10" && "+10 ⭐"}
               {lastFlipResult?.startsWith("lose") && "Пусто"}
               {!lastFlipResult && "???"}
             </span>
          </div>
        </motion.div>
      </div>

      <div className="mt-4">
        <button
          onClick={handleFlip}
          disabled={flipsRemaining <= 0 || isFlipping}
          className={`
            w-full py-3 rounded-xl text-sm font-bold transition-all
            ${flipsRemaining > 0 && !isFlipping 
              ? 'bg-gradient-to-r from-violet-600 to-indigo-600 shadow-lg shadow-violet-600/30' 
              : 'bg-white/5 text-white/20'}
          `}
        >
          {isFlipping ? "Тасуем..." : flipsRemaining > 0 ? "Испытать удачу" : "Ждите завтра"}
        </button>
      </div>
    </div>
  );
}
