import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  onDone: () => void;
}

const STEPS = [
  {
    emoji: "⛽",
    tab: "catalog",
    title: "Покупайте топливо",
    desc: "Главная функция приложения — покупка топливных талонов. Выберите АЗС, тип топлива и объём. Оплата через Telegram Stars ⭐ или криптовалюту.",
    cta: "Дальше →",
    color: "#E8622A",
    bg: "radial-gradient(ellipse at 50% 0%, rgba(232,98,42,0.18) 0%, transparent 70%)",
  },
  {
    emoji: "🗺️",
    tab: "map",
    title: "Карта АЗС",
    desc: "1000+ станций на интерактивной карте. Фильтры по городу: 🏙 Москва, 🌊 Крым, ⚓ Питер. Цвет маркера — уровень доступности: 🟢 есть, 🟡 мало, 🔴 нет.",
    cta: "Дальше →",
    color: "#06b6d4",
    bg: "radial-gradient(ellipse at 50% 0%, rgba(6,182,212,0.18) 0%, transparent 70%)",
  },
  {
    emoji: "📊",
    tab: "analytics",
    title: "Аналитика и цены",
    desc: "Региональные графики, прогноз дефицита по AI, рейтинг регионов и сравнение цен по сетям. Следите за кризисом ещё до его начала.",
    cta: "Дальше →",
    color: "#22c55e",
    bg: "radial-gradient(ellipse at 50% 0%, rgba(34,197,94,0.18) 0%, transparent 70%)",
  },
  {
    emoji: "🔐",
    tab: "vault",
    title: "Ваши ваучеры",
    desc: "Все купленные талоны хранятся в Сейфе с QR-кодами. Покажите QR на АЗС — и получите топливо без очереди.",
    cta: "Дальше →",
    color: "#f59e0b",
    bg: "radial-gradient(ellipse at 50% 0%, rgba(245,158,11,0.18) 0%, transparent 70%)",
  },
  {
    emoji: "⭐",
    tab: "reserve",
    title: "Зарабатывайте XP",
    desc: "Каждый день — бонусные карточки и тап-игра. Копите XP, повышайте уровень и открывайте привилегии. Легенда Тавриды ждёт!",
    cta: "Начать работу ⚡",
    color: "#E8622A",
    bg: "radial-gradient(ellipse at 50% 0%, rgba(232,98,42,0.18) 0%, transparent 70%)",
  },
];

const TAB_POS: Record<string, number> = {
  map: 0, analytics: 1, catalog: 2, vault: 3, reserve: 4,
};

export function OnboardingTour({ onDone }: Props) {
  const [step, setStep] = useState(0);
  const [exiting, setExiting] = useState(false);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      setExiting(true);
      setTimeout(onDone, 400);
    } else {
      setStep((s) => s + 1);
    }
  };

  const handleSkip = () => {
    setExiting(true);
    setTimeout(onDone, 300);
  };

  return (
    <AnimatePresence>
      {!exiting && (
        <motion.div
          key="onboarding"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.35 }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 98000,
            background: "rgba(5,5,7,0.96)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.5rem",
          }}
        >
          {/* Scanline */}
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            background: "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(232,98,42,0.012) 2px,rgba(232,98,42,0.012) 4px)",
          }} />

          {/* Skip */}
          <button
            onClick={handleSkip}
            style={{
              position: "absolute", top: "1.2rem", right: "1.2rem",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
              color: "#6b7280", fontSize: "0.68rem",
              padding: "0.3rem 0.65rem",
              cursor: "pointer", zIndex: 2,
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "0.05em",
            }}
          >
            ПРОПУСТИТЬ
          </button>

          {/* Step dots */}
          <div style={{
            position: "absolute", top: "1.5rem", left: "50%", transform: "translateX(-50%)",
            display: "flex", gap: "6px",
          }}>
            {STEPS.map((_, i) => (
              <motion.div
                key={i}
                animate={{
                  width: i === step ? "20px" : "6px",
                  background: i === step ? current.color : "#22222f",
                }}
                style={{ height: "6px", borderRadius: "3px" }}
                transition={{ duration: 0.3 }}
              />
            ))}
          </div>

          {/* Main card */}
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 40, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -40, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              style={{
                width: "100%",
                maxWidth: "340px",
                background: "#0d0d18",
                border: `1px solid ${current.color}44`,
                borderRadius: "24px",
                padding: "2rem 1.5rem",
                textAlign: "center",
                position: "relative",
                overflow: "hidden",
                boxShadow: `0 0 60px ${current.color}18, 0 24px 48px rgba(0,0,0,0.6)`,
              }}
            >
              {/* Top glow bar */}
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: "2px",
                background: `linear-gradient(90deg, transparent, ${current.color}, transparent)`,
              }} />

              {/* Radial bg */}
              <div style={{
                position: "absolute", inset: 0, pointerEvents: "none",
                background: current.bg,
              }} />

              {/* Emoji */}
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                style={{
                  fontSize: "4rem",
                  marginBottom: "1.25rem",
                  filter: `drop-shadow(0 0 20px ${current.color}88)`,
                  position: "relative",
                }}
              >
                {current.emoji}
              </motion.div>

              <h2 style={{
                margin: "0 0 0.75rem",
                fontSize: "1.25rem",
                fontWeight: 900,
                color: "#e2e8f0",
                lineHeight: 1.2,
              }}>
                {current.title}
              </h2>

              <p style={{
                margin: "0 0 2rem",
                color: "#9ca3af",
                fontSize: "0.85rem",
                lineHeight: 1.65,
              }}>
                {current.desc}
              </p>

              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={handleNext}
                style={{
                  width: "100%",
                  padding: "0.9rem",
                  background: `linear-gradient(135deg, ${current.color}, #E8622A)`,
                  color: "#fff",
                  border: "none",
                  borderRadius: "14px",
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: `0 0 24px ${current.color}44`,
                  position: "relative",
                }}
              >
                {current.cta}
              </motion.button>
            </motion.div>
          </AnimatePresence>

          {/* Bottom nav preview — highlights the relevant tab */}
          <div style={{
            position: "absolute",
            bottom: 0, left: 0, right: 0,
            background: "rgba(6,6,10,0.98)",
            borderTop: "1px solid rgba(232,98,42,0.12)",
            display: "flex",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}>
            {["map","analytics","catalog","vault","reserve"].map((tab, i) => {
              const labels: Record<string, string> = {
                map: "🗺️", analytics: "📊", catalog: "⛽", vault: "🔐", reserve: "⭐",
              };
              const isActive = TAB_POS[current.tab] === i;
              return (
                <div
                  key={tab}
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0.6rem 0.2rem",
                    position: "relative",
                    minHeight: "56px",
                  }}
                >
                  {isActive && (
                    <motion.div
                      layoutId="tour-nav-active"
                      style={{
                        position: "absolute",
                        top: 0, left: "15%", right: "15%",
                        height: "2px",
                        borderRadius: "0 0 2px 2px",
                        background: `linear-gradient(90deg, ${current.color}, #E8622A)`,
                        boxShadow: `0 0 10px ${current.color}88`,
                      }}
                    />
                  )}
                  <motion.span
                    animate={{ scale: isActive ? 1.3 : 1, opacity: isActive ? 1 : 0.3 }}
                    style={{ fontSize: "1.3rem", lineHeight: 1 }}
                  >
                    {labels[tab]}
                  </motion.span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
