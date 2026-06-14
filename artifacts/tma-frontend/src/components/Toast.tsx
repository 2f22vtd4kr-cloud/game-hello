import { create } from "zustand";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { notify } from "@/lib/haptic";

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info" | "warning";
  duration?: number;
}

interface ToastStore {
  toasts: Toast[];
  add: (message: string, type?: Toast["type"], duration?: number) => void;
  remove: (id: string) => void;
}

export const useToast = create<ToastStore>()((set) => ({
  toasts: [],
  add: (message, type = "info", duration = 4000) => {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, message, type, duration }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, duration);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

const TYPE_CONFIG: Record<Toast["type"], { color: string; bg: string; icon: string; label: string }> = {
  success: { color: "#22c55e", bg: "linear-gradient(135deg,#071a0f,#0a1a0f)", icon: "✓", label: "ОК" },
  error:   { color: "#ef4444", bg: "linear-gradient(135deg,#1a0708,#150505)", icon: "✕", label: "ОШИБКА" },
  warning: { color: "#eab308", bg: "linear-gradient(135deg,#1a1507,#14120a)", icon: "⚠", label: "ВНИМАНИЕ" },
  info:    { color: "#a855f7", bg: "linear-gradient(135deg,#110d1a,#0f0d18)", icon: "ℹ", label: "ИНФО" },
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  const cfg = TYPE_CONFIG[toast.type];
  const dur = toast.duration ?? 4000;
  const [pct, setPct] = useState(100);

  useEffect(() => {
    if (toast.type === "error")        notify("error");
    else if (toast.type === "success") notify("success");
    else if (toast.type === "warning") notify("warning");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 100 - (elapsed / dur) * 100);
      setPct(remaining);
      if (remaining === 0) clearInterval(id);
    }, 50);
    return () => clearInterval(id);
  }, [dur]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.92, x: "-50%" }}
      animate={{ opacity: 1, y: 0, scale: 1, x: "-50%" }}
      exit={{ opacity: 0, y: -12, scale: 0.92, x: "-50%" }}
      transition={{ type: "spring", damping: 22, stiffness: 340 }}
      onClick={onRemove}
      style={{
        position: "relative",
        background: cfg.bg,
        border: `1px solid ${cfg.color}44`,
        borderLeft: `3px solid ${cfg.color}`,
        borderRadius: "14px",
        padding: "0.7rem 1rem",
        display: "flex", alignItems: "flex-start", gap: "0.6rem",
        boxShadow: `0 8px 32px ${cfg.color}18, 0 2px 8px #00000040`,
        backdropFilter: "blur(16px)",
        cursor: "pointer",
        overflow: "hidden",
        minWidth: "260px", maxWidth: "88vw",
        pointerEvents: "auto",
      }}
    >
      {/* Top accent glow */}
      <div style={{ position: "absolute", top: 0, left: "12%", right: "12%", height: "1px", background: `linear-gradient(90deg,transparent,${cfg.color}66,transparent)` }} />

      {/* Icon badge */}
      <div style={{
        width: "22px", height: "22px",
        borderRadius: "6px",
        background: `${cfg.color}22`,
        border: `1px solid ${cfg.color}44`,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, marginTop: "1px",
      }}>
        <span style={{ color: cfg.color, fontWeight: 800, fontSize: "0.75rem", lineHeight: 1 }}>
          {cfg.icon}
        </span>
      </div>

      {/* Message */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: cfg.color, fontSize: "0.46rem", fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.12em", marginBottom: "0.1rem", opacity: 0.7 }}>
          {cfg.label}
        </div>
        <span style={{ color: "#e2e8f0", fontSize: "0.82rem", lineHeight: 1.4, display: "block" }}>
          {toast.message}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "2px", background: `${cfg.color}22` }}>
        <div style={{
          height: "100%",
          width: `${pct}%`,
          background: cfg.color,
          transition: "width 0.05s linear",
          boxShadow: `0 0 4px ${cfg.color}88`,
        }} />
      </div>
    </motion.div>
  );
}

export function ToastContainer() {
  const { toasts, remove } = useToast();

  return (
    <div style={{
      position: "fixed",
      top: "50%",
      left: "50%",
      zIndex: 9999,
      display: "flex", flexDirection: "column",
      alignItems: "center",
      gap: "0.45rem",
      pointerEvents: "none",
      transform: "translate(-50%, -50%)",
    }}>
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onRemove={() => remove(t.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}
