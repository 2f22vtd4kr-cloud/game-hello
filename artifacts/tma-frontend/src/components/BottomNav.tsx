import { motion } from "framer-motion";
import { impact } from "@/lib/haptic";
import type { TabId } from "@/types";
import { Map, BarChart2, Ticket } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Props {
  active: TabId;
  onChange: (tab: TabId) => void;
  visible?: boolean;
  badges?: Partial<Record<TabId, number>>;
}

const TABS: { id: TabId; Icon: LucideIcon; label: string }[] = [
  { id: "map",       Icon: Map,       label: "Карта"       },
  { id: "catalog",   Icon: Ticket,    label: "Талоны"      },
  { id: "analytics", Icon: BarChart2, label: "Аналитика"   },
];

const NAV_CSS = `
@keyframes navStarTwinkle {
  0%,100% { opacity: 0.55; }
  50%      { opacity: 1;    }
}
`;

function NavStars() {
  const stars = Array.from({ length: 18 }, (_, i) => ({
    cx: `${5 + (i * 83) % 90}%`,
    cy: `${10 + (i * 61) % 80}%`,
    r: i % 3 === 0 ? 1.2 : 0.7,
    delay: `${(i * 0.37) % 2}s`,
    dur:   `${1.6 + (i * 0.23) % 1.2}s`,
  }));
  return (
    <svg
      width="100%" height="100%"
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      aria-hidden
    >
      {stars.map((s, i) => (
        <circle
          key={i} cx={s.cx} cy={s.cy} r={s.r}
          fill="white"
          style={{ animation: `navStarTwinkle ${s.dur} ${s.delay} ease-in-out infinite`, opacity: 0.55 }}
        />
      ))}
    </svg>
  );
}

export function BottomNav({ active, onChange, visible = true, badges = {} }: Props) {
  const handleTabClick = (tab: TabId) => {
    impact("light");
    onChange(tab);
  };

  return (
    <motion.nav
      animate={{ y: visible ? 0 : "200%" }}
      transition={{ type: "spring", damping: 28, stiffness: 300 }}
      style={{
        position: "fixed",
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)",
        left: "10px",
        right: "10px",
        background: "linear-gradient(160deg, rgba(22,27,210,0.97) 0%, rgba(14,18,175,0.97) 100%)",
        backdropFilter: "blur(28px) saturate(200%)",
        WebkitBackdropFilter: "blur(28px) saturate(200%)",
        border: "1px solid rgba(100,120,255,0.28)",
        borderTopColor: "rgba(160,180,255,0.40)",
        boxShadow: "0 8px 40px rgba(0,0,14,0.70), inset 0 1px 0 rgba(180,200,255,0.18), 0 0 60px rgba(30,34,220,0.25)",
        display: "flex",
        alignItems: "stretch",
        borderRadius: "22px",
        height: "64px",
        zIndex: 10000,
        padding: "0 4px",
        overflow: "hidden",
      }}
    >
      <style>{NAV_CSS}</style>
      <NavStars />

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
              gap: "2px",
              background: "none", border: "none",
              cursor: "pointer", position: "relative",
              WebkitTapHighlightColor: "transparent",
              borderRadius: "18px",
              minWidth: 0,
              zIndex: 1,
            }}
          >
            {isActive && (
              <motion.div
                layoutId="nav-pill"
                style={{
                  position: "absolute",
                  inset: "6px 8px",
                  borderRadius: "14px",
                  background: "rgba(255,255,255,0.13)",
                  border: "1px solid rgba(255,255,255,0.22)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18), 0 0 20px rgba(200,210,255,0.12)",
                }}
                transition={{ type: "spring", damping: 26, stiffness: 320 }}
              />
            )}

            {badge > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                style={{
                  position: "absolute",
                  top: "6px", right: "calc(50% - 20px)",
                  background: "linear-gradient(135deg, #E8622A, #E8622A)",
                  color: "#fff",
                  borderRadius: "999px",
                  minWidth: "16px", height: "16px",
                  fontSize: "0.44rem", fontWeight: 800,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  padding: "0 3px",
                  boxShadow: "0 0 8px rgba(232,98,42,0.7)",
                  border: "1.5px solid rgba(14,18,175,0.9)",
                  zIndex: 2,
                }}
              >
                {badge > 99 ? "99+" : badge}
              </motion.div>
            )}

            <motion.div
              animate={{
                scale: isActive ? 1.12 : 1,
              }}
              transition={{ type: "spring", damping: 16, stiffness: 260 }}
              style={{
                width: "32px", height: "32px",
                borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
                position: "relative", zIndex: 1,
              }}
            >
              <motion.div
                animate={{
                  color: isActive ? "#ffffff" : "rgba(180,200,255,0.45)",
                  filter: isActive
                    ? "drop-shadow(0 0 8px rgba(220,230,255,0.9))"
                    : "none",
                }}
                transition={{ duration: 0.18 }}
                style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <tab.Icon size={20} strokeWidth={isActive ? 2.2 : 1.6} />
              </motion.div>
            </motion.div>

            <motion.span
              animate={{
                opacity: isActive ? 1 : 0.38,
                y: 0,
              }}
              transition={{ duration: 0.15 }}
              style={{
                fontSize: "0.46rem",
                letterSpacing: "0.06em",
                lineHeight: 1,
                color: isActive ? "#ffffff" : "rgba(180,200,255,0.55)",
                fontWeight: isActive ? 700 : 500,
                position: "relative", zIndex: 1,
                whiteSpace: "nowrap",
              }}
            >
              {tab.label}
            </motion.span>
          </motion.button>
        );
      })}
    </motion.nav>
  );
}
