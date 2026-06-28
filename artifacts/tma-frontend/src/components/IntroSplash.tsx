import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  onDone: () => void;
}

const COLUMNS = [
  { text: "ПОХ*Й",         bg: null,        textColor: "#ffffff", tintColor: "#A855F7", tintOpacity: 0.18, delay: 0 },
  { text: "ИНФЛЯЦИЯ —",    bg: "#A855F7",   textColor: "#ffffff", tintColor: null,      tintOpacity: 0,    delay: 0.08 },
  { text: "БЕРИ ТАЛОНЫ",   bg: null,        textColor: "#ffffff", tintColor: "#22D3EE", tintOpacity: 0.14, delay: 0.16 },
  { text: "И ЗАМОРАЖИВАЙ", bg: "#22D3EE",   textColor: "#0A0A0F", tintColor: null,      tintOpacity: 0,    delay: 0.24 },
  { text: "ЦЕНЫ",          bg: null,        textColor: "#ffffff", tintColor: "#A855F7", tintOpacity: 0.22, delay: 0.32 },
];

const COL_RISE_CSS = `
@keyframes colRise {
  from { clip-path: inset(0 0 100% 0); opacity: 0; }
  to   { clip-path: inset(0 0 0%   0); opacity: 1; }
}
`;

export function IntroSplash({ onDone }: Props) {
  const [phase, setPhase] = useState<"in" | "exit">("in");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Auto-dismiss after columns finish animating (longest delay 0.32s + 0.7s anim = ~1.1s) + small pause
    timerRef.current = setTimeout(() => {
      setPhase("exit");
      setTimeout(onDone, 420);
    }, 2600);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSkip = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPhase("exit");
    setTimeout(onDone, 420);
  };

  return (
    <AnimatePresence>
      {phase !== "exit" && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.03 }}
          transition={{ duration: 0.42, ease: "easeInOut" }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            background: "#0A0A0F",
            overflow: "hidden",
            display: "flex",
            flexDirection: "row",
          }}
        >
          <style>{COL_RISE_CSS}</style>

          {/* Vertical type columns */}
          {COLUMNS.map((col, i) => (
            <div
              key={i}
              style={{
                position: "relative",
                flex: 1,
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                animation: `colRise 0.7s cubic-bezier(0.16,1,0.3,1) both`,
                animationDelay: `${col.delay}s`,
              }}
            >
              {/* Solid colour fill */}
              {col.bg && (
                <div style={{ position: "absolute", inset: 0, background: col.bg }} />
              )}

              {/* Subtle tint on dark columns */}
              {!col.bg && col.tintColor && (
                <div style={{
                  position: "absolute",
                  inset: 0,
                  background: col.tintColor,
                  opacity: col.tintOpacity,
                }} />
              )}

              {/* Vertical text — reads bottom → top */}
              <div style={{
                position: "relative",
                writingMode: "vertical-lr",
                transform: "rotate(180deg)",
                fontSize: "clamp(48px, 14vw, 68px)",
                fontWeight: 900,
                textTransform: "uppercase",
                color: col.textColor,
                letterSpacing: "-0.03em",
                lineHeight: 1,
                userSelect: "none",
                textShadow: col.bg === "#22D3EE"
                  ? "none"
                  : "0 0 40px rgba(232,98,42,0.3)",
              }}>
                {col.text}
              </div>

              {/* Column separator */}
              <div style={{
                position: "absolute",
                top: 0, bottom: 0, right: 0,
                width: 1,
                background: "rgba(255,255,255,0.06)",
              }} />
            </div>
          ))}

          {/* Bottom caption */}
          <div style={{
            position: "absolute",
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 28px)",
            left: 20,
            zIndex: 10,
            fontFamily: "monospace",
            fontSize: 10,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.22)",
          }}>
            Матрица Снабжения
          </div>

          {/* Skip button */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.0 }}
            onClick={handleSkip}
            style={{
              position: "absolute",
              top: "calc(env(safe-area-inset-top, 16px) + 12px)",
              right: "1rem",
              zIndex: 10,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 20,
              color: "rgba(255,255,255,0.6)",
              fontSize: "0.72rem",
              fontWeight: 500,
              padding: "0.3rem 0.85rem",
              cursor: "pointer",
              letterSpacing: "0.03em",
              backdropFilter: "blur(8px)",
            }}
          >
            Пропустить
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
