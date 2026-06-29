import { useState } from "react";
import { motion } from "framer-motion";

interface Props {
  onAuth: (pass: string) => void;
  onCancel: () => void;
}

export function AdminPasswordGate({ onAuth, onCancel }: Props) {
  const [pass, setPass] = useState("");
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);

  const handleSubmit = async () => {
    if (!pass || checking) return;
    setChecking(true);
    setError(false);
    try {
      const res = await fetch("/api/admin/verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pass }),
      });
      if (res.ok) {
        onAuth(pass);
      } else {
        setError(true);
        setPass("");
      }
    } catch {
      setError(true);
    } finally {
      setChecking(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0, zIndex: 99999,
        background: "rgba(3,3,8,0.97)",
        backdropFilter: "blur(12px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "1.5rem",
      }}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        style={{
          width: "100%", maxWidth: "320px",
          background: "linear-gradient(180deg, #0d0d18, #080810)",
          border: "1px solid rgba(232,98,42,0.35)",
          borderRadius: "20px",
          padding: "1.75rem 1.5rem",
          boxShadow: "0 0 60px rgba(232,98,42,0.15)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🛡️</div>
          <h2 style={{ color: "#e2e8f0", fontWeight: 800, fontSize: "1.1rem", margin: "0 0 0.3rem" }}>
            Режим администратора
          </h2>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.78rem", margin: 0 }}>
            Введите пароль для доступа
          </p>
        </div>

        <input
          type="password"
          value={pass}
          onChange={(e) => { setPass(e.target.value); setError(false); }}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="••••••••"
          autoFocus
          style={{
            width: "100%", padding: "0.85rem 1rem",
            background: "rgba(255,255,255,0.05)",
            border: `1px solid ${error ? "#ef4444" : "rgba(255,255,255,0.12)"}`,
            borderRadius: "12px",
            color: "#e2e8f0", fontSize: "1rem",
            outline: "none", boxSizing: "border-box",
            marginBottom: error ? "0.25rem" : "0.75rem",
            textAlign: "center", letterSpacing: "0.15em",
          }}
        />

        {error && (
          <p style={{ color: "#ef4444", fontSize: "0.72rem", textAlign: "center", margin: "0 0 0.75rem" }}>
            Неверный пароль
          </p>
        )}

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: "0.75rem",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "12px", color: "rgba(255,255,255,0.5)",
              fontSize: "0.85rem", cursor: "pointer",
            }}
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={checking || !pass}
            style={{
              flex: 2, padding: "0.75rem",
              background: "#E8622A", border: "none",
              borderRadius: "12px", color: "#fff",
              fontSize: "0.9rem", fontWeight: 700,
              cursor: checking || !pass ? "not-allowed" : "pointer",
              opacity: checking || !pass ? 0.6 : 1,
            }}
          >
            {checking ? "…" : "Войти"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
