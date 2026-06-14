import { motion } from "framer-motion";
import { impact } from "@/lib/haptic";
import type { TabId } from "@/types";
import { Map, BarChart2, ShoppingCart, Lock, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Props {
  active: TabId;
  onChange: (tab: TabId) => void;
  visible?: boolean;
  badges?: Partial<Record<TabId, number>>;
}

const TABS: { id: TabId; Icon: LucideIcon; label: string }[] = [
  { id: "map",       Icon: Map,          label: "Карта"   },
  { id: "analytics", Icon: BarChart2,    label: "Данные"  },
  { id: "catalog",   Icon: ShoppingCart, label: "Каталог" },
  { id: "vault",     Icon: Lock,         label: "Сейф"    },
  { id: "reserve",   Icon: Sparkles,     label: "Фортуна" },
];

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
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
        left: "12px",
        right: "12px",
        background: "rgba(8,8,16,0.88)",
        backdropFilter: "blur(24px) saturate(160%)",
        WebkitBackdropFilter: "blur(24px) saturate(160%)",
        border: "1px solid rgba(168,85,247,0.2)",
        boxShadow: "0 8px 40px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(168,85,247,0.06)",
        display: "flex",
        alignItems: "stretch",
        borderRadius: "99px",
        height: "64px",
        zIndex: 10000,
        padding: "0 6px",
      }}
    >
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
              gap: "3px",
              background: "none", border: "none",
              cursor: "pointer", position: "relative",
              WebkitTapHighlightColor: "transparent",
              borderRadius: "99px",
            }}
          >
            {/* Active top pill */}
            {isActive && (
              <motion.div
                layoutId="nav-pill"
                style={{
                  position: "absolute",
                  top: "8px", left: "20%", right: "20%",
                  height: "2px",
                  borderRadius: "99px",
                  background: "linear-gradient(90deg, #a855f7, #db2777)",
                  boxShadow: "0 0 10px #a855f799, 0 0 20px #a855f744",
                }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
              />
            )}

            {/* Badge */}
            {badge > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                style={{
                  position: "absolute",
                  top: "8px", right: "calc(50% - 18px)",
                  background: "linear-gradient(135deg,#ef4444,#dc2626)",
                  color: "#fff",
                  borderRadius: "99px",
                  minWidth: "16px", height: "16px",
                  fontSize: "0.45rem", fontWeight: 800,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  padding: "0 3px",
                  boxShadow: "0 0 8px rgba(239,68,68,0.65)",
                  border: "1.5px solid rgba(8,8,16,0.9)",
                  zIndex: 2,
                }}
              >
                {badge > 99 ? "99+" : badge}
              </motion.div>
            )}

            {/* Icon with circle backdrop for active */}
            <motion.div
              animate={{
                background: isActive ? "rgba(168,85,247,0.15)" : "transparent",
              }}
              transition={{ duration: 0.2 }}
              style={{
                width: "36px", height: "36px",
                borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <motion.div
                animate={{
                  color: isActive ? "#c084fc" : "#374151",
                  scale: isActive ? 1.1 : 1,
                  filter: isActive
                    ? "drop-shadow(0 0 8px rgba(168,85,247,0.6))"
                    : "none",
                }}
                transition={{ type: "spring", damping: 16, stiffness: 260 }}
                style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <tab.Icon size={20} />
              </motion.div>
            </motion.div>

            {/* Label — active tab only */}
            <motion.span
              animate={{ opacity: isActive ? 1 : 0, y: isActive ? 0 : 3 }}
              transition={{ duration: 0.15 }}
              style={{
                fontSize: "0.5rem",
                letterSpacing: "0.06em",
                lineHeight: 1,
                color: "#c084fc",
                fontWeight: 700,
                position: "absolute",
                bottom: "7px",
                pointerEvents: "none",
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
