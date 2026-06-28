import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { buyVpnStars, buyVpnCrypto, fetchVpnStatus } from "@/api/client";
import { useUserStore } from "@/stores/useUserStore";
import { useToast } from "@/components/Toast";
import { VPN_PLANS } from "@/types";
import type { VpnSession } from "@/types";

/* ── Cobalt starfield ──────────────────────────────────────────── */
const STAR_COUNT = 70;
const STARS = Array.from({ length: STAR_COUNT }, (_, i) => ({
  id: i,
  x: (i * 137.508 + 11) % 100,
  y: (i * 91.337 + 7) % 100,
  r: 0.4 + (i % 5) * 0.22,
  delay: (i % 8) * 0.45,
}));

function Starfield() {
  return (
    <svg
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", opacity: 0.45 }}
    >
      <defs>
        <style>{`@keyframes vpn-tw{0%,100%{opacity:.08}50%{opacity:.9}}`}</style>
      </defs>
      {STARS.map((s) => (
        <circle
          key={s.id}
          cx={`${s.x}%`}
          cy={`${s.y}%`}
          r={s.r}
          fill="white"
          style={{
            animation: `vpn-tw ${2.6 + s.delay}s ease-in-out infinite`,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
    </svg>
  );
}

/* ── Active session banner ─────────────────────────────────────── */
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
        background: "rgba(22,60,20,0.55)",
        border: "1px solid rgba(34,197,94,0.3)",
        borderRadius: 16,
        padding: "1rem",
        marginBottom: "1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.4rem",
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 0 24px rgba(34,197,94,0.1)",
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg,transparent,#22c55e,transparent)" }} />
      <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "rgba(34,197,94,0.5)", fontSize: "0.44rem", letterSpacing: "0.16em", marginBottom: "0.15rem" }}>
        VPN_АКТИВЕН · ЗАЩИЩЕНО
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <motion.span animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 2 }} style={{ fontSize: "1.1rem" }}>
          🛡️
        </motion.span>
        <span style={{ color: "#22c55e", fontWeight: 800, fontSize: "0.95rem" }}>{session.plan_name}</span>
        <span style={{ marginLeft: "auto", fontFamily: "'JetBrains Mono',monospace", fontSize: "1.1rem", fontWeight: 800, color: "#22c55e", textShadow: "0 0 10px rgba(34,197,94,0.4)" }}>
          {timer}
        </span>
      </div>
      <div style={{
        background: "rgba(0,0,0,0.3)",
        borderRadius: 10,
        padding: "0.5rem 0.65rem",
        fontFamily: "'JetBrains Mono',monospace",
        fontSize: "0.68rem",
        color: "rgba(255,255,255,0.7)",
        letterSpacing: "0.04em",
        wordBreak: "break-all",
        border: "1px solid rgba(255,255,255,0.1)",
      }}>
        {session.config_key}
      </div>
      <p style={{ margin: 0, color: "rgba(255,255,255,0.45)", fontSize: "0.68rem" }}>
        Используйте этот ключ в приложении WireGuard или Outline.
      </p>
      <button
        onClick={onClose}
        style={{
          alignSelf: "flex-end",
          marginTop: "0.15rem",
          background: "rgba(34,197,94,0.1)",
          border: "1px solid rgba(34,197,94,0.25)",
          borderRadius: 8,
          color: "#22c55e",
          padding: "0.3rem 0.8rem",
          fontSize: "0.72rem",
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        Закрыть
      </button>
    </motion.div>
  );
}

/* ── Props ─────────────────────────────────────────────────────── */
interface Props {
  onClose: () => void;
  isTroubleshooter?: boolean;
  onSessionChange?: (active: boolean) => void;
}

type PayMethod = "stars" | "cryptobot";

/* ── Main component ────────────────────────────────────────────── */
export function VpnModal({ onClose, isTroubleshooter = false, onSessionChange }: Props) {
  const { user } = useUserStore();
  const { add: toast } = useToast();
  const [payMethod, setPayMethod] = useState<PayMethod>("stars");
  const [loading, setLoading] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<VpnSession | null>(null);
  const [checked, setChecked] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => { onSessionChange?.(activeSession !== null); }, [activeSession]); // eslint-disable-line

  useEffect(() => {
    if (!user) return;
    fetchVpnStatus(user.id)
      .then((s) => { if (s.has_active && s.session) setActiveSession(s.session); })
      .catch(() => {})
      .finally(() => setChecked(true));
  }, [user]);

  const pollForSession = (uid: number, attempts = 0) => {
    fetchVpnStatus(uid)
      .then((s) => {
        if (s.has_active && s.session) {
          setActiveSession(s.session);
          toast("✅ VPN активирован!", "success");
        } else if (attempts < 10) {
          setTimeout(() => pollForSession(uid, attempts + 1), 1500);
        } else {
          toast("VPN активируется — обновите страницу через несколько секунд", "success");
        }
      })
      .catch(() => { if (attempts < 6) setTimeout(() => pollForSession(uid, attempts + 1), 2000); });
  };

  const handleBuy = async (planId: string) => {
    if (!user) return;
    setLoading(planId);
    try {
      if (payMethod === "stars") {
        const inv = await buyVpnStars(user.id, user.id, planId);
        if (!inv.checkout_url) { toast("Не удалось создать счёт — попробуйте ещё раз", "error"); return; }
        const tg = (window as unknown as { Telegram?: { WebApp?: { openInvoice?: (url: string, cb: (s: string) => void) => void } } }).Telegram?.WebApp;
        if (tg?.openInvoice) {
          toast(`⭐ Открываю оплату ${inv.stars_amount} Stars…`, "success");
          setLoading(null);
          tg.openInvoice(inv.checkout_url, (status: string) => {
            if (status === "paid") { toast("⭐ Оплата прошла! Активирую VPN…", "success"); setTimeout(() => pollForSession(user.id), 1200); }
            else if (status === "cancelled") toast("Оплата отменена", "error");
            else if (status === "failed") toast("Ошибка оплаты. Попробуйте ещё раз.", "error");
          });
          return;
        } else {
          window.open(inv.checkout_url, "_blank");
          toast(`⭐ Счёт открыт — оплатите ${inv.stars_amount} Stars в Telegram`, "success");
        }
      } else {
        const inv = await buyVpnCrypto(user.id, user.id, planId);
        if (inv.checkout_url) { window.open(inv.checkout_url, "_blank"); toast("💎 Оплата через CryptoBot открыта", "success"); }
      }
    } catch (e: unknown) {
      toast(String(e), "error");
    } finally {
      setLoading(null);
    }
  };

  const selectedPlan = VPN_PLANS.find((p) => p.id === selected);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 12000, background: "rgba(14,16,140,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center", backdropFilter: "blur(4px)" }}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.3 }}
        onDragEnd={(_e, info) => { if (info.offset.y > 80 || info.velocity.y > 400) onClose(); }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "linear-gradient(180deg,#1A1ECC,#1517BB)",
          borderRadius: "20px 20px 0 0",
          padding: "0 0 2rem",
          width: "100%",
          maxHeight: "88vh",
          overflowY: "auto",
          position: "relative",
          touchAction: "none",
          overflow: "hidden",
        }}
      >
        {/* Starfield */}
        <Starfield />

        {/* warm top-right glow */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 50% 55% at 90% 10%, rgba(232,98,42,0.12) 0%, transparent 65%)" }} />

        {/* top border shimmer */}
        <div style={{ position: "sticky", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.35),transparent)", zIndex: 10 }} />

        {/* drag handle */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 10, paddingBottom: 2 }}>
          <div style={{ width: 40, height: 4, borderRadius: 99, background: "rgba(255,255,255,0.18)" }} />
        </div>

        <div style={{ padding: "1.25rem 1rem 0", position: "relative", zIndex: 2 }}>

          {/* header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "0.85rem" }}>
            <div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "rgba(255,255,255,0.35)", fontSize: "0.44rem", letterSpacing: "0.16em", marginBottom: "0.2rem" }}>
                VPN · ЗАЩИТА СЕТИ
              </div>
              <h2 style={{ margin: 0, color: "#fff", fontSize: "1.2rem", fontWeight: 900, lineHeight: 1.2 }}>
                🔒 VPN-доступ
              </h2>
              {isTroubleshooter && (
                <p style={{ margin: "0.2rem 0 0", color: "#fbbf24", fontSize: "0.72rem", fontFamily: "'JetBrains Mono',monospace" }}>
                  ⚠ Обнаружены проблемы с соединением
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.14)",
                borderRadius: "50%",
                color: "rgba(255,255,255,0.5)",
                width: 32, height: 32,
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.85rem", fontWeight: 700,
              }}
            >✕</button>
          </div>

          {/* active session */}
          {checked && activeSession && (
            <ActiveSessionBanner session={activeSession} onClose={onClose} />
          )}

          {(!checked || !activeSession) && (
            <>
              {/* description */}
              <div style={{
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 16,
                padding: "0.75rem 1rem",
                color: "rgba(255,255,255,0.65)",
                fontSize: "0.8rem",
                lineHeight: 1.55,
                marginBottom: "0.9rem",
              }}>
                Активируйте защищённый VPN-канал для обхода блокировок. Соединение поднимается{" "}
                <span style={{ color: "#fff", fontWeight: 700 }}>автоматически</span> сразу после оплаты.
              </div>

              {/* payment toggle */}
              <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.85rem" }}>
                {(["stars", "cryptobot"] as PayMethod[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setPayMethod(m)}
                    style={{
                      flex: 1, padding: "0.5rem 0.5rem",
                      border: `1px solid ${payMethod === m ? "rgba(255,255,255,0.32)" : "rgba(255,255,255,0.1)"}`,
                      borderRadius: 12,
                      background: payMethod === m ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.05)",
                      color: payMethod === m ? "#ffffff" : "rgba(255,255,255,0.4)",
                      fontSize: "0.77rem", fontWeight: payMethod === m ? 700 : 400,
                      cursor: "pointer",
                      transition: "all 0.18s",
                    }}
                  >
                    {m === "stars" ? "⭐ Telegram Stars" : "💎 CryptoBot"}
                  </button>
                ))}
              </div>

              {/* plan cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                {VPN_PLANS.map((plan, idx) => {
                  const isPopular = idx === 1;
                  const isSel = selected === plan.id;
                  const isLoading = loading === plan.id;
                  return (
                    <motion.div
                      key={plan.id}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setSelected(plan.id)}
                      style={{
                        background: isSel
                          ? "rgba(232,98,42,0.14)"
                          : isPopular
                            ? "rgba(255,255,255,0.09)"
                            : "rgba(255,255,255,0.05)",
                        border: `1px solid ${isSel ? "#E8622A" : isPopular ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.1)"}`,
                        borderRadius: 18,
                        padding: "0.85rem 0.9rem",
                        display: "flex", alignItems: "center", gap: "0.75rem",
                        position: "relative", overflow: "hidden",
                        boxShadow: isSel ? "0 0 22px rgba(232,98,42,0.22)" : "none",
                        cursor: "pointer",
                        transition: "all 0.18s",
                      }}
                    >
                      {/* shimmer line for popular */}
                      {isPopular && (
                        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.4),transparent)" }} />
                      )}

                      {/* emoji */}
                      <div style={{ fontSize: "1.5rem", minWidth: "2rem", textAlign: "center" }}>{plan.emoji}</div>

                      {/* info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                          <span style={{ color: "#fff", fontWeight: 800, fontSize: "0.9rem" }}>{plan.name}</span>
                          {isPopular && (
                            <span style={{ fontSize: "0.58rem", fontWeight: 800, background: "#E8622A", color: "#fff", padding: "1px 6px", borderRadius: 99 }}>ХИТ</span>
                          )}
                        </div>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "rgba(255,255,255,0.32)", fontSize: "0.44rem", letterSpacing: "0.12em", marginTop: "0.1rem" }}>
                          {plan.durationMin} МИН · WIREGUARD
                        </div>
                        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.7rem", marginTop: "0.15rem", lineHeight: 1.4 }}>
                          {plan.subtitle}
                        </div>
                      </div>

                      {/* price / buy */}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleBuy(plan.id); }}
                        disabled={isLoading}
                        style={{
                          background: isSel ? "#E8622A" : "rgba(232,98,42,0.82)",
                          border: "none",
                          borderRadius: 12,
                          color: "#fff",
                          padding: "0.5rem 0.75rem",
                          fontSize: "0.8rem", fontWeight: 800,
                          cursor: isLoading ? "wait" : "pointer",
                          opacity: isLoading ? 0.6 : 1,
                          whiteSpace: "nowrap",
                          minWidth: 70,
                          boxShadow: isSel ? "0 0 16px rgba(232,98,42,0.45)" : "none",
                          transition: "all 0.18s",
                        }}
                      >
                        {isLoading ? "…" : payMethod === "stars" ? `⭐ ${plan.starsAmount}` : `${plan.priceRub} ₽`}
                      </button>
                    </motion.div>
                  );
                })}
              </div>

              {/* confirm CTA */}
              <AnimatePresence>
                {selected && (
                  <motion.button
                    key="cta"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    onClick={() => handleBuy(selected)}
                    disabled={!!loading}
                    style={{
                      width: "100%",
                      marginTop: "0.85rem",
                      padding: "1rem",
                      borderRadius: 18,
                      background: "#E8622A",
                      border: "none",
                      color: "#fff",
                      fontSize: "0.95rem",
                      fontWeight: 900,
                      cursor: loading ? "wait" : "pointer",
                      boxShadow: "0 0 28px rgba(232,98,42,0.38)",
                      opacity: loading ? 0.7 : 1,
                    }}
                  >
                    {loading
                      ? "Обработка…"
                      : `Активировать VPN — ${payMethod === "stars" ? `⭐ ${selectedPlan?.starsAmount}` : `${selectedPlan?.priceRub} ₽`}`}
                  </motion.button>
                )}
              </AnimatePresence>

              <p style={{ margin: "0.85rem 0 0", color: "rgba(255,255,255,0.25)", fontSize: "0.65rem", lineHeight: 1.5, textAlign: "center" }}>
                После оплаты выдаётся персональный WireGuard-ключ. Соединение отключается автоматически по истечении выбранного времени.
              </p>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
