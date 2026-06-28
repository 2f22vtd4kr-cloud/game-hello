import { useState, useMemo, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import "./_group.css";

/* ─── Palette ────────────────────────────────────────────────── */
const BG       = "linear-gradient(160deg, #0C0EA8 0%, #090B82 40%, #060760 75%, #040450 100%)";
const AVAIL    = { green: "#00E676", yellow: "#FFD600", red: "#FF1744" };
const VIOLET   = "#a855f7";
const MAGENTA  = "#db2777";

/* ─── Mock data ─────────────────────────────────────────────── */
const REGIONS: { name: string; pct: number; green: number; yellow: number; red: number; total: number; zone: string }[] = [
  { name: "Севастополь",           pct: 72, green: 48, yellow: 19, red: 5,  total: 72,  zone: "critical"  },
  { name: "Симферополь",           pct: 58, green: 31, yellow: 22, red: 11, total: 64,  zone: "standard"  },
  { name: "Керчь",                 pct: 44, green: 17, yellow: 18, red: 9,  total: 44,  zone: "eastern"   },
  { name: "Евпатория",             pct: 81, green: 52, yellow: 14, red: 3,  total: 69,  zone: "standard"  },
  { name: "Феодосия",              pct: 21, green: 7,  yellow: 11, red: 17, total: 35,  zone: "eastern"   },
  { name: "Ялта",                  pct: 63, green: 38, yellow: 16, red: 6,  total: 60,  zone: "critical"  },
  { name: "Джанкой",               pct: 12, green: 3,  yellow: 8,  red: 22, total: 33,  zone: "standard"  },
  { name: "Бахчисарай",            pct: 49, green: 21, yellow: 17, red: 6,  total: 44,  zone: "standard"  },
  { name: "Красноперекопск",       pct: 33, green: 11, yellow: 14, red: 11, total: 36,  zone: "eastern"   },
  { name: "Судак",                 pct: 67, green: 29, yellow: 12, red: 2,  total: 43,  zone: "standard"  },
  { name: "Саки",                  pct: 55, green: 24, yellow: 15, red: 5,  total: 44,  zone: "standard"  },
  { name: "Алушта",                pct: 77, green: 41, yellow: 13, red: 2,  total: 56,  zone: "critical"  },
  { name: "Белогорск",             pct: 18, green: 4,  yellow: 10, red: 18, total: 32,  zone: "eastern"   },
];

const TREND = Array.from({ length: 24 }, (_, i) => ({
  t: `${String(i).padStart(2,"0")}:00`,
  pct: Math.round(42 + 28 * Math.sin((i / 24) * Math.PI * 2 + 1) + Math.random() * 8),
}));

const PRICE_REGIONS = REGIONS.slice(0, 6).map(r => ({
  name: r.name.split(" ").slice(-1)[0].slice(0, 12),
  pct: r.pct,
  ai92: Math.round(63 + (100 - r.pct) * 0.08 + Math.random() * 2),
  ai95: Math.round(71 + (100 - r.pct) * 0.09 + Math.random() * 2),
  dt:   Math.round(68 + (100 - r.pct) * 0.07 + Math.random() * 2),
  crisis: r.pct < 25,
}));

const ZONE_LABEL: Record<string, string> = { critical: "КР", standard: "СТ", eastern: "ВС" };
const crisisCount = REGIONS.filter(r => r.pct < 25).length;
const avgPct      = Math.round(REGIONS.reduce((a, r) => a + r.pct, 0) / REGIONS.length);
const totalAZS    = REGIONS.reduce((a, r) => a + r.total, 0);

/* ─── CSS ────────────────────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
@keyframes starTwinkle { 0%,100%{opacity:var(--op)} 50%{opacity:calc(var(--op)*0.3)} }
@keyframes ambientFlow { 0%{background-position:0% 50%} 100%{background-position:200% 50%} }
@keyframes ambientPulse{ 0%,100%{opacity:.55} 50%{opacity:1} }
@keyframes scanPulse   { 0%,100%{transform:scale(1);opacity:.8} 50%{transform:scale(1.35);opacity:.3} }
@keyframes countUp     { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:none} }
@keyframes slideIn     { from{opacity:0;transform:translateX(-6px)} to{opacity:1;transform:none} }
.ambient-strip{background-size:200% 100%;animation:ambientFlow 3s linear infinite,ambientPulse 2.6s ease-in-out infinite;}
`;

/* ─── Stars ─────────────────────────────────────────────────── */
function Stars({ n = 90 }: { n?: number }) {
  const stars = useMemo(() =>
    Array.from({ length: n }, (_, i) => ({
      id: i,
      x: Math.random() * 100, y: Math.random() * 100,
      r: Math.random() * 1.4 + 0.3,
      op: Math.random() * 0.6 + 0.1,
      dur: 2 + Math.random() * 4,
      delay: Math.random() * 4,
    })), [n]);
  return (
    <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%", pointerEvents:"none", zIndex:1 }}>
      {stars.map(s => (
        <circle key={s.id} cx={`${s.x}%`} cy={`${s.y}%`} r={s.r} fill="white"
          style={{ opacity:s.op, animation:`starTwinkle ${s.dur}s ${s.delay}s ease-in-out infinite`, ["--op" as string]:s.op } as React.CSSProperties}
        />
      ))}
    </svg>
  );
}

/* ─── Ambient strip ─────────────────────────────────────────── */
function Strip({ color, style = {} }: { color: string; style?: React.CSSProperties }) {
  const grad = `linear-gradient(90deg,transparent 0%,${color}00 5%,${color}cc 30%,${color} 50%,${color}cc 70%,${color}00 95%,transparent 100%)`;
  return <div className="ambient-strip" style={{ position:"absolute", background:grad, height:"1.5px", width:"100%", pointerEvents:"none", ...style }} />;
}

/* ─── Stat card ─────────────────────────────────────────────── */
function StatCard({ label, value, unit, color, icon }: { label: string; value: number | string; unit?: string; color: string; icon: string }) {
  return (
    <div style={{
      flex: "1 1 0",
      background: "rgba(6,8,80,0.72)",
      border: `1px solid ${color}33`,
      borderRadius: 14,
      padding: "0.7rem 0.65rem 0.6rem",
      position: "relative",
      overflow: "hidden",
      boxShadow: `0 0 18px ${color}18`,
    }}>
      <Strip color={color} style={{ top:0, left:0, right:0 }} />
      <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"1.35rem", fontWeight:800, color, lineHeight:1, animation:"countUp .5s ease both" }}>
        {value}<span style={{ fontSize:"0.7rem", fontWeight:600, marginLeft:2 }}>{unit}</span>
      </div>
      <div style={{ color:"#6b7280", fontSize:"0.58rem", textTransform:"uppercase", letterSpacing:"0.08em", marginTop:3 }}>{label}</div>
    </div>
  );
}

/* ─── Region bar row ─────────────────────────────────────────── */
function RegionBar({ region, rank }: { region: typeof REGIONS[0]; rank: number }) {
  const color  = region.pct >= 60 ? AVAIL.green : region.pct >= 25 ? AVAIL.yellow : AVAIL.red;
  const total  = region.green + region.yellow + region.red;
  const gP = total ? (region.green  / total) * 100 : 0;
  const yP = total ? (region.yellow / total) * 100 : 0;
  const rP = total ? (region.red    / total) * 100 : 0;
  const isCrit = region.pct < 25;
  return (
    <div style={{
      marginBottom: "0.45rem",
      background: isCrit ? "rgba(20,4,4,0.6)" : "rgba(6,8,80,0.42)",
      border: `1px solid ${isCrit ? AVAIL.red + "30" : color + "18"}`,
      borderLeft: `3px solid ${color}`,
      borderRadius: 10,
      padding: "0.5rem 0.7rem 0.42rem",
      position: "relative",
      overflow: "hidden",
      animation: `slideIn .35s ${rank * 0.03}s ease both`,
    }}>
      {isCrit && <Strip color={AVAIL.red} style={{ top:0, left:0, right:0 }} />}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"0.3rem" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"0.35rem", flex:1, minWidth:0 }}>
          <span style={{ fontFamily:"'JetBrains Mono',monospace", color:"#374151", fontSize:"0.52rem", flexShrink:0 }}>#{String(rank+1).padStart(2,"0")}</span>
          <span style={{ color: isCrit ? "#fca5a5" : "#c4cad6", fontSize:"0.67rem", fontWeight: isCrit ? 700 : 500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {region.name}
          </span>
          <span style={{ fontSize:"0.5rem", fontWeight:700, padding:"0.08rem 0.28rem", borderRadius:4, background:`${color}18`, border:`1px solid ${color}30`, color, fontFamily:"'JetBrains Mono',monospace", flexShrink:0 }}>
            {ZONE_LABEL[region.zone]}
          </span>
        </div>
        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"0.78rem", fontWeight:700, color, background:`${color}18`, padding:"0.1rem 0.4rem", borderRadius:5, border:`1px solid ${color}35`, boxShadow: isCrit ? `0 0 8px ${color}40` : "none", flexShrink:0 }}>
          {region.pct}%
        </span>
      </div>
      <div style={{ height:8, borderRadius:4, overflow:"hidden", background:"rgba(5,5,24,0.7)", display:"flex", gap:1 }}>
        {gP > 0 && <div style={{ width:`${gP}%`, background:`linear-gradient(90deg,#16a34a,${AVAIL.green})`, height:"100%", borderRadius:"3px 0 0 3px", transition:"width 1s" }} />}
        {yP > 0 && <div style={{ width:`${yP}%`, background:`linear-gradient(90deg,#ca8a04,${AVAIL.yellow})`, height:"100%", transition:"width 1s" }} />}
        {rP > 0 && <div style={{ width:`${rP}%`, background:`linear-gradient(90deg,#dc2626,${AVAIL.red})`, height:"100%", borderRadius:"0 3px 3px 0", transition:"width 1s" }} />}
      </div>
      <div style={{ display:"flex", gap:"0.6rem", marginTop:"0.22rem" }}>
        {gP > 1 && <span style={{ color:AVAIL.green+"88", fontSize:"0.53rem", fontFamily:"'JetBrains Mono',monospace" }}>■ {Math.round(gP)}% норма</span>}
        {yP > 1 && <span style={{ color:AVAIL.yellow+"88", fontSize:"0.53rem", fontFamily:"'JetBrains Mono',monospace" }}>■ {Math.round(yP)}% мало</span>}
        {rP > 1 && <span style={{ color:AVAIL.red+"88", fontSize:"0.53rem", fontFamily:"'JetBrains Mono',monospace" }}>■ {Math.round(rP)}% нет</span>}
        <span style={{ marginLeft:"auto", color:"#374151", fontSize:"0.52rem" }}>{region.total} АЗС</span>
      </div>
    </div>
  );
}

/* ─── Region cycling monitor ─────────────────────────────────── */
function RegionMonitor() {
  const [idx, setIdx] = useState(0);
  const [vis, setVis] = useState(true);
  const sorted = useMemo(() => [...REGIONS].sort((a,b) => b.pct - a.pct), []);
  useEffect(() => {
    const id = setInterval(() => {
      setVis(false);
      setTimeout(() => { setIdx(i => (i + 1) % sorted.length); setVis(true); }, 280);
    }, 2600);
    return () => clearInterval(id);
  }, [sorted.length]);
  const r     = sorted[idx];
  const color = r.pct >= 60 ? AVAIL.green : r.pct >= 25 ? AVAIL.yellow : AVAIL.red;
  return (
    <div style={{ background:"rgba(6,8,80,0.5)", border:"1px solid rgba(100,120,255,0.18)", borderRadius:12, padding:"0.65rem 0.85rem", display:"flex", alignItems:"center", gap:"0.65rem" }}>
      <div style={{ width:8, height:8, borderRadius:"50%", flexShrink:0, background:VIOLET, boxShadow:`0 0 8px ${VIOLET}`, animation:"scanPulse 1.5s infinite" }} />
      <div style={{ flex:1, minWidth:0, transition:"opacity .28s", opacity: vis ? 1 : 0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:"0.45rem" }}>
          <span style={{ color:"#4b5563", fontSize:"0.6rem", textTransform:"uppercase", letterSpacing:"0.07em", flexShrink:0 }}>СКАН</span>
          <span style={{ color:"#e2e8f0", fontSize:"0.8rem", fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.name}</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:"0.45rem", marginTop:"0.15rem" }}>
          <span style={{ color, fontFamily:"'JetBrains Mono',monospace", fontSize:"1rem", fontWeight:700 }}>{r.pct}%</span>
          <span style={{ color:"#4b5563", fontSize:"0.6rem", background:"rgba(14,14,40,0.7)", borderRadius:4, padding:"0.08rem 0.3rem" }}>{ZONE_LABEL[r.zone]}</span>
          <span style={{ color:"#4b5563", fontSize:"0.6rem" }}>{r.total} АЗС</span>
        </div>
      </div>
      <div style={{ display:"flex", gap:3, flexShrink:0 }}>
        {Array.from({ length: Math.min(sorted.length, 8) }).map((_,i) => (
          <div key={i} style={{ width:5, height:5, borderRadius:"50%", background: i === (idx % Math.min(sorted.length,8)) ? VIOLET : "rgba(34,34,60,0.8)", transition:"background .3s" }} />
        ))}
      </div>
    </div>
  );
}

/* ─── Main export ─────────────────────────────────────────────── */
export function AnalyticsTab() {
  const [period, setPeriod] = useState("24ч");
  const [sortBy, setSortBy] = useState<"pct"|"name">("pct");
  const PERIODS = ["1ч","6ч","24ч","7д"];

  const sorted = useMemo(() =>
    [...REGIONS].sort((a,b) => sortBy === "pct" ? a.pct - b.pct : a.name.localeCompare(b.name))
  , [sortBy]);

  // Donut data
  const totalGreen  = REGIONS.reduce((a,r) => a+r.green, 0);
  const totalYellow = REGIONS.reduce((a,r) => a+r.yellow, 0);
  const totalRed    = REGIONS.reduce((a,r) => a+r.red, 0);
  const donutData = [
    { value: totalGreen,  color: AVAIL.green  },
    { value: totalYellow, color: AVAIL.yellow },
    { value: totalRed,    color: AVAIL.red    },
  ];
  const normPct = Math.round((totalGreen / (totalGreen + totalYellow + totalRed)) * 100);

  return (
    <div style={{
      width: 390, height: 844,
      position: "relative", overflow: "hidden",
      fontFamily: "'Inter',system-ui,sans-serif",
      color: "#fff",
      background: BG,
    }}>
      <style>{CSS}</style>

      {/* ── Starfield ── */}
      <div style={{ position:"absolute", inset:0, zIndex:0, pointerEvents:"none" }}>
        <Stars n={100} />
        {/* Grid lines */}
        <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%", opacity:.13 }}>
          <line x1="0" y1="33%" x2="100%" y2="33%" stroke="#818cf8" strokeWidth=".8"/>
          <line x1="0" y1="66%" x2="100%" y2="66%" stroke="#818cf8" strokeWidth=".8"/>
          <line x1="33%" y1="0" x2="33%" y2="100%" stroke="#818cf8" strokeWidth=".8"/>
          <line x1="66%" y1="0" x2="66%" y2="100%" stroke="#818cf8" strokeWidth=".8"/>
        </svg>
        {/* Ambient glow blooms */}
        <div style={{ position:"absolute", top:-60, left:"50%", transform:"translateX(-50%)", width:320, height:200, borderRadius:"50%", background:`radial-gradient(ellipse, ${VIOLET}28 0%, transparent 70%)`, filter:"blur(20px)" }} />
        <div style={{ position:"absolute", bottom:60, right:-40, width:200, height:200, borderRadius:"50%", background:`radial-gradient(ellipse, ${MAGENTA}1a 0%, transparent 70%)`, filter:"blur(24px)" }} />
      </div>

      {/* ── Scrollable content ── */}
      <div style={{ position:"absolute", inset:0, zIndex:2, overflowY:"auto", overflowX:"hidden" }}>

        {/* ── HEADER ── */}
        <div style={{ padding:"3rem 1rem 0.6rem", position:"sticky", top:0, zIndex:10, background:"rgba(4,5,68,0.88)", backdropFilter:"blur(20px)", borderBottom:"1px solid rgba(120,140,255,0.1)" }}>
          <Strip color={VIOLET} style={{ bottom:0, left:0, right:0 }} />
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"0.42rem", letterSpacing:"0.18em", color:"#4b5563", marginBottom:2 }}>МАТРИЦА_СНАБЖЕНИЯ · АНАЛИТИКА</div>
              <h1 style={{ margin:0, fontSize:"1.25rem", fontWeight:900, background:`linear-gradient(90deg, #fff 0%, ${VIOLET} 60%, ${MAGENTA} 100%)`, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
                Аналитика
              </h1>
            </div>
            <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:3 }}>
              <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:AVAIL.green, boxShadow:`0 0 8px ${AVAIL.green}`, animation:"scanPulse 1.5s infinite" }} />
                <span style={{ fontSize:"0.6rem", color:AVAIL.green, fontFamily:"'JetBrains Mono',monospace", fontWeight:700 }}>LIVE</span>
              </div>
              <span style={{ fontSize:"0.52rem", color:"#374151", fontFamily:"'JetBrains Mono',monospace" }}>обновлено 3м назад</span>
            </div>
          </div>
        </div>

        {/* ── CRISIS BANNER ── */}
        {crisisCount > 0 && (
          <div style={{ padding:"0.6rem 1rem 0" }}>
            <div style={{ background:"linear-gradient(135deg,rgba(30,5,5,0.9),rgba(24,4,8,0.9))", border:`1px solid ${AVAIL.red}44`, borderRadius:14, padding:"0.65rem 0.9rem", display:"flex", alignItems:"center", gap:"0.65rem", position:"relative", overflow:"hidden", boxShadow:`0 0 24px ${AVAIL.red}18` }}>
              <Strip color={AVAIL.red} style={{ top:0, left:0, right:0 }} />
              <div style={{ position:"absolute", inset:0, pointerEvents:"none", opacity:0.025, background:"repeating-linear-gradient(0deg,transparent,transparent 3px,#ef4444 3px,#ef4444 4px)" }} />
              <div style={{ width:10, height:10, borderRadius:"50%", flexShrink:0, background:AVAIL.red, boxShadow:`0 0 14px ${AVAIL.red}`, animation:"scanPulse 1s infinite" }} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ color:AVAIL.red, fontWeight:800, fontSize:"0.7rem", letterSpacing:"0.1em", fontFamily:"'JetBrains Mono',monospace" }}>КРИЗИС_ДЕФИЦИТА</div>
                <div style={{ color:"#9ca3af", fontSize:"0.65rem", marginTop:2 }}>
                  {crisisCount} {crisisCount < 5 ? "региона" : "регионов"} ниже 25% · требуется реакция
                </div>
              </div>
              <button style={{ background:`${AVAIL.red}22`, border:`1px solid ${AVAIL.red}44`, borderRadius:8, color:AVAIL.red, fontSize:"0.65rem", fontWeight:700, padding:"0.3rem 0.55rem", cursor:"pointer", flexShrink:0 }}>
                ⚡ Купить
              </button>
            </div>
          </div>
        )}

        {/* ── STAT CARDS ── */}
        <div style={{ display:"flex", gap:"0.5rem", padding:"0.75rem 1rem 0" }}>
          <StatCard label="Всего АЗС"    value={totalAZS}   icon="⛽" color={VIOLET}       />
          <StatCard label="Ср. наличие"  value={avgPct} unit="%" icon="📊" color={AVAIL.green}  />
          <StatCard label="Кризис зон"   value={crisisCount} icon="⚠️" color={AVAIL.red}    />
        </div>

        {/* ── REGION MONITOR + DONUT ── */}
        <div style={{ display:"flex", gap:"0.5rem", padding:"0.65rem 1rem 0", alignItems:"center" }}>
          <div style={{ flex:1, minWidth:0 }}>
            <RegionMonitor />
          </div>
          {/* Donut */}
          <div style={{ position:"relative", flexShrink:0, width:84, height:84 }}>
            <PieChart width={84} height={84}>
              <Pie data={donutData} cx={38} cy={38} innerRadius={22} outerRadius={38} paddingAngle={2} dataKey="value" startAngle={90} endAngle={-270}>
                {donutData.map((d,i) => <Cell key={i} fill={d.color} stroke="transparent" />)}
              </Pie>
            </PieChart>
            <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", textAlign:"center", pointerEvents:"none" }}>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"0.88rem", fontWeight:800, color:AVAIL.green, lineHeight:1 }}>{normPct}%</div>
              <div style={{ fontSize:"0.42rem", color:"#374151", textTransform:"uppercase", letterSpacing:"0.05em" }}>норма</div>
            </div>
          </div>
        </div>

        {/* ── PERIOD SELECTOR + TREND CHART ── */}
        <div style={{ padding:"0.75rem 1rem 0" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"0.5rem" }}>
            <div>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"0.42rem", color:"#374151", letterSpacing:"0.12em", marginBottom:2 }}>ДИНАМИКА_НАЛИЧИЯ</div>
              <div style={{ color:"#9ca3af", fontSize:"0.72rem", textTransform:"uppercase", letterSpacing:"0.06em" }}>Тренд наличия</div>
            </div>
            <div style={{ display:"flex", gap:4 }}>
              {PERIODS.map(p => (
                <button key={p} onClick={() => setPeriod(p)} style={{
                  background: period === p ? `linear-gradient(135deg,${VIOLET},${MAGENTA})` : "rgba(14,14,40,0.6)",
                  border: period === p ? "none" : "1px solid rgba(100,110,200,0.2)",
                  color: period === p ? "#fff" : "#6b7280",
                  borderRadius: 8, padding:"0.25rem 0.55rem", fontSize:"0.68rem",
                  fontWeight: period === p ? 700 : 400, cursor:"pointer", transition:"all .2s",
                }}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Area chart */}
          <div style={{ background:"rgba(6,8,80,0.45)", border:"1px solid rgba(100,120,255,0.15)", borderRadius:14, padding:"0.75rem 0.25rem 0.5rem", position:"relative", overflow:"hidden" }}>
            <Strip color={VIOLET} style={{ top:0, left:0, right:0 }} />
            <ResponsiveContainer width="100%" height={130}>
              <AreaChart data={TREND} margin={{ top:4, right:8, bottom:0, left:-22 }}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={VIOLET} stopOpacity={0.6} />
                    <stop offset="95%" stopColor={VIOLET} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 6" stroke="rgba(100,120,255,0.1)" />
                <XAxis dataKey="t" tick={{ fill:"#374151", fontSize:9, fontFamily:"'JetBrains Mono',monospace" }} interval={5} />
                <YAxis tick={{ fill:"#374151", fontSize:9 }} domain={[0,100]} />
                <Tooltip
                  contentStyle={{ background:"rgba(6,8,90,0.95)", border:`1px solid ${VIOLET}44`, borderRadius:8, color:"#e2e8f0", fontSize:11 }}
                  formatter={(v: number) => [`${v}%`, "Наличие"]}
                />
                <Area type="monotone" dataKey="pct" stroke={VIOLET} strokeWidth={2} fill="url(#areaGrad)" dot={false} />
                {/* crisis threshold */}
                <line x1="0%" x2="100%" y1="25%" y2="25%" stroke={AVAIL.red} strokeDasharray="4 6" strokeOpacity={0.4} />
              </AreaChart>
            </ResponsiveContainer>
            <div style={{ display:"flex", gap:"0.75rem", padding:"0.3rem 0.75rem 0" }}>
              {[["#",AVAIL.green,"Норма ≥60%"],["#",AVAIL.yellow,"Мало 25–60%"],["#",AVAIL.red,"Нет <25%"]].map(([_,c,l]) => (
                <span key={l} style={{ display:"flex", alignItems:"center", gap:4, color:c as string, fontSize:"0.53rem", fontFamily:"'JetBrains Mono',monospace" }}>
                  <span style={{ width:8, height:3, borderRadius:2, background:c as string, display:"inline-block" }} />
                  {l}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── PRICE MATRIX ── */}
        <div style={{ padding:"0.75rem 1rem 0" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"0.5rem" }}>
            <div>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"0.42rem", color:"#374151", letterSpacing:"0.12em", marginBottom:2 }}>МАТРИЦА_ЦЕН · КРИТИЧНЫЕ_ЗОНЫ</div>
              <div style={{ color:"#9ca3af", fontSize:"0.72rem", textTransform:"uppercase", letterSpacing:"0.06em" }}>Матрица цен</div>
            </div>
            <span style={{ background:`${AVAIL.red}15`, border:`1px solid ${AVAIL.red}30`, borderRadius:4, color:AVAIL.red, fontSize:"0.52rem", fontWeight:700, padding:"0.08rem 0.32rem", fontFamily:"'JetBrains Mono',monospace" }}>ТОП-6 крит.</span>
          </div>
          <div style={{ background:"rgba(6,8,80,0.5)", border:"1px solid rgba(100,120,255,0.15)", borderRadius:14, overflow:"hidden", boxShadow:"0 4px 24px rgba(0,0,0,0.3)", position:"relative" }}>
            <Strip color={MAGENTA} style={{ top:0, left:0, right:0 }} />
            {/* Header */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr repeat(3, 62px)", background:"rgba(4,5,50,0.8)", borderBottom:"1px solid rgba(80,90,200,0.18)" }}>
              {["регион","АИ-92","АИ-95","ДТ"].map((h,i) => (
                <div key={h} style={{ padding:"0.4rem 0.6rem", color:[VIOLET,VIOLET,MAGENTA,"#f59e0b"][i], fontSize:"0.58rem", fontWeight:700, textAlign: i>0 ? "center" : "left", fontFamily:"'JetBrains Mono',monospace", letterSpacing:"0.04em" }}>{h}</div>
              ))}
            </div>
            {PRICE_REGIONS.map((r, ri) => {
              const isCrit = r.pct < 25;
              const isLow  = r.pct < 50;
              return (
                <div key={r.name} style={{ display:"grid", gridTemplateColumns:"1fr repeat(3, 62px)", borderBottom: ri < PRICE_REGIONS.length-1 ? "1px solid rgba(40,50,120,0.3)" : "none", background: isCrit ? `linear-gradient(90deg,${AVAIL.red}0a,transparent)` : "transparent", borderLeft: isCrit ? `2px solid ${AVAIL.red}66` : isLow ? `2px solid ${AVAIL.yellow}44` : "2px solid transparent" }}>
                  <div style={{ padding:"0.45rem 0.6rem", overflow:"hidden" }}>
                    <div style={{ color: isCrit ? "#fca5a5" : "#d1d5db", fontSize:"0.65rem", fontWeight: isCrit ? 700 : 500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.name}</div>
                    <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:2 }}>
                      <div style={{ width:5, height:5, borderRadius:"50%", background: isCrit ? AVAIL.red : isLow ? AVAIL.yellow : AVAIL.green, flexShrink:0 }} />
                      <span style={{ color:"#4b5563", fontSize:"0.55rem", fontFamily:"'JetBrains Mono',monospace" }}>{r.pct}%</span>
                    </div>
                  </div>
                  {[r.ai92, r.ai95, r.dt].map((p,fi) => (
                    <div key={fi} style={{ padding:"0.45rem 0.4rem", textAlign:"center", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:1 }}>
                      <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"0.8rem", fontWeight:700, color: isCrit ? AVAIL.red : AVAIL.green, textShadow: isCrit ? `0 0 8px ${AVAIL.red}55` : "none" }}>{p}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── REGIONAL SUPPLY BARS ── */}
        <div style={{ padding:"0.75rem 1rem 0" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"0.5rem" }}>
            <div>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"0.42rem", color:"#374151", letterSpacing:"0.12em", marginBottom:2 }}>РЕГИОНАЛЬНОЕ_НАЛИЧИЕ</div>
              <div style={{ color:"#9ca3af", fontSize:"0.72rem", textTransform:"uppercase", letterSpacing:"0.06em" }}>По регионам</div>
            </div>
            <div style={{ display:"flex", gap:4 }}>
              {(["pct","name"] as const).map(s => (
                <button key={s} onClick={() => setSortBy(s)} style={{ background: sortBy===s ? `linear-gradient(135deg,${VIOLET},${MAGENTA})` : "rgba(14,14,40,0.6)", border: sortBy===s ? "none" : "1px solid rgba(100,110,200,0.2)", color: sortBy===s ? "#fff" : "#6b7280", borderRadius:8, padding:"0.22rem 0.5rem", fontSize:"0.63rem", fontWeight: sortBy===s ? 700 : 400, cursor:"pointer", transition:"all .2s" }}>
                  {s === "pct" ? "Наличие" : "A–Я"}
                </button>
              ))}
            </div>
          </div>
          {sorted.map((r, i) => <RegionBar key={r.name} region={r} rank={i} />)}
        </div>

        {/* Bottom padding */}
        <div style={{ height: 80 }} />
      </div>

      {/* ── BOTTOM NAV ── */}
      <div style={{ position:"absolute", bottom:0, left:0, right:0, zIndex:20 }}>
        <Strip color={VIOLET} style={{ top:0, left:0, right:0 }} />
        <div style={{ background:"rgba(4,5,60,0.95)", backdropFilter:"blur(20px)", display:"flex", justifyContent:"space-around", padding:"0.55rem 0 0.9rem" }}>
          {[["🗺️","Карта"],["📊","Аналитика"],["⛽","Каталог"],["🔐","Хранилище"],["🎮","Резерв"]].map(([icon,label],i) => {
            const active = i === 1;
            return (
              <div key={label} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3, cursor:"pointer" }}>
                <span style={{ fontSize: active ? 20 : 18, filter: active ? `drop-shadow(0 0 6px ${VIOLET})` : "none" }}>{icon}</span>
                <span style={{ fontSize:"0.55rem", fontWeight: active ? 700 : 400, color: active ? VIOLET : "#4b5563", letterSpacing:"0.04em" }}>{label}</span>
                {active && <div style={{ width:18, height:2, borderRadius:2, background:`linear-gradient(90deg,${VIOLET},${MAGENTA})`, boxShadow:`0 0 6px ${VIOLET}` }} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default AnalyticsTab;
