import { create } from "zustand";
import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info" | "warning";
}

interface ToastStore {
  toasts: Toast[];
  add: (message: string, type?: Toast["type"]) => void;
  remove: (id: string) => void;
}

export const useToast = create<ToastStore>()((set) => ({
  toasts: [],
  add: (message, type = "info") => {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

const TYPE_COLORS: Record<Toast["type"], string> = {
  success: "#22c55e",
  error: "#ef4444",
  warning: "#eab308",
  info: "#a855f7",
};

const TYPE_ICONS: Record<Toast["type"], string> = {
  success: "✓",
  error: "✕",
  warning: "⚠",
  info: "ℹ",
};

export function ToastContainer() {
  const { toasts } = useToast();

  return (
    <div style={{
      position: "fixed", top: "env(safe-area-inset-top, 0.5rem)",
      left: "50%", transform: "translateX(-50%)",
      zIndex: 9999, display: "flex", flexDirection: "column",
      gap: "0.5rem", minWidth: "280px", maxWidth: "90vw",
      pointerEvents: "none",
    }}>
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.9 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            style={{
              background: "#14141c",
              border: `1px solid ${TYPE_COLORS[t.type]}44`,
              borderLeft: `3px solid ${TYPE_COLORS[t.type]}`,
              borderRadius: "12px",
              padding: "0.75rem 1rem",
              display: "flex", alignItems: "center", gap: "0.6rem",
              boxShadow: `0 4px 20px ${TYPE_COLORS[t.type]}22`,
              pointerEvents: "auto",
            }}
          >
            <span style={{
              color: TYPE_COLORS[t.type], fontWeight: 700,
              fontSize: "0.9rem", minWidth: "16px",
            }}>
              {TYPE_ICONS[t.type]}
            </span>
            <span style={{ color: "#e2e8f0", fontSize: "0.85rem", lineHeight: 1.4 }}>
              {t.message}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
