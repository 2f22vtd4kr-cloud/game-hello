import { motion } from "framer-motion";
import { impact } from "@/lib/haptic";
import type { TabId } from "@/types";

interface Props {
  active: TabId;
  onChange: (tab: TabId) => void;
  visible?: boolean;
  badges?: Partial<Record<TabId, number>>;
}

const TABS: { id: TabId; emoji: string; label: string }[] = [
  { id: "map",       emoji: "🗺️",  label: "Карта"   },
  { id: "analytics", emoji: "📊",  label: "Данные"  },
  { id: "catalog",   emoji: "🛒",  label: "Каталог" },
  { id: "vault",     emoji: "🔒",  label: "Сейф"    },
  { id: "reserve",   emoji: "🎰",  label: "Фортуна" },
];

export function BottomNav({ active, onChange, visible = true, badges = {} }: Props) {
  const handleTabClick = (tab: TabId) => {
    impact("light");
    onChange(tab);
  };

  return (
    <motion.nav
      animate={{ y: visible ? 0 : "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 300 }}
      style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "rgba(6,6,10,0.98)",
        backdropFilter: "blur(24px) saturate(160%)",
        WebkitBackdropFilter: "blur(24px) saturate(160%)",
        borderTop: "1px solid rgba(168,85,247,0.14)",
        boxShadow: "0 -4px 40px rgba(0,0,0,0.7), 0 -1px 0 rgba(168,85,247,0.06)",
        display: "flex", alignItems: "stretch",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        zIndex: 10000,
      }}
    >
      {/* Top accent line */}
      <div style={{
        position: "absolute",
        top: 0, left: "8%", right: "8%", height: "1px",
        background: "linear-gradient(90deg, transparent, rgba(168,85,247,0.4), rgba(219,39,119,0.4), transparent)",
        pointerEvents: "none",
      }} />

      {TABS.map((tab) => {
        const isActive = active === tab.id;
        const badge = badges[tab.id] ?? 0;
        return (
          <motion.button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            whileTap={{ scale: 0.85 }}
            style={{
              flex: 1,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              gap: "4px",
              padding: "0.5rem 0.1rem 0.6rem",
              background: "none", border: "none",
              cursor: "pointer", position: "relative",
              WebkitTapHighlightColor: "transparent",
              minHeight: "62px",
            }}
          >
            {/* Active top indicator */}
            {isActive && (
              <motion.div
                layoutId="nav-pill"
                style={{
                  position: "absolute",
                  top: 0, left: "14%", right: "14%",
                  height: "2px",
                  borderRadius: "0 0 3px 3px",
                  background: "linear-gradient(90deg, #a855f7, #db2777)",
                  boxShadow: "0 0 14px #a855f799, 0 0 24px #a855f744",
                }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
              />
            )}

            {/* Active background glow */}
            {isActive && (
              <div style={{
                position: "absolute",
                inset: "2px 4px",
                borderRadius: "12px",
                background: "radial-gradient(ellipse at 50% 0%, rgba(168,85,247,0.1) 0%, transparent 70%)",
                pointerEvents: "none",
              }} />
            )}

            {/* Badge */}
            {badge > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                style={{
                  position: "absolute",
                  top: "7px", right: "calc(50% - 20px)",
                  background: "linear-gradient(135deg,#ef4444,#dc2626)",
                  color: "#fff",
                  borderRadius: "99px",
                  minWidth: "16px", height: "16px",
                  fontSize: "0.45rem", fontWeight: 800,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  padding: "0 3px",
                  boxShadow: "0 0 8px rgba(239,68,68,0.65)",
                  border: "1.5px solid rgba(6,6,10,0.9)",
                  zIndex: 2,
                }}
              >
                {badge > 99 ? "99+" : badge}
              </motion.div>
            )}

            {/* Main emoji */}
            <motion.span
              animate={{
                scale: isActive ? 1.2 : 1,
                opacity: isActive ? 1 : 0.55,
                filter: isActive
                  ? "drop-shadow(0 0 10px rgba(168,85,247,0.75))"
                  : "none",
              }}
              transition={{ type: "spring", damping: 16, stiffness: 260 }}
              style={{ fontSize: "1.9rem", lineHeight: 1, display: "block" }}
            >
              {tab.emoji}
            </motion.span>

            {/* Text label */}
            <motion.span
              animate={{
                color: isActive ? "#c084fc" : "#374151",
                fontWeight: isActive ? 700 : 400,
              }}
              transition={{ duration: 0.15 }}
              style={{ fontSize: "0.57rem", letterSpacing: "0.02em", lineHeight: 1 }}
            >
              {tab.label}
            </motion.span>
          </motion.button>
        );
      })}
    </motion.nav>
  );
}
