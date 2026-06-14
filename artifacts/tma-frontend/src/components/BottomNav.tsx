import { motion } from "framer-motion";
import type { TabId } from "@/types";

interface Props {
  active: TabId;
  onChange: (tab: TabId) => void;
  visible?: boolean;
  badges?: Partial<Record<TabId, number>>;
}

// Custom SVG icons — cleaner and more premium than emojis
const ICONS: Record<TabId, (active: boolean) => React.ReactNode> = {
  map: (a) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? "#a855f7" : "#4b5563"} strokeWidth={a ? 1.8 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <line x1="8" y1="2" x2="8" y2="18" />
      <line x1="16" y1="6" x2="16" y2="22" />
    </svg>
  ),
  analytics: (a) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? "#a855f7" : "#4b5563"} strokeWidth={a ? 1.8 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
      <line x1="2" y1="20" x2="22" y2="20" />
    </svg>
  ),
  catalog: (a) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? "#a855f7" : "#4b5563"} strokeWidth={a ? 1.8 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2 9m13-9l2 9M9 21a1 1 0 100-2 1 1 0 000 2zm10 0a1 1 0 100-2 1 1 0 000 2z" />
    </svg>
  ),
  vault: (a) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? "#a855f7" : "#4b5563"} strokeWidth={a ? 1.8 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  ),
  reserve: (a) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? "#a855f7" : "#4b5563"} strokeWidth={a ? 1.8 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
};

const TABS: { id: TabId; label: string }[] = [
  { id: "map",       label: "Карта" },
  { id: "analytics", label: "Данные" },
  { id: "catalog",   label: "Каталог" },
  { id: "vault",     label: "Сейф" },
  { id: "reserve",   label: "Фортуна" },
];

export function BottomNav({ active, onChange, visible = true, badges = {} }: Props) {
  return (
    <motion.nav
      animate={{ y: visible ? 0 : "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 300 }}
      style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "rgba(6,6,10,0.98)",
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
        borderTop: "1px solid rgba(168,85,247,0.12)",
        boxShadow: "0 -4px 40px rgba(0,0,0,0.7), 0 -1px 0 rgba(168,85,247,0.08)",
        display: "flex", alignItems: "stretch",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        zIndex: 10000,
      }}
    >
      {/* Top accent line */}
      <div style={{
        position: "absolute",
        top: 0, left: "10%", right: "10%",
        height: "1px",
        background: "linear-gradient(90deg, transparent, rgba(168,85,247,0.3), rgba(219,39,119,0.3), transparent)",
        pointerEvents: "none",
      }} />

      {TABS.map((tab) => {
        const isActive = active === tab.id;
        const badgeCount = badges[tab.id] ?? 0;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            style={{
              flex: 1,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              gap: "3px",
              padding: "0.55rem 0.2rem",
              background: "none", border: "none",
              cursor: "pointer", position: "relative",
              WebkitTapHighlightColor: "transparent",
              minHeight: "56px",
            }}
          >
            {/* Active indicator pill */}
            {isActive && (
              <motion.div
                layoutId="nav-active"
                style={{
                  position: "absolute",
                  top: 0, left: "18%", right: "18%",
                  height: "2px",
                  borderRadius: "0 0 2px 2px",
                  background: "linear-gradient(90deg, #a855f7, #db2777)",
                  boxShadow: "0 0 10px #a855f788, 0 0 24px #a855f744",
                }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
              />
            )}

            {/* Active background glow */}
            {isActive && (
              <div style={{
                position: "absolute",
                inset: "2px 4px",
                borderRadius: "10px",
                background: "radial-gradient(ellipse at 50% 0%, rgba(168,85,247,0.1) 0%, transparent 70%)",
                pointerEvents: "none",
              }} />
            )}

            {/* Icon with badge */}
            <div style={{ position: "relative", lineHeight: 1 }}>
              <motion.div
                animate={{
                  scale: isActive ? 1.1 : 1,
                  filter: isActive
                    ? "drop-shadow(0 0 6px rgba(168,85,247,0.6))"
                    : "none",
                }}
                transition={{ type: "spring", damping: 18, stiffness: 260 }}
              >
                {ICONS[tab.id](isActive)}
              </motion.div>

              {badgeCount > 0 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  style={{
                    position: "absolute",
                    top: "-5px", right: "-7px",
                    background: "linear-gradient(135deg, #ef4444, #dc2626)",
                    color: "#fff",
                    borderRadius: "99px",
                    minWidth: "16px", height: "16px",
                    fontSize: "0.5rem", fontWeight: 800,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "0 3px",
                    boxShadow: "0 0 8px rgba(239,68,68,0.6)",
                    border: "1.5px solid rgba(6,6,10,0.9)",
                  }}
                >
                  {badgeCount > 99 ? "99+" : badgeCount}
                </motion.div>
              )}
            </div>

            {/* Label */}
            <motion.span
              animate={{
                color: isActive ? "#c084fc" : "#374151",
                fontWeight: isActive ? 600 : 400,
              }}
              transition={{ duration: 0.2 }}
              style={{
                fontSize: "0.58rem",
                letterSpacing: "0.03em",
              }}
            >
              {tab.label}
            </motion.span>
          </button>
        );
      })}
    </motion.nav>
  );
}
