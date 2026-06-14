import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { impact, notify } from "@/lib/haptic";
import type { PriceAlert } from "@/stores/usePriceStore";

interface Props {
  alerts: PriceAlert[];
  onDismiss: (id: string) => void;
  onNavigate: () => void;
  topOffset?: number;
}

export function PriceAlertBanner({
  alerts,
  onDismiss,
  onNavigate,
  topOffset = 0,
}: Props) {
  const current = alerts[0] ?? null;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shownRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!current) return;
    if (shownRef.current.has(current.id)) return;
    shownRef.current.add(current.id);

    // Haptics
    impact(current.pctChange >= 3 ? "heavy" : "medium");
    notify(current.direction === "up" ? "warning" : "success");

    // Auto-dismiss
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onDismiss(current.id);
    }, 6000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDismiss = () => {
    if (!current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    onDismiss(current.id);
  };

  const handleBuy = () => {
    handleDismiss();
    onNavigate();
  };

  const isUp = current?.direction === "up";
  const alertColor = isUp ? "#f59e0b" : "#22c55e";
  const alertBg = isUp
    ? "rgba(245,158,11,0.07)"
    : "rgba(34,197,94,0.07)";

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          key={current.id}
          initial={{ y: -(80 + topOffset), opacity: 0 }}
          animate={{ y: topOffset, opacity: 1 }}
          exit={{ y: -(80 + topOffset), opacity: 0 }}
          transition={{ type: "spring", damping: 22, stiffness: 300 }}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 19000,
            padding: "0.4rem 0.75rem 0.45rem",
            background: "rgba(5,5,7,0.97)",
            backdropFilter: "blur(20px) saturate(150%)",
            WebkitBackdropFilter: "blur(20px) saturate(150%)",
            borderBottom: `1px solid ${alertColor}33`,
            boxShadow: `0 6px 30px ${alertColor}18, 0 2px 0 ${alertColor}20`,
          }}
        >
          {/* Top gradient line */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "1px",
              background: `linear-gradient(90deg, transparent, ${alertColor}, transparent)`,
            }}
          />

          {/* Content row */}
          <div
            style={{
              background: alertBg,
              border: `1px solid ${alertColor}22`,
              borderRadius: "10px",
              padding: "0.5rem 0.65rem",
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
            }}
          >
            {/* Icon */}
            <motion.span
              animate={{ scale: [1, 1.35, 1] }}
              transition={{ duration: 0.5, repeat: 2 }}
              style={{ fontSize: "1.15rem", flexShrink: 0, lineHeight: 1 }}
            >
              {isUp ? "📈" : "📉"}
            </motion.span>

            {/* Price info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  margin: "0 0 0.05rem",
                  color: alertColor,
                  fontWeight: 800,
                  fontSize: "0.76rem",
                  lineHeight: 1.2,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {current.fuel}&nbsp;{isUp ? "↑" : "↓"}&nbsp;+{current.pctChange}%
              </p>
              <p
                style={{
                  margin: 0,
                  color: "#6b7280",
                  fontSize: "0.62rem",
                  lineHeight: 1,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {current.oldPrice}₽ → {current.newPrice}₽
              </p>
            </div>

            {/* Buy now */}
            <motion.button
              whileTap={{ scale: 0.93 }}
              onClick={handleBuy}
              style={{
                background: "linear-gradient(135deg,#a855f7,#db2777)",
                border: "none",
                borderRadius: "8px",
                color: "#fff",
                fontSize: "0.6rem",
                fontWeight: 700,
                padding: "0.3rem 0.55rem",
                cursor: "pointer",
                flexShrink: 0,
                boxShadow: "0 0 10px #a855f750",
                whiteSpace: "nowrap",
              }}
            >
              Купить ⛽️
            </motion.button>

            {/* Dismiss */}
            <button
              onClick={handleDismiss}
              style={{
                background: "none",
                border: "none",
                color: "#374151",
                fontSize: "1.1rem",
                cursor: "pointer",
                flexShrink: 0,
                lineHeight: 1,
                padding: "0",
              }}
            >
              ×
            </button>
          </div>

          {/* Countdown progress bar */}
          <motion.div
            initial={{ scaleX: 1 }}
            animate={{ scaleX: 0 }}
            transition={{ duration: 6, ease: "linear" }}
            style={{
              height: "2px",
              background: alertColor,
              borderRadius: "1px",
              marginTop: "3px",
              transformOrigin: "left",
              opacity: 0.5,
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
