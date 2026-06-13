import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { buyVpnStars, buyVpnCrypto, fetchVpnStatus } from "@/api/client";
import { useUserStore } from "@/stores/useUserStore";
import { useToast } from "@/components/Toast";
import { VPN_PLANS } from "@/types";
import type { VpnSession } from "@/types";

type PayMethod = "stars" | "cryptobot";

function countdown(expiresAt: string): string {
  const diff = Math.max(0, new Date(expiresAt).getTime() - Date.now());
  const m = Math.floor(diff / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function ActiveSessionBanner({ session, onClose }: { session: VpnSession; onClose: () => void }) {
  const [timer, setTimer] = useState(() => countdown(session.expires_at));

  useEffect(() => {
    const id = setInterval(() => setTimer(countdown(session.expires_at)), 1000);
    return () => clearInterval(id);
  }, [session.expires_at]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: "linear-gradient(135deg,#0d2e1a,#0a1f12)",
        border: "1px solid #22c55e44",
        borderRadius: "14px",
        padding: "1rem",
        marginBottom: "1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.4rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span style={{ fontSize: "1.1rem" }}>🛡️</span>
        <span style={{ color: "#22c55e", fontWeight: 700, fontSize: "0.95rem" }}>
          VPN активен — {session.plan_name}
        </span>
      </div>
      <div style={{ color: "#6b7280", fontSize: "0.75rem" }}>
        Осталось: <span style={{ color: "#e2e8f0", fontWeight: 600 }}>{timer}</span>
      </div>
      <div style={{
        background: "#050507",
        borderRadius: "8px",
        padding: "0.4rem 0.6rem",
        fontFamily: "monospace",
        fontSize: "0.72rem",
        color: "#a855f7",
        letterSpacing: "0.05em",
        wordBreak: "break-all",
      }}>
        {session.config_key}
      </div>
      <p style={{ margin: 0, color: "#6b7280", fontSize: "0.7rem" }}>
        Используйте этот ключ в приложении WireGuard или Outline для подключения.
      </p>
      <button
        onClick={onClose}
        style={{
          alignSelf: "flex-end",
          marginTop: "0.25rem",
          background: "none",
          border: "1px solid #22222f",
          borderRadius: "8px",
          color: "#6b7280",
          padding: "0.3rem 0.8rem",
          fontSize: "0.72rem",
          cursor: "pointer",
        }}
      >
        Закрыть
      </button>
    </motion.div>
  );
}

interface Props {
  onClose: () => void;
  isTroubleshooter?: boolean;
}

export function VpnModal({ onClose, isTroubleshooter = false }: Props) {
  const { user } = useUserStore();
  const { add: toast } = useToast();
  const [payMethod, setPayMethod] = useState<PayMethod>("stars");
  const [loading, setLoading] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<VpnSession | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchVpnStatus(user.id)
      .then((s) => { if (s.has_active && s.session) setActiveSession(s.session); })
      .catch(() => {})
      .finally(() => setChecked(true));
  }, [user]);

  const handleBuy = async (planId: string) => {
    if (!user) return;
    setLoading(planId);
    try {
      if (payMethod === "stars") {
        const inv = await buyVpnStars(user.id, user.id, planId);
        const tg = (window as unknown as { Telegram?: { WebApp?: { openInvoice?: (url: string, cb?: (s: string) => void) => void } } }).Telegram?.WebApp;
        if (tg?.openInvoice && inv.stars_amount) {
          toast(`⭐ Открываю оплату ${inv.stars_amount} Stars…`, "success");
        } else {
          toast(`⭐ Требуется ${inv.stars_amount ?? "?"} Stars — откройте через Telegram`, "success");
        }
      } else {
        const inv = await buyVpnCrypto(user.id, user.id, planId);
        if (inv.checkout_url) {
          window.open(inv.checkout_url, "_blank");
          toast("💎 Оплата через CryptoBot открыта", "success");
        }
      }
      const updated = await fetchVpnStatus(user.id);
      if (updated.has_active && updated.session) setActiveSession(updated.session);
    } catch (e: unknown) {
      toast(String(e), "error");
    } finally {
      setLoading(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 12000,
        background: "rgba(5,5,7,0.92)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        padding: "0",
      }}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#0d0d14",
          border: "1px solid #22222f",
          borderRadius: "20px 20px 0 0",
          padding: "1.25rem 1rem 2rem",
          width: "100%",
          maxHeight: "88vh",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.8rem" }}>
          <div>
            <h2 style={{ margin: 0, color: "#e2e8f0", fontSize: "1.1rem", fontWeight: 700 }}>
              🔒 VPN-доступ
            </h2>
            {isTroubleshooter && (
              <p style={{ margin: "0.2rem 0 0", color: "#f59e0b", fontSize: "0.72rem" }}>
                ⚠️ Обнаружены проблемы с соединением — VPN может помочь
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "1px solid #22222f", borderRadius: "50%",
              color: "#6b7280", width: "30px", height: "30px", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem",
            }}
          >
            ✕
          </button>
        </div>

        {checked && activeSession && (
          <ActiveSessionBanner session={activeSession} onClose={onClose} />
        )}

        {(!checked || !activeSession) && (
          <>
            <p style={{ margin: "0 0 0.8rem", color: "#9ca3af", fontSize: "0.78rem", lineHeight: 1.5 }}>
              Активируйте защищённый VPN-канал для обхода блокировок. Соединение поднимается автоматически сразу после оплаты.
            </p>

            <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.9rem" }}>
              {(["stars", "cryptobot"] as PayMethod[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setPayMethod(m)}
                  style={{
                    flex: 1, padding: "0.45rem 0.5rem",
                    border: `1px solid ${payMethod === m ? (m === "stars" ? "#f59e0b" : "#3b82f6") : "#22222f"}`,
                    borderRadius: "10px",
                    background: payMethod === m ? `${m === "stars" ? "#f59e0b" : "#3b82f6"}18` : "#0b0b0f",
                    color: payMethod === m ? (m === "stars" ? "#f59e0b" : "#3b82f6") : "#6b7280",
                    fontSize: "0.75rem", fontWeight: payMethod === m ? 700 : 400,
                    cursor: "pointer",
                  }}
                >
                  {m === "stars" ? "⭐ Telegram Stars" : "💎 CryptoBot"}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {VPN_PLANS.map((plan) => (
                <motion.div
                  key={plan.id}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    background: "linear-gradient(135deg,#14141c,#0d0d14)",
                    border: "1px solid #22222f",
                    borderRadius: "14px",
                    padding: "0.85rem 0.9rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                  }}
                >
                  <div style={{ fontSize: "1.5rem", minWidth: "2rem", textAlign: "center" }}>
                    {plan.emoji}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "#e2e8f0", fontWeight: 700, fontSize: "0.9rem" }}>
                      {plan.name}
                      <span style={{ color: "#6b7280", fontWeight: 400, fontSize: "0.72rem", marginLeft: "0.4rem" }}>
                        {plan.durationMin} мин
                      </span>
                    </div>
                    <div style={{ color: "#6b7280", fontSize: "0.7rem", marginTop: "0.15rem", lineHeight: 1.4 }}>
                      {plan.subtitle}
                    </div>
                  </div>
                  <button
                    onClick={() => handleBuy(plan.id)}
                    disabled={loading === plan.id}
                    style={{
                      background: "linear-gradient(135deg,#a855f7,#db2777)",
                      border: "none",
                      borderRadius: "10px",
                      color: "#fff",
                      padding: "0.45rem 0.7rem",
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      cursor: loading === plan.id ? "wait" : "pointer",
                      opacity: loading === plan.id ? 0.6 : 1,
                      whiteSpace: "nowrap",
                      minWidth: "70px",
                    }}
                  >
                    {loading === plan.id
                      ? "…"
                      : payMethod === "stars"
                        ? `⭐ ${plan.starsAmount}`
                        : `${plan.priceRub} ₽`}
                  </button>
                </motion.div>
              ))}
            </div>

            <p style={{ margin: "0.8rem 0 0", color: "#4b5563", fontSize: "0.65rem", lineHeight: 1.5, textAlign: "center" }}>
              После оплаты вам будет выдан персональный WireGuard-ключ. Соединение отключается автоматически по истечении выбранного времени.
            </p>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
