import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, useMap, useMapEvents, Rectangle, Tooltip } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import type { GasStation } from "@/types";
import { STATUS_COLORS } from "@/types";
import { useStationStore } from "@/stores/useStationStore";
import { useMapStore } from "@/stores/useMapStore";
import { usePriceStore } from "@/stores/usePriceStore";
import { useFavoritesStore } from "@/stores/useFavoritesStore";
import { StationCard } from "@/components/StationCard";

// NOTE: Leaflet default marker icons are fixed globally in src/main.tsx via
// bundled asset imports.  No CDN URLs needed here — this file only uses
// L.divIcon() for custom station markers, so no further setup is required.

function createStationIcon(status: string, starred = false) {
  const color = STATUS_COLORS[status] ?? "#9ca3af";
  const pulse = status === "red" ? `<div style="position:absolute;inset:-4px;border-radius:50%;border:1.5px solid ${color};opacity:0.4;animation:mrkPulse 1.8s ease-in-out infinite;"></div>` : "";
  const starBadge = starred ? `<div style="position:absolute;top:-7px;right:-7px;font-size:9px;line-height:1;z-index:2;filter:drop-shadow(0 0 3px #f59e0b);">⭐</div>` : "";
  const size = starred ? 20 : 16;
  return L.divIcon({
    html: `<style>@keyframes mrkPulse{0%,100%{transform:scale(1);opacity:0.4}50%{transform:scale(1.55);opacity:0}}</style>
    <div style="position:relative;width:${size}px;height:${size}px;">
      ${pulse}
      ${starBadge}
      <div style="
        width:${size}px;height:${size}px;border-radius:50%;
        background:radial-gradient(circle at 35% 30%, ${color}ff, ${color}99);
        border:${starred ? "2px solid #f59e0b" : "1.5px solid rgba(255,255,255,0.35)"};
        box-shadow:0 0 12px ${color}99,0 0 4px ${color},${starred ? "0 0 8px #f59e0b66," : ""}0 2px 4px #00000066;
        position:relative;z-index:1;
      "></div>
    </div>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function dominantStatus(station: GasStation): string {
  if (!station.fuel_statuses.length) return "red";
  const avg =
    station.fuel_statuses.reduce((a, b) => a + b.availability_pct, 0) /
    station.fuel_statuses.length;
  return avg >= 60 ? "green" : avg >= 25 ? "yellow" : "red";
}

function MapViewportSync() {
  const { setViewport } = useMapStore();
  useMapEvents({
    moveend(e) {
      const c = e.target.getCenter();
      setViewport({ lat: c.lat, lng: c.lng, zoom: e.target.getZoom() });
    },
  });
  return null;
}

function MapRecenter({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
  const map = useMap();
  const didSet = useRef(false);
  useEffect(() => {
    if (!didSet.current) {
      map.setView([lat, lng], zoom, { animate: false });
      didSet.current = true;
    }
  }, [map, lat, lng, zoom]);
  return null;
}

const FUEL_OPTIONS = ["АИ-92", "АИ-95", "АИ-95+", "АИ-100", "ДТ", "ДТ+", "Газ"];
const POPUP_FUELS = ["АИ-92", "АИ-95", "ДТ"];

// Region bounding boxes from seed_regions.py — used for the heatmap overlay
const REGION_BOUNDS: { name: string; latMin: number; latMax: number; lngMin: number; lngMax: number }[] = [
  { name: "АР Крым и г. Севастополь",   latMin: 44.38, latMax: 45.50, lngMin: 33.40, lngMax: 36.00 },
  { name: "Донецкая область",            latMin: 47.50, latMax: 48.60, lngMin: 37.00, lngMax: 38.90 },
  { name: "Луганская область",           latMin: 48.00, latMax: 49.10, lngMin: 38.50, lngMax: 39.80 },
  { name: "Запорожская область",         latMin: 47.00, latMax: 48.10, lngMin: 34.70, lngMax: 36.40 },
  { name: "Херсонская область",          latMin: 46.10, latMax: 47.10, lngMin: 32.30, lngMax: 34.20 },
  { name: "Белгородская область",        latMin: 50.30, latMax: 51.10, lngMin: 35.80, lngMax: 37.80 },
  { name: "Курская область",             latMin: 51.30, latMax: 52.20, lngMin: 35.40, lngMax: 37.20 },
  { name: "Воронежская область",         latMin: 50.50, latMax: 52.00, lngMin: 38.50, lngMax: 40.50 },
  { name: "Брянская область",            latMin: 52.30, latMax: 53.20, lngMin: 32.80, lngMax: 34.80 },
  { name: "Орловская область",           latMin: 52.40, latMax: 53.30, lngMin: 35.50, lngMax: 37.00 },
  { name: "Новгородская область",        latMin: 57.60, latMax: 59.00, lngMin: 30.80, lngMax: 33.00 },
  { name: "Псковская область",           latMin: 56.80, latMax: 58.40, lngMin: 27.80, lngMax: 30.20 },
  { name: "г. Москва и Новая Москва",   latMin: 55.55, latMax: 55.92, lngMin: 37.15, lngMax: 37.90 },
  { name: "Московская область",          latMin: 55.00, latMax: 56.50, lngMin: 36.00, lngMax: 40.00 },
  { name: "г. Санкт-Петербург",         latMin: 59.82, latMax: 60.08, lngMin: 30.05, lngMax: 30.55 },
  { name: "Ленинградская область",       latMin: 59.00, latMax: 61.00, lngMin: 28.50, lngMax: 32.50 },
  { name: "Краснодарский край",          latMin: 44.80, latMax: 45.50, lngMin: 38.00, lngMax: 41.00 },
  { name: "Ростовская область",          latMin: 47.00, latMax: 48.50, lngMin: 39.00, lngMax: 41.50 },
  { name: "Ставропольский край",         latMin: 44.00, latMax: 45.50, lngMin: 41.00, lngMax: 44.00 },
  { name: "Нижегородская область",       latMin: 55.50, latMax: 57.00, lngMin: 43.00, lngMax: 45.50 },
  { name: "Республика Татарстан",        latMin: 54.50, latMax: 56.50, lngMin: 48.50, lngMax: 52.00 },
  { name: "Самарская область",           latMin: 52.50, latMax: 54.50, lngMin: 49.50, lngMax: 52.50 },
  { name: "Республика Башкортостан",     latMin: 53.50, latMax: 56.00, lngMin: 54.00, lngMax: 59.00 },
  { name: "Тульская область",            latMin: 53.50, latMax: 54.50, lngMin: 36.80, lngMax: 38.50 },
  { name: "Волгоградская область",       latMin: 48.00, latMax: 50.50, lngMin: 43.00, lngMax: 45.50 },
  { name: "Астраханская область",        latMin: 45.50, latMax: 47.50, lngMin: 46.00, lngMax: 48.50 },
  { name: "Пермский край",               latMin: 57.50, latMax: 59.50, lngMin: 55.50, lngMax: 58.50 },
  { name: "Саратовская область",         latMin: 50.50, latMax: 52.50, lngMin: 44.00, lngMax: 47.00 },
  { name: "Ярославская область",         latMin: 57.50, latMax: 58.50, lngMin: 38.50, lngMax: 40.50 },
  { name: "Тверская область",            latMin: 56.50, latMax: 58.00, lngMin: 33.00, lngMax: 36.00 },
];

function availabilityColor(pct: number): string {
  if (pct >= 60) return "#22c55e";
  if (pct >= 25) return "#eab308";
  return "#ef4444";
}

function PopupContent({ station }: { station: GasStation }) {
  const getPrice = usePriceStore((s) => s.getPrice);
  const avg = station.fuel_statuses.length
    ? Math.round(station.fuel_statuses.reduce((a, b) => a + b.availability_pct, 0) / station.fuel_statuses.length)
    : 0;
  const color = avg >= 60 ? "#22c55e" : avg >= 25 ? "#eab308" : "#ef4444";
  return (
    <div style={{
      background: "#0d0d18", color: "#e2e8f0",
      padding: "0.65rem 0.75rem", borderRadius: "10px",
      fontSize: "0.8rem", minWidth: "190px",
      border: `1px solid ${color}22`,
      boxShadow: `0 4px 16px #00000088`,
    }}>
      {/* Top accent */}
      <div style={{ height: "1px", background: `linear-gradient(90deg,transparent,${color},transparent)`, marginBottom: "0.45rem" }} />
      <strong style={{ display: "block", marginBottom: "0.15rem", color: "#f1f5f9", fontSize: "0.82rem" }}>{station.name}</strong>
      <span style={{ color: "#374151", fontSize: "0.65rem" }}>📍 {station.address.slice(0, 32)}</span>
      {/* Availability */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.4rem", marginBottom: "0.35rem" }}>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "1.1rem", fontWeight: 800, color, lineHeight: 1 }}>{avg}%</span>
        <span style={{ color: "#374151", fontSize: "0.6rem" }}>🚗 {station.queue_cars} авт.</span>
        {station.network && <span style={{ color: "#4b5563", fontSize: "0.58rem" }}>{station.network}</span>}
      </div>
      {/* Prices */}
      <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
        {POPUP_FUELS.map((ft) => {
          const p = getPrice(station.region, ft);
          if (!p) return null;
          const crisis = p.is_crisis;
          return (
            <span key={ft} style={{
              background: crisis ? "#ef444412" : "#a855f710",
              border: `1px solid ${crisis ? "#ef444430" : "#a855f728"}`,
              borderRadius: "5px",
              padding: "0.08rem 0.35rem",
              fontSize: "0.68rem",
            }}>
              <span style={{ color: "#4b5563" }}>{ft} </span>
              <span style={{ color: crisis ? "#ef4444" : "#a855f7", fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>
                {p.effective}₽{crisis && "▲"}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

interface MapTabProps {
  visible: boolean;
  /** Station to pre-select on first render (from deep-link startParam) */
  initialStationId?: number;
  navVisible?: boolean;
  onNavToggle?: () => void;
}

export function MapTab({ visible, initialStationId, navVisible = true, onNavToggle }: MapTabProps) {
  const { stations, fetch, loading } = useStationStore();
  const { viewport, filterStatus, filterFuel, filterRegion, filterNetwork, setFilter, selectedStationId, selectStation } =
    useMapStore();
  const [showFilters, setShowFilters] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const dragControls = useDragControls();

  function haversineDist(lat1: number, lng1: number, lat2: number, lng2: number) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  const findNearest = () => {
    if (!navigator.geolocation) { setGeoError("Геолокация не поддерживается"); return; }
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLoading(false);
        const { latitude, longitude } = pos.coords;
        const greenStations = stations.filter((s) => {
          const avg = s.fuel_statuses.length ? s.fuel_statuses.reduce((a, b) => a + b.availability_pct, 0) / s.fuel_statuses.length : 0;
          return avg >= 25;
        });
        const pool = greenStations.length ? greenStations : stations;
        if (!pool.length) return;
        const nearest = pool.reduce((best, s) => {
          const d = haversineDist(latitude, longitude, s.lat, s.lng);
          const bestD = haversineDist(latitude, longitude, best.lat, best.lng);
          return d < bestD ? s : best;
        });
        mapRef.current?.flyTo([nearest.lat, nearest.lng], 14, { duration: 1.2 });
        selectStation(nearest.id);
      },
      () => { setGeoLoading(false); setGeoError("Нет доступа к геолокации"); setTimeout(() => setGeoError(null), 4000); },
      { timeout: 8000, maximumAge: 30000 },
    );
  };

  const { isStationFavorite } = useFavoritesStore();

  // Per-region availability stats for heatmap
  const regionStats = REGION_BOUNDS.map((rb) => {
    const regionStations = stations.filter((s) => s.region === rb.name);
    if (!regionStations.length) return { ...rb, avgPct: null as number | null };
    const allPcts = regionStations.flatMap((s) => s.fuel_statuses.map((f) => f.availability_pct));
    const avgPct = allPcts.length ? allPcts.reduce((a, b) => a + b, 0) / allPcts.length : null;
    return { ...rb, avgPct };
  });

  useEffect(() => {
    fetch();
  }, [fetch]);

  // Honor deep-link pre-selection once stations are loaded
  useEffect(() => {
    if (initialStationId && stations.length > 0) {
      selectStation(initialStationId);
    }
  }, [initialStationId, stations.length, selectStation]);

  const filtered = stations.filter((s) => {
    const status = dominantStatus(s);
    if (filterStatus !== "all" && status !== filterStatus) return false;
    if (filterFuel) {
      if (!s.fuel_statuses.some((f) => f.fuel_type === filterFuel)) return false;
    }
    if (filterRegion && s.region !== filterRegion) return false;
    if (filterNetwork && s.network !== filterNetwork) return false;
    return true;
  });

  const uniqueRegions = Array.from(new Set(stations.map((s) => s.region))).sort();
  const uniqueNetworks = Array.from(new Set(stations.map((s) => s.network))).sort();

  const selectedStation = selectedStationId
    ? stations.find((s) => s.id === selectedStationId)
    : null;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        visibility: visible ? "visible" : "hidden",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      {/* Filter Bar */}
      <div
        style={{
          position: "absolute",
          top: "3rem",
          left: "0.75rem",
          right: "0.75rem",
          zIndex: 1000,
          display: "flex",
          gap: "0.5rem",
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={() => setShowFilters(!showFilters)}
          style={{
            background: (filterStatus !== "all" || filterFuel || filterNetwork || filterRegion)
              ? "rgba(168,85,247,0.15)"
              : "rgba(20,20,28,0.92)",
            border: `1px solid ${(filterStatus !== "all" || filterFuel || filterNetwork || filterRegion) ? "#a855f755" : "#22222f"}`,
            borderRadius: "10px",
            color: (filterStatus !== "all" || filterFuel || filterNetwork || filterRegion) ? "#c084fc" : "#e2e8f0",
            padding: "0.4rem 0.75rem",
            fontSize: "0.75rem",
            cursor: "pointer",
            backdropFilter: "blur(12px)",
            display: "flex",
            alignItems: "center",
            gap: "0.3rem",
            fontWeight: 600,
            boxShadow: (filterStatus !== "all" || filterFuel || filterNetwork || filterRegion)
              ? "0 0 10px rgba(168,85,247,0.25)"
              : "none",
            transition: "all 0.2s",
          }}
        >
          ⬡ Фильтры{" "}
          {(filterStatus !== "all" || filterFuel || filterNetwork || filterRegion) && (
            <span
              style={{
                background: "#a855f7",
                borderRadius: "50%",
                width: "6px",
                height: "6px",
                display: "inline-block",
                boxShadow: "0 0 6px #a855f7",
              }}
            />
          )}
        </button>

        {/* Geolocation nearest station */}
        <button
          onClick={findNearest}
          disabled={geoLoading}
          title="Ближайшая АЗС"
          style={{
            background: geoLoading ? "rgba(168,85,247,0.15)" : "rgba(20,20,28,0.92)",
            border: `1px solid ${geoError ? "#ef444455" : geoLoading ? "#a855f755" : "#22222f"}`,
            borderRadius: "10px",
            color: geoError ? "#ef4444" : geoLoading ? "#a855f7" : "#e2e8f0",
            padding: "0.4rem 0.6rem",
            fontSize: "0.78rem",
            cursor: geoLoading ? "default" : "pointer",
            backdropFilter: "blur(12px)",
            display: "flex", alignItems: "center", gap: "0.2rem",
            transition: "all 0.2s",
          }}
        >
          {geoLoading ? "⟳" : geoError ? "✗" : "📍"}
        </button>

        {/* Heatmap toggle */}
        <button
          onClick={() => setShowHeatmap((v) => !v)}
          style={{
            background: showHeatmap ? "rgba(168,85,247,0.18)" : "rgba(20,20,28,0.92)",
            border: `1px solid ${showHeatmap ? "#a855f755" : "#22222f"}`,
            borderRadius: "10px",
            color: showHeatmap ? "#a855f7" : "#9ca3af",
            padding: "0.4rem 0.6rem",
            fontSize: "0.78rem",
            cursor: "pointer",
            backdropFilter: "blur(12px)",
            display: "flex", alignItems: "center", gap: "0.25rem",
          }}
          title="Тепловая карта регионов"
        >
          🌡
        </button>

        {/* Quick status strip — tap to filter */}
        <div
          style={{
            background: "rgba(20,20,28,0.92)",
            border: "1px solid #22222f",
            borderRadius: "10px",
            backdropFilter: "blur(12px)",
            display: "flex",
            alignItems: "center",
            overflow: "hidden",
          }}
        >
          {loading ? (
            <span style={{ color: "#374151", fontSize: "0.7rem", padding: "0.4rem 0.75rem", fontFamily: "'JetBrains Mono',monospace" }}>···</span>
          ) : (
            <>
              {([
                { status: "green",  color: "#22c55e", dot: "●" },
                { status: "yellow", color: "#eab308", dot: "●" },
                { status: "red",    color: "#ef4444", dot: "●" },
              ] as const).map(({ status, color, dot }) => {
                const cnt = filtered.filter((s) => dominantStatus(s) === status).length;
                const isActive = filterStatus === status;
                return (
                  <button
                    key={status}
                    onClick={() => setFilter("filterStatus", isActive ? "all" : status)}
                    style={{
                      background: isActive ? `${color}18` : "transparent",
                      border: "none",
                      borderRight: "1px solid #22222f",
                      padding: "0.38rem 0.55rem",
                      cursor: "pointer",
                      display: "flex", alignItems: "center", gap: "0.22rem",
                      transition: "background 0.15s",
                    }}
                  >
                    <span style={{ color, fontSize: "0.55rem", lineHeight: 1 }}>{dot}</span>
                    <span style={{
                      fontFamily: "'JetBrains Mono',monospace",
                      fontSize: "0.68rem", fontWeight: isActive ? 800 : 500,
                      color: isActive ? color : "#6b7280",
                    }}>{cnt}</span>
                  </button>
                );
              })}
              <span style={{
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: "0.6rem", color: filtered.length < stations.length ? "#a855f7" : "#4b5563",
                padding: "0 0.5rem",
              }}>
                {filtered.length < stations.length ? `${filtered.length}/${stations.length}` : `${stations.length}`}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Filter panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{
              position: "absolute",
              top: "6.5rem",
              left: "0.75rem",
              right: "0.75rem",
              zIndex: 1000,
              background: "rgba(10,10,18,0.97)",
              border: "1px solid #a855f722",
              borderRadius: "16px",
              padding: "0.85rem",
              backdropFilter: "blur(24px)",
              boxShadow: "0 8px 32px #00000088, 0 0 0 1px #a855f710",
              overflow: "hidden",
            }}
          >
            {/* Top accent line */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg,transparent,#a855f7,transparent)" }} />

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.65rem" }}>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#4b5563", fontSize: "0.55rem", letterSpacing: "0.14em" }}>ФИЛЬТР_МАТРИЦА</span>
              <button
                onClick={() => setShowFilters(false)}
                style={{ background: "none", border: "none", color: "#374151", cursor: "pointer", fontSize: "0.7rem", padding: "0.1rem 0.3rem" }}
              >✕</button>
            </div>

            {/* Status */}
            <p style={{ color: "#374151", fontSize: "0.6rem", margin: "0 0 0.35rem", textTransform: "uppercase", letterSpacing: "0.12em" }}>Статус АЗС</p>
            <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginBottom: "0.65rem" }}>
              {(["all", "green", "yellow", "red"] as const).map((s) => {
                const colors = { all: "#a855f7", green: "#22c55e", yellow: "#eab308", red: "#ef4444" };
                const labels = { all: "Все", green: "✓ Норма", yellow: "⚠ Мало", red: "✕ Нет" };
                const active = filterStatus === s;
                const c = colors[s];
                return (
                  <button key={s} onClick={() => setFilter("filterStatus", s)} style={{
                    background: active ? `${c}22` : "#0b0b10",
                    border: `1px solid ${active ? c : "#1e1e2a"}`,
                    borderRadius: "8px",
                    color: active ? c : "#4b5563",
                    padding: "0.28rem 0.6rem",
                    fontSize: "0.72rem",
                    fontWeight: active ? 700 : 400,
                    cursor: "pointer",
                    boxShadow: active ? `0 0 8px ${c}30` : "none",
                    transition: "all 0.15s",
                  }}>
                    {labels[s]}
                  </button>
                );
              })}
            </div>

            {/* Fuel */}
            <p style={{ color: "#374151", fontSize: "0.6rem", margin: "0 0 0.35rem", textTransform: "uppercase", letterSpacing: "0.12em" }}>Тип топлива</p>
            <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap", marginBottom: "0.65rem" }}>
              {[null, ...FUEL_OPTIONS].map((f) => {
                const active = f === null ? filterFuel === null : filterFuel === f;
                return (
                  <button key={f ?? "__all"} onClick={() => setFilter("filterFuel", f)} style={{
                    background: active ? "#a855f720" : "#0b0b10",
                    border: `1px solid ${active ? "#a855f7" : "#1e1e2a"}`,
                    borderRadius: "7px",
                    color: active ? "#a855f7" : "#4b5563",
                    padding: "0.25rem 0.55rem",
                    fontSize: "0.7rem",
                    fontWeight: active ? 700 : 400,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}>
                    {f ?? "Все"}
                  </button>
                );
              })}
            </div>

            {/* Region + Network in a row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <div>
                <p style={{ color: "#374151", fontSize: "0.6rem", margin: "0 0 0.3rem", textTransform: "uppercase", letterSpacing: "0.12em" }}>Регион</p>
                <select
                  value={filterRegion ?? ""}
                  onChange={(e) => setFilter("filterRegion", e.target.value || null)}
                  style={{ width: "100%", background: "#0b0b10", border: `1px solid ${filterRegion ? "#a855f744" : "#1e1e2a"}`, borderRadius: "8px", color: filterRegion ? "#e2e8f0" : "#4b5563", padding: "0.3rem 0.5rem", fontSize: "0.7rem", outline: "none", cursor: "pointer" }}
                >
                  <option value="">Все</option>
                  {uniqueRegions.map((r) => <option key={r} value={r}>{r.split(" ").slice(-2).join(" ").slice(0, 20)}</option>)}
                </select>
              </div>
              <div>
                <p style={{ color: "#374151", fontSize: "0.6rem", margin: "0 0 0.3rem", textTransform: "uppercase", letterSpacing: "0.12em" }}>Сеть</p>
                <select
                  value={filterNetwork ?? ""}
                  onChange={(e) => setFilter("filterNetwork", e.target.value || null)}
                  style={{ width: "100%", background: "#0b0b10", border: `1px solid ${filterNetwork ? "#a855f744" : "#1e1e2a"}`, borderRadius: "8px", color: filterNetwork ? "#e2e8f0" : "#4b5563", padding: "0.3rem 0.5rem", fontSize: "0.7rem", outline: "none", cursor: "pointer" }}
                >
                  <option value="">Все</option>
                  {uniqueNetworks.map((n) => <option key={n} value={n}>{n.slice(0, 20)}</option>)}
                </select>
              </div>
            </div>

            {(filterStatus !== "all" || filterFuel || filterRegion || filterNetwork) && (
              <button
                onClick={() => {
                  setFilter("filterStatus", "all");
                  setFilter("filterFuel", null);
                  setFilter("filterRegion", null);
                  setFilter("filterNetwork", null);
                }}
                style={{
                  width: "100%",
                  background: "#ef444412",
                  border: "1px solid #ef444430",
                  borderRadius: "8px",
                  color: "#ef4444",
                  padding: "0.3rem",
                  fontSize: "0.7rem",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                ✕ Сбросить все фильтры
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Map legend — bottom-left */}
      <div style={{
        position: "absolute",
        bottom: navVisible ? "calc(env(safe-area-inset-bottom, 0px) + 5.5rem)" : "calc(env(safe-area-inset-bottom, 0px) + 1rem)",
        left: "0.75rem",
        zIndex: 1000,
        background: "rgba(8,8,20,0.88)",
        border: "1px solid #1e1e2a",
        borderRadius: "10px",
        padding: "0.35rem 0.55rem",
        backdropFilter: "blur(12px)",
        display: "flex", flexDirection: "column", gap: "4px",
        transition: "bottom 0.3s",
      }}>
        {([["#22c55e","≥60%"],["#eab308","25–60%"],["#ef4444","<25%"]] as [string,string][]).map(([c,l]) => (
          <div key={c} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: c, boxShadow: `0 0 5px ${c}88`, flexShrink: 0 }} />
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.42rem", color: "#6b7280" }}>{l}</span>
          </div>
        ))}
      </div>

      {/* Nav toggle button — bottom-right corner of map */}
      {onNavToggle && (
        <button
          onClick={onNavToggle}
          style={{
            position: "absolute",
            bottom: navVisible ? "calc(env(safe-area-inset-bottom, 0px) + 5.25rem)" : "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)",
            right: "0.75rem",
            zIndex: 1000,
            background: "rgba(20,20,28,0.92)",
            border: "1px solid #22222f",
            borderRadius: "10px",
            color: "#e2e8f0",
            padding: "0.4rem 0.6rem",
            fontSize: "0.9rem",
            cursor: "pointer",
            backdropFilter: "blur(12px)",
            transition: "bottom 0.3s",
            lineHeight: 1,
          }}
          title={navVisible ? "Скрыть навигацию" : "Показать навигацию"}
        >
          {navVisible ? "⬇" : "⬆"}
        </button>
      )}

      {/* Leaflet Map */}
      <MapContainer
        center={[viewport.lat, viewport.lng]}
        zoom={viewport.zoom}
        style={{ width: "100%", height: "100%", background: "#050507" }}
        zoomControl={false}
        attributionControl={false}
        ref={(m) => { if (m) mapRef.current = m; }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution=""
          subdomains="abcd"
          maxZoom={19}
        />
        <MapViewportSync />
        <MapRecenter lat={viewport.lat} lng={viewport.lng} zoom={viewport.zoom} />

        {/* Region heatmap overlay */}
        {showHeatmap && regionStats.map((r) => {
          if (r.avgPct === null) return null;
          const color = availabilityColor(r.avgPct);
          return (
            <Rectangle
              key={r.name}
              bounds={[[r.latMin, r.lngMin], [r.latMax, r.lngMax]]}
              pathOptions={{
                color,
                weight: 1,
                opacity: 0.5,
                fillColor: color,
                fillOpacity: r.avgPct < 25 ? 0.22 : 0.12,
              }}
            >
              <Tooltip sticky direction="center" opacity={0.92}>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#e2e8f0", background: "transparent" }}>
                  {r.name}
                  <br />
                  <span style={{ color, fontFamily: "monospace" }}>{Math.round(r.avgPct)}%</span>
                  <span style={{ color: "#9ca3af", fontWeight: 400 }}> наличие</span>
                </div>
              </Tooltip>
            </Rectangle>
          );
        })}

        <MarkerClusterGroup
          chunkedLoading
          maxClusterRadius={50}
          showCoverageOnHover={false}
          iconCreateFunction={(cluster: { getChildCount: () => number }) => {
            const count = cluster.getChildCount();
            return L.divIcon({
              html: `<div style="
                background:linear-gradient(135deg,#a855f7,#db2777);
                border-radius:50%;
                width:34px;height:34px;
                display:flex;align-items:center;justify-content:center;
                color:#fff;font-weight:700;font-size:0.75rem;
                box-shadow:0 0 12px #a855f799;
                border:2px solid rgba(255,255,255,0.2);
              ">${count}</div>`,
              className: "",
              iconSize: [34, 34],
              iconAnchor: [17, 17],
            });
          }}
        >
          {filtered.map((station) => (
            <Marker
              key={station.id}
              position={[station.lat, station.lng]}
              icon={createStationIcon(dominantStatus(station), isStationFavorite(station.id))}
              eventHandlers={{ click: () => selectStation(station.id) }}
            >
              <Popup
                closeButton={false}
                className="tma-popup"
                maxWidth={280}
              >
                <PopupContent station={station} />
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>

      {/* Station detail panel */}
      <AnimatePresence>
        {selectedStation && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 80 || info.velocity.y > 500) selectStation(null);
            }}
            style={{
              position: "absolute",
              bottom: "0",
              left: 0,
              right: 0,
              zIndex: 1001,
              borderRadius: "64px 64px 0 0",
              background: "linear-gradient(90deg, #a855f7, #db2777)",
              padding: "2px 2px 0",
              boxShadow: "0 -12px 50px rgba(168,85,247,0.2), 0 -4px 24px rgba(0,0,0,0.8)",
            }}
          >
            <div style={{
              background: "rgba(8,8,20,0.97)",
              borderRadius: "62px 62px 0 0",
              maxHeight: "70vh",
              overflowY: "auto",
              backdropFilter: "blur(24px)",
              position: "relative",
            }}>
              {/* Drag handle */}
              <div
                onPointerDown={(e) => dragControls.start(e)}
                style={{ display: "flex", justifyContent: "center", paddingTop: "14px", paddingBottom: "2px", flexShrink: 0, cursor: "grab", touchAction: "none" }}
              >
                <div style={{ width: "64px", height: "4px", background: "rgba(255,255,255,0.18)", borderRadius: "99px" }} />
              </div>

              {/* Inner top glow */}
              <div aria-hidden style={{
                position: "absolute", top: 0, left: 0, right: 0, height: "128px",
                background: "linear-gradient(to bottom, rgba(168,85,247,0.08), transparent)",
                borderRadius: "62px 62px 0 0",
                pointerEvents: "none", zIndex: 0,
              }} />

              <div style={{ position: "relative", zIndex: 1, paddingBottom: "88px" }}>
                <StationCard
                  station={selectedStation}
                  onClose={() => selectStation(null)}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
