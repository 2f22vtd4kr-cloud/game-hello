import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  onDone: () => void;
}

const TAGLINES = [
  "МАТРИЦА СНАБЖЕНИЯ АКТИВИРОВАНА",
  "СКАНИРОВАНИЕ 236 СТАНЦИЙ...",
  "ДАННЫЕ ОБНОВЛЯЮТСЯ В РЕАЛЬНОМ ВРЕМЕНИ",
  "ДОБРО ПОЖАЛОВАТЬ В СЕТЬ",
];

export function IntroSplash({ onDone }: Props) {
  const [phase, setPhase] = useState<"gif" | "promo" | "exit">("gif");
  const [taglineIdx, setTaglineIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Cycle taglines
    intervalRef.current = setInterval(() => {
      setTaglineIdx((i) => (i + 1) % TAGLINES.length);
    }, 900);

    // Progress bar
    const startTime = Date.now();
    const duration = 3200;
    progressRef.current = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - startTime) / duration) * 100);
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(progressRef.current!);
        clearInterval(intervalRef.current!);
        setPhase("promo");
      }
    }, 30);

    return () => {
      clearInterval(intervalRef.current!);
      clearInterval(progressRef.current!);
    };
  }, []);

  const handleSkip = () => {
    setPhase("exit");
    setTimeout(onDone, 400);
  };

  return (
    <AnimatePresence>
      {phase !== "exit" && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.45, ease: "easeInOut" }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            background: "#050507",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {/* Scanline overlay */}
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1,
            background: "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(168,85,247,0.018) 2px,rgba(168,85,247,0.018) 4px)",
          }} />

          {/* Corner decorations */}
          {[
            { top: 16, left: 16, rotate: 0 },
            { top: 16, right: 16, rotate: 90 },
            { bottom: 16, right: 16, rotate: 180 },
            { bottom: 16, left: 16, rotate: 270 },
          ].map((pos, i) => (
            <div key={i} style={{
              position: "absolute",
              width: 32, height: 32,
              ...pos,
              zIndex: 2,
            }}>
              <svg viewBox="0 0 32 32" fill="none" style={{ width: "100%", height: "100%", transform: `rotate(${pos.rotate}deg)` }}>
                <path d="M2 30 L2 2 L30 2" stroke="#a855f7" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.6" />
              </svg>
            </div>
          ))}

          {/* Phase: GIF intro */}
          <AnimatePresence mode="wait">
            {phase === "gif" && (
              <motion.div
                key="gif-phase"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.1 }}
                transition={{ duration: 0.5 }}
                style={{ position: "relative", zIndex: 3, textAlign: "center", width: "100%", padding: "1rem" }}
              >
                {/* Logo/GIF area */}
                <div style={{ position: "relative", display: "inline-block", marginBottom: "1.5rem" }}>
                  <motion.div
                    animate={{ boxShadow: ["0 0 30px #a855f755", "0 0 60px #db277755", "0 0 30px #a855f755"] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    style={{
                      width: 160, height: 160,
                      borderRadius: "50%",
                      overflow: "hidden",
                      border: "2px solid #a855f755",
                      background: "#0d0d18",
                    }}
                  >
                    <img
                      src="/intro.gif"
                      alt="intro"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </motion.div>
                  {/* Orbital ring */}
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                    style={{
                      position: "absolute",
                      inset: -10,
                      borderRadius: "50%",
                      border: "1px solid transparent",
                      borderTopColor: "#a855f7",
                      borderRightColor: "#db2777",
                    }}
                  />
                </div>

                {/* Title */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <div style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "0.6rem",
                    color: "#a855f7",
                    letterSpacing: "0.25em",
                    marginBottom: "0.5rem",
                    opacity: 0.8,
                  }}>
                    СИСТЕМА · v2.0 · КРЫМ
                  </div>
                  <h1 style={{
                    fontSize: "1.5rem",
                    fontWeight: 900,
                    background: "linear-gradient(135deg, #a855f7, #db2777, #06b6d4)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                    margin: "0 0 0.25rem",
                    lineHeight: 1.1,
                  }}>
                    ТОПЛИВНЫЙ УЗЕЛ
                  </h1>
                  <p style={{ color: "#475569", fontSize: "0.75rem", margin: 0 }}>
                    Матрица Снабжения
                  </p>
                </motion.div>

                {/* Cycling tagline */}
                <div style={{ height: "1.6rem", marginTop: "1.5rem", overflow: "hidden" }}>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={taglineIdx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: "0.6rem",
                        color: "#6b7280",
                        letterSpacing: "0.1em",
                        textAlign: "center",
                      }}
                    >
                      {TAGLINES[taglineIdx]}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Progress bar */}
                <div style={{ marginTop: "2rem", padding: "0 2rem" }}>
                  <div style={{
                    height: "2px",
                    background: "rgba(255,255,255,0.06)",
                    borderRadius: "1px",
                    overflow: "hidden",
                  }}>
                    <motion.div
                      style={{
                        height: "100%",
                        background: "linear-gradient(90deg, #a855f7, #db2777)",
                        width: `${progress}%`,
                        boxShadow: "0 0 8px #a855f7",
                        transition: "width 0.03s linear",
                      }}
                    />
                  </div>
                  <div style={{
                    display: "flex", justifyContent: "space-between", marginTop: "0.4rem",
                    fontFamily: "'JetBrains Mono', monospace", fontSize: "0.5rem", color: "#374151",
                  }}>
                    <span>INIT</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                </div>
              </motion.div>
            )}

            {phase === "promo" && (
              <motion.div
                key="promo-phase"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                style={{ position: "relative", zIndex: 3, width: "100%", height: "100%", display: "flex", flexDirection: "column" }}
              >
                {/* Full-screen promo image */}
                <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
                  <img
                    src="/promo.jpeg"
                    alt="promo"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      opacity: 0.7,
                    }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  {/* Gradient overlay */}
                  <div style={{
                    position: "absolute", inset: 0,
                    background: "linear-gradient(to bottom, rgba(5,5,7,0.3) 0%, transparent 30%, rgba(5,5,7,0.85) 100%)",
                  }} />
                  {/* Bottom content */}
                  <div style={{
                    position: "absolute",
                    bottom: 0, left: 0, right: 0,
                    padding: "2rem 1.5rem",
                    textAlign: "center",
                  }}>
                    <motion.h2
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      style={{
                        fontSize: "1.4rem",
                        fontWeight: 900,
                        background: "linear-gradient(135deg, #a855f7, #db2777)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        backgroundClip: "text",
                        margin: "0 0 0.5rem",
                      }}
                    >
                      Готово к работе
                    </motion.h2>
                    <motion.p
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      style={{ color: "#9ca3af", fontSize: "0.8rem", marginBottom: "1.5rem" }}
                    >
                      236 станций · 23 региона · данные в реальном времени
                    </motion.p>
                    <motion.button
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.6, type: "spring", stiffness: 280, damping: 20 }}
                      onClick={handleSkip}
                      className="btn-neon"
                      style={{ width: "100%", maxWidth: "280px", padding: "0.9rem", fontSize: "0.95rem" }}
                    >
                      ⚡ Открыть Матрицу
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Skip button (gif phase) */}
          {phase === "gif" && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              onClick={handleSkip}
              style={{
                position: "absolute",
                top: "1rem", right: "1rem",
                zIndex: 10,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
                color: "#6b7280",
                fontSize: "0.7rem",
                padding: "0.35rem 0.75rem",
                cursor: "pointer",
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: "0.05em",
              }}
            >
              ПРОПУСТИТЬ ›
            </motion.button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
