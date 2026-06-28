import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchNews } from "@/api/client";
import type { NewsItem, TabId } from "@/types";
import { RefreshCw, MapPin, Ticket, ChevronDown, ChevronUp, Radio } from "lucide-react";

interface Props {
  onNavigate?: (tab: TabId) => void;
}

const SEVERITY_CONFIG: Record<string, { emoji: string; label: string; color: string; bg: string; border: string }> = {
  critical: { emoji: "🔴", label: "КРИТИЧНО",       color: "#fb7185", bg: "rgba(251,113,133,0.07)", border: "#fb718540" },
  warning:  { emoji: "🟠", label: "ВНИМАНИЕ",        color: "#fb923c", bg: "rgba(251,146,60,0.07)",  border: "#fb923c40"  },
  info:     { emoji: "🟡", label: "СЛЕДИМ",           color: "#fbbf24", bg: "rgba(251,191,36,0.07)",  border: "#fbbf2440"  },
  success:  { emoji: "✅", label: "НОРМА",            color: "#34d399", bg: "rgba(52,211,153,0.07)",  border: "#34d39940"  },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "только что";
  if (m < 60) return `${m} ч назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  return `${Math.floor(h / 24)} д назад`;
}

function NewsCard({ item, onNavigate }: { item: NewsItem; onNavigate?: (tab: TabId) => void }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = SEVERITY_CONFIG[item.severity] ?? SEVERITY_CONFIG.info;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        marginBottom: "10px",
        borderRadius: "16px",
        overflow: "hidden",
        background: "rgba(20,20,32,0.75)",
        border: `1px solid ${cfg.border}`,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderLeft: `3px solid ${cfg.color}`,
      }}
    >
      <div style={{ padding: "14px 14px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "5px",
            background: cfg.bg,
            borderRadius: "6px", padding: "2px 8px",
          }}>
            <span style={{ fontSize: "0.65rem" }}>{cfg.emoji}</span>
            <span style={{ fontSize: "0.6rem", fontWeight: 700, color: cfg.color, letterSpacing: "0.08em" }}>
              {cfg.label}
            </span>
          </div>
          <span style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.35)" }}>
            {timeAgo(item.created_at)}
          </span>
        </div>

        {(item.region || item.fuel_type) && (
          <div style={{ display: "flex", gap: "5px", marginBottom: "7px", flexWrap: "wrap" }}>
            {item.region && (
              <span style={{
                fontSize: "0.62rem", color: "rgba(255,255,255,0.55)",
                background: "rgba(255,255,255,0.06)", padding: "2px 7px", borderRadius: "5px",
                display: "flex", alignItems: "center", gap: "3px",
              }}>
                <MapPin size={9} /> {item.region}
              </span>
            )}
            {item.fuel_type && (
              <span style={{
                fontSize: "0.62rem", color: "#fbbf24",
                background: "rgba(251,191,36,0.08)", padding: "2px 7px", borderRadius: "5px",
              }}>
                ⛽ {item.fuel_type}
              </span>
            )}
            {item.price_delta_pct !== null && (
              <span style={{
                fontSize: "0.62rem", fontWeight: 700,
                color: item.price_delta_pct > 0 ? "#fb7185" : "#34d399",
                background: item.price_delta_pct > 0 ? "rgba(251,113,133,0.08)" : "rgba(52,211,153,0.08)",
                padding: "2px 7px", borderRadius: "5px",
              }}>
                {item.price_delta_pct > 0 ? "+" : ""}{item.price_delta_pct.toFixed(1)}% к цене
              </span>
            )}
          </div>
        )}

        <p style={{
          fontSize: "0.88rem", fontWeight: 600, color: "rgba(255,255,255,0.92)",
          lineHeight: 1.45, marginBottom: "6px",
        }}>
          {item.headline}
        </p>

        <AnimatePresence>
          {item.body && expanded && (
            <motion.p
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              style={{
                fontSize: "0.8rem", color: "rgba(255,255,255,0.55)",
                lineHeight: 1.55, overflow: "hidden", marginBottom: "8px",
              }}
            >
              {item.body}
            </motion.p>
          )}
        </AnimatePresence>

        {item.body && (
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", gap: "3px",
              color: "#E8622A", fontSize: "0.7rem", padding: "2px 0", fontWeight: 500,
            }}
          >
            {expanded ? <><ChevronUp size={12} /> Свернуть</> : <><ChevronDown size={12} /> Читать далее</>}
          </button>
        )}
      </div>

      {(item.severity === "critical" || item.severity === "warning") && (
        <div style={{
          padding: "8px 14px",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          display: "flex", gap: "8px",
        }}>
          <button
            onClick={() => onNavigate?.("catalog")}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "5px",
              padding: "8px", borderRadius: "10px", border: "none", cursor: "pointer",
              background: "linear-gradient(135deg, #7c3aed, #E8622A)",
              color: "#fff", fontSize: "0.72rem", fontWeight: 600,
              boxShadow: "0 0 12px rgba(232,98,42,0.3)",
            }}
          >
            <Ticket size={12} />
            Доступные талоны
          </button>
          <button
            onClick={() => onNavigate?.("map")}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "5px",
              padding: "8px", borderRadius: "10px", cursor: "pointer",
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.8)", fontSize: "0.72rem", fontWeight: 600,
            }}
          >
            <MapPin size={12} />
            Карта
          </button>
        </div>
      )}
    </motion.div>
  );
}

function CrisisTimeline({ items }: { items: NewsItem[] }) {
  const milestones = items.filter(i => i.severity === "critical" || i.severity === "warning").slice(0, 5);
  if (!milestones.length) return null;
  return (
    <div style={{ marginTop: "16px", marginBottom: "8px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
        <div style={{ width: "3px", height: "12px", background: "linear-gradient(180deg,#fb7185,#f97316)", borderRadius: "2px" }} />
        <h3 style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.35)", letterSpacing: "0.14em", textTransform: "uppercase", margin: 0 }}>
          Хронология кризиса
        </h3>
      </div>
      <div style={{ position: "relative", paddingLeft: "18px" }}>
        <div style={{ position: "absolute", left: "7px", top: "4px", bottom: "4px", width: "2px", background: "linear-gradient(180deg,rgba(251,113,133,0.4),transparent)", borderRadius: "1px" }} />
        {milestones.map((item, i) => {
          const cfg = SEVERITY_CONFIG[item.severity];
          const isFirst = i === 0;
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              style={{
                display: "flex", gap: "10px", marginBottom: "10px", position: "relative",
                background: isFirst ? cfg.bg : "transparent",
                borderRadius: isFirst ? "10px" : 0,
                padding: isFirst ? "6px 8px 6px 4px" : "2px 0",
                border: isFirst ? `1px solid ${cfg.border}` : "none",
              }}
            >
              <div style={{
                position: "absolute", left: "-14px", top: "8px",
                width: isFirst ? "10px" : "7px", height: isFirst ? "10px" : "7px",
                borderRadius: "50%",
                background: cfg.color,
                boxShadow: isFirst ? `0 0 10px ${cfg.color}` : `0 0 4px ${cfg.color}`,
                flexShrink: 0,
              }} />
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: isFirst ? "0.75rem" : "0.7rem", color: isFirst ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.55)", fontWeight: isFirst ? 700 : 500, lineHeight: 1.3, marginBottom: "1px" }}>{item.headline}</p>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  {item.region && (
                    <span style={{ fontSize: "0.58rem", color: cfg.color, background: cfg.bg, borderRadius: "4px", padding: "0 4px" }}>
                      📍 {item.region}
                    </span>
                  )}
                  <span style={{ fontSize: "0.58rem", color: "rgba(255,255,255,0.3)" }}>{timeAgo(item.created_at)}</span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export function NewsTab({ onNavigate }: Props) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<string | null>(null);
  const [regionFilter, setRegionFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"severity" | "time">("time");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const items = await fetchNews(undefined, 30);
      setNews(items);
    } catch {
      setError("Не удалось загрузить ленту новостей.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const id = setInterval(() => void load(), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const SEV_ORDER: Record<string, number> = { critical: 0, warning: 1, info: 2, success: 3 };
  const filteredNews = news
    .filter(n => {
      if (severityFilter && n.severity !== severityFilter) return false;
      if (regionFilter && !n.region?.includes(regionFilter)) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "severity") return (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9);
      return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
    });

  const activeRegions = [...new Set(news.filter(n => n.region).map(n => n.region))].sort().slice(0, 6);
  const criticalCount = news.filter(n => n.severity === "critical").length;
  const warningCount  = news.filter(n => n.severity === "warning").length;
  const crisisLevel   = criticalCount >= 3 ? 5 : criticalCount >= 2 ? 4 : criticalCount >= 1 ? 3 : warningCount >= 2 ? 2 : 1;
  const crisisRegions = [...new Set(news.filter(n => n.severity === "critical" && n.region).map(n => n.region))].slice(0, 3);
  const crisisColor   = crisisLevel >= 4 ? "#fb7185" : crisisLevel >= 3 ? "#fb923c" : crisisLevel >= 2 ? "#fbbf24" : "#34d399";

  return (
    <div style={{ minHeight: "100%", padding: "16px 14px 12px", background: "transparent" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 800, color: "rgba(255,255,255,0.95)", letterSpacing: "-0.01em", margin: 0 }}>
              Оперативная Сводка
            </h2>
            <div style={{
              display: "flex", alignItems: "center", gap: "4px",
              background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.35)",
              borderRadius: "20px", padding: "2px 7px",
            }}>
              <motion.div
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#ef4444" }}
              />
              <span style={{ fontSize: "0.58rem", fontWeight: 700, color: "#ef4444", letterSpacing: "0.06em" }}>LIVE</span>
            </div>
          </div>
          <p style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.35)", margin: 0 }}>
            {filteredNews.length}{severityFilter ? ` из ${news.length}` : ""} событий · обновляется
          </p>
        </div>
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <button
            onClick={() => setSortBy(s => s === "time" ? "severity" : "time")}
            style={{
              background: "rgba(232,98,42,0.08)", border: "1px solid rgba(232,98,42,0.2)",
              borderRadius: "10px", color: sortBy === "severity" ? "#E8622A" : "rgba(255,255,255,0.45)",
              fontSize: "0.6rem", padding: "0.28rem 0.6rem", cursor: "pointer", whiteSpace: "nowrap", fontWeight: 600,
            }}
          >{sortBy === "time" ? "⏱ Время" : "🔴 Важность"}</button>
          {(criticalCount + warningCount) > 0 && (
            <button
              onClick={() => {
                localStorage.setItem("tma-news-last-visit", Date.now().toString());
                window.dispatchEvent(new CustomEvent("tma-news-read-all"));
              }}
              style={{
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "10px", color: "rgba(255,255,255,0.45)",
                fontSize: "0.6rem", padding: "0.28rem 0.6rem", cursor: "pointer", whiteSpace: "nowrap",
              }}
            >✓ Прочитано</button>
          )}
          <button
            onClick={() => void load()}
            disabled={loading}
            style={{
              width: "34px", height: "34px", display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "10px", cursor: "pointer", padding: 0,
            }}
          >
            <RefreshCw size={14} style={{ animation: loading ? "spin 1s linear infinite" : "none", color: "#E8622A" }} />
          </button>
        </div>
      </div>

      {/* Crisis Banner */}
      <AnimatePresence>
        {!bannerDismissed && crisisLevel >= 2 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{
              background: `rgba(${crisisLevel >= 4 ? "251,113,133" : crisisLevel >= 3 ? "251,146,60" : "251,191,36"},0.08)`,
              border: `1px solid ${crisisColor}33`,
              borderRadius: "14px",
              padding: "10px 12px",
              marginBottom: "14px",
              display: "flex", alignItems: "center", gap: "8px",
            }}
          >
            <Radio size={14} style={{ color: crisisColor, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: "0.72rem", fontWeight: 700, color: crisisColor, letterSpacing: "0.05em" }}>
                КРИЗИСНЫЙ РЕЖИМ · Уровень {crisisLevel}/5
              </span>
              {crisisRegions.length > 0 && (
                <p style={{ fontSize: "0.63rem", color: "rgba(255,255,255,0.45)", marginTop: "2px", margin: "2px 0 0" }}>
                  {crisisRegions.join(" · ")}
                </p>
              )}
            </div>
            <button
              onClick={() => setBannerDismissed(true)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.35)", fontSize: "1.1rem", padding: "2px", flexShrink: 0, lineHeight: 1 }}
            >×</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Region quick-filter chips */}
      {!loading && news.length > 0 && (() => {
        const CITY_KEYWORDS: { label: string; emoji: string; key: string }[] = [
          { label: "Все",    emoji: "🌐", key: "" },
          { label: "Крым",  emoji: "🌊", key: "Крым" },
          { label: "Москва",emoji: "🏙", key: "Москва" },
          { label: "Питер", emoji: "⚓", key: "Петербург" },
        ];
        return (
          <div style={{ display: "flex", gap: "0.35rem", marginBottom: "8px", overflowX: "auto" }}>
            {CITY_KEYWORDS.map(({ label, emoji, key }) => {
              const active = (regionFilter ?? "") === key;
              const count = key ? news.filter(n => n.region?.includes(key)).length : news.length;
              if (!active && key && !count) return null;
              return (
                <button
                  key={key}
                  onClick={() => setRegionFilter(key || null)}
                  style={{
                    flexShrink: 0,
                    background: active ? "linear-gradient(135deg,#7c3aed,#E8622A)" : "rgba(255,255,255,0.04)",
                    border: active ? "1px solid #E8622A" : "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "20px",
                    padding: "0.24rem 0.7rem",
                    cursor: "pointer",
                    display: "flex", alignItems: "center", gap: "4px",
                    transition: "all 0.15s",
                  }}
                >
                  <span style={{ fontSize: "0.62rem" }}>{emoji}</span>
                  <span style={{ color: active ? "#fff" : "rgba(255,255,255,0.5)", fontSize: "0.64rem", fontWeight: active ? 700 : 400 }}>{label}</span>
                  {count > 0 && (
                    <span style={{
                      background: active ? "rgba(255,255,255,0.2)" : "rgba(232,98,42,0.12)",
                      borderRadius: "9px", padding: "0 4px",
                      fontSize: "0.52rem", fontWeight: 700,
                      color: active ? "#fff" : "#E8622A",
                      minWidth: "14px", textAlign: "center",
                    }}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        );
      })()}

      {/* Severity filter chips */}
      {!loading && news.length > 0 && (
        <div style={{ display: "flex", gap: "0.35rem", marginBottom: "14px", overflowX: "auto", paddingBottom: "2px" }}>
          <button
            onClick={() => setSeverityFilter(null)}
            style={{
              flexShrink: 0, padding: "4px 12px",
              background: !severityFilter ? "rgba(232,98,42,0.15)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${!severityFilter ? "rgba(232,98,42,0.5)" : "rgba(255,255,255,0.08)"}`,
              borderRadius: "999px", color: !severityFilter ? "#E8622A" : "rgba(255,255,255,0.4)",
              fontSize: "0.64rem", cursor: "pointer", fontWeight: 600,
            }}
          >Все · {news.length}</button>
          {(["critical","warning","info","success"] as const).map((sev) => {
            const cfg = SEVERITY_CONFIG[sev];
            const count = news.filter(n => n.severity === sev).length;
            if (!count) return null;
            return (
              <button key={sev}
                onClick={() => setSeverityFilter(severityFilter === sev ? null : sev)}
                style={{
                  flexShrink: 0, padding: "4px 11px",
                  background: severityFilter === sev ? cfg.bg : "rgba(255,255,255,0.04)",
                  border: `1px solid ${severityFilter === sev ? cfg.color + "60" : "rgba(255,255,255,0.08)"}`,
                  borderRadius: "999px", color: severityFilter === sev ? cfg.color : "rgba(255,255,255,0.4)",
                  fontSize: "0.64rem", cursor: "pointer", fontWeight: 600,
                  display: "flex", alignItems: "center", gap: "4px",
                }}
              >
                <span>{cfg.emoji}</span>{count}
              </button>
            );
          })}
          {activeRegions.length > 1 && (
            <>
              <div style={{ width: "1px", height: "20px", background: "rgba(255,255,255,0.08)", alignSelf: "center", flexShrink: 0 }} />
              {activeRegions.map(r => (
                <button key={r}
                  onClick={() => setRegionFilter(regionFilter === r ? null : (r ?? null))}
                  style={{
                    flexShrink: 0, padding: "4px 10px",
                    background: regionFilter === r ? "rgba(244,114,182,0.12)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${regionFilter === r ? "rgba(244,114,182,0.4)" : "rgba(255,255,255,0.07)"}`,
                    borderRadius: "999px", color: regionFilter === r ? "#E8622A" : "rgba(255,255,255,0.35)",
                    fontSize: "0.6rem", cursor: "pointer", fontWeight: 600,
                  }}
                >{r}</button>
              ))}
            </>
          )}
        </div>
      )}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ height: "100px", borderRadius: "16px", background: "rgba(255,255,255,0.04)", animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
        </div>
      ) : error ? (
        <div style={{ textAlign: "center", padding: "40px 20px" }}>
          <p style={{ color: "#fb7185", marginBottom: "12px", fontSize: "0.88rem" }}>{error}</p>
          <button
            onClick={() => void load()}
            style={{
              padding: "8px 20px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.7)",
              fontSize: "0.82rem", cursor: "pointer",
            }}
          >
            Повторить
          </button>
        </div>
      ) : (
        <>
          {filteredNews.map(item => (
            <NewsCard key={item.id} item={item} onNavigate={onNavigate} />
          ))}
          {!severityFilter && <CrisisTimeline items={news} />}
          {filteredNews.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "rgba(255,255,255,0.35)" }}>
              <p style={{ fontSize: "2rem", marginBottom: "8px" }}>{severityFilter ? (SEVERITY_CONFIG[severityFilter]?.emoji ?? "📰") : "📰"}</p>
              <p style={{ fontSize: "0.9rem", marginBottom: "8px" }}>
                {severityFilter ? `Нет новостей «${SEVERITY_CONFIG[severityFilter]?.label ?? severityFilter}»` : "Новостей пока нет"}
              </p>
              {severityFilter && (
                <button
                  onClick={() => setSeverityFilter(null)}
                  style={{
                    padding: "8px 18px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)",
                    fontSize: "0.78rem", cursor: "pointer", marginTop: "6px",
                  }}
                >
                  Сбросить фильтр
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
