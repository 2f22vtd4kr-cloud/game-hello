import { useEffect, useRef, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { impact } from "@/lib/haptic";
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

// Mercedes ambient light CSS — injected once into the DOM
const AMBIENT_CSS = `
@keyframes ambientFlow {
  0%   { background-position: 0% 50%; }
  100% { background-position: 200% 50%; }
}
@keyframes ambientPulse {
  0%,100% { opacity:.55; }
  50%     { opacity:1; }
}
.ambient-strip {
  background-size: 200% 100%;
  animation: ambientFlow 3s linear infinite, ambientPulse 2.6s ease-in-out infinite;
}
`;

// Brand accent colors for map markers — vivid per-network palette
const BRAND_ACCENT: Record<string, string> = {
  "лукойл": "#DC143C", "роснефть": "#1565C0", "газпромнефть": "#1976D2",
  "газпром": "#0288D1", "татнефть": "#00695C", "сургутнефтегаз": "#6A1B9A",
  "опти": "#00838F", "тебойл": "#01579B", "teboil": "#01579B",
  "башнефть": "#558B2F", "таиф-нк": "#BF360C", "кнп": "#4527A0",
  "птк": "#01579B", "ртк": "#880E4F", "топлайн": "#4A148C",
  "грифон": "#E65100", "атан": "#6A1B9A", "тэс": "#AD1457",
};

function getBrandAccent(network = ""): string | null {
  const n = network.toLowerCase();
  for (const [key, color] of Object.entries(BRAND_ACCENT)) {
    if (n.includes(key)) return color;
  }
  return null;
}

function createStationIcon(status: string, starred = false, network = "", queue = 0) {
  // Availability color — vivid palette
  const avColor = status === "green" ? "#00E676" : status === "yellow" ? "#FFD600" : "#FF1744";
  const brandColor = getBrandAccent(network);
  const size = starred ? 22 : 16;
  const outerSize = size + 8;

  // Pulse ring — availability color, slower for green, faster for red
  const pulseDur = status === "green" ? "2.4s" : status === "yellow" ? "1.7s" : "1.1s";
  const pulseStyle = `position:absolute;top:50%;left:50%;width:${outerSize}px;height:${outerSize}px;border-radius:50%;background:${avColor};transform:translate(-50%,-50%);animation:mrkPulse ${pulseDur} ease-out infinite;`;

  // Outer brand ring — network color, larger radius
  const outerRing = brandColor
    ? `<div style="position:absolute;top:50%;left:50%;width:${outerSize + 8}px;height:${outerSize + 8}px;border-radius:50%;border:1.5px solid ${brandColor}bb;transform:translate(-50%,-50%);pointer-events:none;box-shadow:0 0 10px ${brandColor}55,inset 0 0 4px ${brandColor}22;"></div>`
    : "";

  const starBadge = starred ? `<div style="position:absolute;top:-8px;right:-8px;font-size:9px;line-height:1;z-index:3;filter:drop-shadow(0 0 3px #f59e0b);">⭐</div>` : "";
  const queueBadge = queue >= 4
    ? `<div style="position:absolute;top:-8px;left:-8px;font-size:7px;font-weight:700;z-index:3;background:#FF1744;color:#fff;border-radius:50%;width:13px;height:13px;display:flex;align-items:center;justify-content:center;border:1px solid #0d0d18;">${queue}</div>`
    : queue >= 2
    ? `<div style="position:absolute;top:-8px;left:-8px;font-size:7px;font-weight:700;z-index:3;background:#FFD600;color:#000;border-radius:50%;width:13px;height:13px;display:flex;align-items:center;justify-content:center;border:1px solid #0d0d18;">${queue}</div>`
    : "";

  return L.divIcon({
    html: `<style>@keyframes mrkPulse{0%,100%{transform:translate(-50%,-50%) scale(1);opacity:.5}50%{transform:translate(-50%,-50%) scale(2.2);opacity:0}}</style>
    <div style="position:relative;width:${size}px;height:${size}px;">
      <div style="${pulseStyle}"></div>
      ${outerRing}
      ${starBadge}
      ${queueBadge}
      <div style="
        width:${size}px;height:${size}px;border-radius:50%;
        background:radial-gradient(circle at 35% 30%, #ffffff44, ${avColor});
        border:${starred ? `2px solid #f59e0b` : brandColor ? `1.5px solid ${brandColor}cc` : `1.5px solid rgba(255,255,255,0.4)`};
        box-shadow:0 0 14px ${avColor}cc,0 0 6px ${avColor},${starred ? "0 0 10px #f59e0b66," : ""}${brandColor ? `0 0 8px ${brandColor}55,` : ""}0 2px 6px #00000077;
        position:relative;z-index:2;
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
  if (pct >= 60) return "#00E676";
  if (pct >= 25) return "#FFD600";
  return "#FF1744";
}

// Mercedes ambient light strip — flowing glow line that shifts with brand color
function AmbientStrip({ color, axis = "h", thickness = 1.5, style = {} }: {
  color: string; axis?: "h" | "v"; thickness?: number; style?: React.CSSProperties;
}) {
  const grad = `linear-gradient(90deg, transparent 0%, ${color}00 5%, ${color}cc 30%, ${color} 50%, ${color}cc 70%, ${color}00 95%, transparent 100%)`;
  return (
    <div className="ambient-strip" style={{
      position: "absolute",
      background: grad,
      height: axis === "h" ? thickness : "100%",
      width:  axis === "v" ? thickness : "100%",
      pointerEvents: "none",
      ...style,
    }} />
  );
}

function PopupContent({ station }: { station: GasStation }) {
  const getPrice = usePriceStore((s) => s.getPrice);
  const avg = station.fuel_statuses.length
    ? Math.round(station.fuel_statuses.reduce((a, b) => a + b.availability_pct, 0) / station.fuel_statuses.length)
    : 0;
  const color = avg >= 60 ? "#00E676" : avg >= 25 ? "#FFD600" : "#FF1744";
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
      {/* Network badge + availability */}
      {station.network && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", marginTop: "0.3rem", marginBottom: "0.25rem", background: `${getBrandAccent(station.network) ?? "#4b5563"}18`, border: `1px solid ${getBrandAccent(station.network) ?? "#4b5563"}44`, borderRadius: "6px", padding: "0.05rem 0.4rem" }}>
          <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: getBrandAccent(station.network) ?? "#4b5563", flexShrink: 0 }} />
          <span style={{ color: getBrandAccent(station.network) ?? "#6b7280", fontSize: "0.62rem", fontWeight: 600 }}>{station.network}</span>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem", marginBottom: "0.35rem" }}>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "1.1rem", fontWeight: 800, color, lineHeight: 1 }}>{avg}%</span>
        {(() => {
          const q = station.queue_cars;
          const qColor = q === 0 ? "#22c55e" : q <= 3 ? "#eab308" : "#ef4444";
          const waitMin = q <= 1 ? 0 : q <= 3 ? q * 4 : q * 5;
          return (
            <span style={{ color: qColor, fontSize: "0.6rem", fontFamily: "'JetBrains Mono',monospace", fontWeight: q > 3 ? 700 : 400 }}>
              🚗 {q}{waitMin > 0 ? ` ~${waitMin}мин` : " свободно"}
            </span>
          );
        })()}
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
  const { viewport, filterStatus, filterFuel, filterRegion, filterNetwork, filterZone, setFilter, selectedStationId, selectStation } =
    useMapStore();
  const [showFilters, setShowFilters] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [mapRecentSearches, setMapRecentSearches] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("tma-map-recent-searches") || "[]"); } catch { return []; }
  });
  const [mapSearchFocused, setMapSearchFocused] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const dragControls = useDragControls();

  function haversineDist(lat1: number, lng1: number, lat2: number, lng2: number) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  const findNearestGreenFromCenter = () => {
    const center = mapRef.current?.getCenter();
    if (!center) return;
    const greenStations = stations.filter((s) => {
      const avg = s.fuel_statuses.length
        ? s.fuel_statuses.reduce((a, b) => a + b.availability_pct, 0) / s.fuel_statuses.length
        : 0;
      return avg >= 60;
    });
    const pool = greenStations.length ? greenStations : stations.filter(s => {
      const avg = s.fuel_statuses.length
        ? s.fuel_statuses.reduce((a, b) => a + b.availability_pct, 0) / s.fuel_statuses.length
        : 0;
      return avg >= 25;
    });
    if (!pool.length) return;
    const nearest = pool.reduce((best, s) => {
      const d = haversineDist(center.lat, center.lng, s.lat, s.lng);
      const bestD = haversineDist(center.lat, center.lng, best.lat, best.lng);
      return d < bestD ? s : best;
    });
    mapRef.current?.flyTo([nearest.lat, nearest.lng], 15, { duration: 0.9 });
    selectStation(nearest.id);
  };

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

  const searchLower = searchQuery.toLowerCase().trim();

  const filtered = stations.filter((s) => {
    const status = dominantStatus(s);
    if (filterStatus !== "all" && status !== filterStatus) return false;
    if (filterFuel) {
      if (!s.fuel_statuses.some((f) => f.fuel_type === filterFuel)) return false;
    }
    if (filterRegion && s.region !== filterRegion) return false;
    if (filterNetwork && s.network !== filterNetwork) return false;
    if (filterZone && s.zone_type !== filterZone) return false;
    if (showFavoritesOnly && !isStationFavorite(s.id)) return false;
    if (searchLower) {
      const haystack = `${s.name} ${s.network} ${s.address ?? ""} ${s.region}`.toLowerCase();
      if (!haystack.includes(searchLower)) return false;
    }
    return true;
  });

  // Jump map to first search result
  const jumpToSearchResult = () => {
    if (!searchLower || !filtered.length) return;
    const first = filtered[0];
    mapRef.current?.flyTo([first.lat, first.lng], 14, { duration: 0.9 });
    selectStation(first.id);
    addMapRecentSearch(searchQuery);
  };

  const addMapRecentSearch = (q: string) => {
    const t = q.trim();
    if (!t || t.length < 2) return;
    setMapRecentSearches((prev) => {
      const updated = [t, ...prev.filter((x) => x !== t)].slice(0, 8);
      localStorage.setItem("tma-map-recent-searches", JSON.stringify(updated));
      return updated;
    });
  };

  const uniqueRegions = Array.from(new Set(stations.map((s) => s.region))).sort();
  const networkCounts = stations.reduce<Record<string, number>>((acc, s) => {
    acc[s.network] = (acc[s.network] || 0) + 1;
    return acc;
  }, {});
  const uniqueNetworks = Array.from(new Set(stations.map((s) => s.network)))
    .sort((a, b) => (networkCounts[b] || 0) - (networkCounts[a] || 0));
  const TOP_BRAND_NAMES = ["Лукойл", "Газпромнефть", "Роснефть", "Газпром", "Татнефть", "Сургутнефтегаз", "ОПТИ", "Тебойл"];
  const topNetworks = TOP_BRAND_NAMES.filter((b) => networkCounts[b] > 0);
  const activeFilterCount = [filterStatus !== "all", !!filterFuel, !!filterNetwork, !!filterRegion, !!filterZone].filter(Boolean).length;

  const selectedStation = selectedStationId
    ? stations.find((s) => s.id === selectedStationId)
    : null;

  // Derive brand ambient color from selected station's network
  const selectedBrand = selectedStation ? getBrandAccent(selectedStation.network ?? "") : null;
  const ambientColor  = selectedBrand ?? "#6366f1";

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
      <style>{AMBIENT_CSS}</style>
      {/* Filter Bar — clean: Filters button + Search only */}
      {/* ── Top floating controls: glass search bar + fuel chips ── */}
      <div
        style={{
          position: "absolute",
          top: "3rem",
          left: "0.75rem",
          right: "0.75rem",
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}
      >
        {/* Glass Search Bar */}
        <div style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          background: "rgba(20,20,32,0.88)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: "16px",
          height: "52px",
          padding: "0 1rem",
          boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
          gap: "0.5rem",
        }}>
          <Search size={18} style={{ color: "rgba(255,255,255,0.4)", flexShrink: 0 }} />
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setMapSearchFocused(true)}
            onBlur={() => setTimeout(() => setMapSearchFocused(false), 160)}
            onKeyDown={(e) => {
              if (e.key === "Enter") jumpToSearchResult();
              if (e.key === "Escape") { setSearchOpen(false); setSearchQuery(""); }
            }}
            placeholder="Поиск АЗС..."
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "rgba(255,255,255,0.95)",
              fontSize: "1rem",
              fontFamily: "system-ui, sans-serif",
            }}
          />
          {searchQuery && (
            <button
              onClick={jumpToSearchResult}
              style={{
                background: filtered.length > 0 ? "rgba(219,39,119,0.15)" : "rgba(239,68,68,0.12)",
                border: `1px solid ${filtered.length > 0 ? "#db277744" : "#ef444444"}`,
                borderRadius: "8px",
                padding: "0.2rem 0.5rem",
                color: filtered.length > 0 ? "#f472b6" : "#ef4444",
                fontSize: "0.62rem",
                fontFamily: "'JetBrains Mono',monospace",
                cursor: filtered.length > 0 ? "pointer" : "default",
                flexShrink: 0,
              }}
            >
              {filtered.length > 0 ? `${filtered.length} →` : "0"}
            </button>
          )}
          <div style={{ width: "1px", height: "22px", background: "rgba(255,255,255,0.08)", flexShrink: 0 }} />
          <button
            onClick={() => { setShowFilters(!showFilters); impact("light"); }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "0.25rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              flexShrink: 0,
            }}
          >
            <SlidersHorizontal size={20} style={{ color: activeFilterCount > 0 || showFavoritesOnly ? "#a78bfa" : "rgba(255,255,255,0.5)" }} />
            {(activeFilterCount > 0 || showFavoritesOnly) && (
              <span style={{
                position: "absolute",
                top: "0",
                right: "0",
                width: "7px",
                height: "7px",
                background: "#a855f7",
                borderRadius: "50%",
                boxShadow: "0 0 5px #a855f7",
              }} />
            )}
          </button>

          {/* Recent searches dropdown */}
          <AnimatePresence>
            {mapSearchFocused && !searchQuery && mapRecentSearches.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                style={{
                  position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
                  background: "rgba(8,7,16,0.98)", backdropFilter: "blur(24px)",
                  border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px",
                  padding: "0.5rem",
                  boxShadow: "0 12px 32px #00000099",
                  zIndex: 9999,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem", padding: "0 0.15rem" }}>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.48rem", letterSpacing: "0.12em" }}>НЕДАВНИЕ_ПОИСКИ</span>
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setMapRecentSearches([]); localStorage.removeItem("tma-map-recent-searches"); }}
                    style={{ background: "none", border: "none", color: "#374151", fontSize: "0.65rem", cursor: "pointer", padding: "0 0.15rem", lineHeight: 1 }}
                  >✕</button>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                  {mapRecentSearches.map((q) => (
                    <button
                      key={q}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setSearchQuery(q); setMapSearchFocused(false); setTimeout(() => searchRef.current?.focus(), 0); }}
                      style={{
                        background: "rgba(219,39,119,0.07)", border: "1px solid #db277722",
                        borderRadius: "8px", color: "#9ca3af", fontSize: "0.65rem",
                        padding: "0.2rem 0.55rem", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: "0.25rem",
                      }}
                    >
                      <span style={{ color: "#4b5563", fontSize: "0.55rem" }}>🕐</span>
                      {q}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Fuel Filter Chips */}
        <div style={{ display: "flex", gap: "0.4rem", overflowX: "auto", paddingBottom: "2px" }}>
          {([null, "АИ-92", "АИ-95", "ДТ", "Газ"] as (string | null)[]).map((f) => {
            const isActive = filterFuel === f;
            const label = f === null ? "Все" : f;
            return (
              <button
                key={label}
                onClick={() => { setFilter("filterFuel", f); impact("light"); }}
                style={{
                  padding: "0.4rem 0.9rem",
                  borderRadius: "99px",
                  whiteSpace: "nowrap",
                  fontSize: "0.82rem",
                  fontWeight: 500,
                  cursor: "pointer",
                  backdropFilter: "blur(12px)",
                  transition: "all 0.2s",
                  background: isActive ? "rgba(167,139,250,0.18)" : "rgba(20,20,32,0.75)",
                  color: isActive ? "#a78bfa" : "rgba(255,255,255,0.7)",
                  border: `1px solid ${isActive ? "#a78bfa55" : "rgba(255,255,255,0.06)"}`,
                  boxShadow: isActive ? "0 0 14px rgba(167,139,250,0.22)" : "none",
                  flexShrink: 0,
                }}
              >
                {label}
              </button>
            );
          })}
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
              top: "5rem",
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

            {/* Quick stats strip */}
            <div style={{
              background: "rgba(20,20,28,0.8)",
              border: "1px solid #1e1e2a",
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              overflow: "hidden",
              marginBottom: "0.65rem",
            }}>
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
                          borderRight: "1px solid #1e1e2a",
                          padding: "0.38rem 0.65rem",
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
                    fontSize: "0.6rem",
                    color: filtered.length < stations.length ? "#a855f7" : "#4b5563",
                    padding: "0 0.6rem",
                    marginLeft: "auto",
                  }}>
                    {filtered.length < stations.length ? `${filtered.length}/${stations.length}` : `${stations.length}`}
                    {" "}АЗС
                  </span>
                </>
              )}
            </div>

            {/* Quick actions */}
            <p style={{ color: "#374151", fontSize: "0.6rem", margin: "0 0 0.35rem", textTransform: "uppercase", letterSpacing: "0.12em" }}>Быстрые действия</p>
            <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginBottom: "0.65rem" }}>
              {/* Geolocation nearest */}
              <button
                onClick={() => { findNearest(); setShowFilters(false); }}
                disabled={geoLoading}
                title="Ближайшая АЗС по GPS"
                style={{
                  background: geoLoading ? "rgba(168,85,247,0.15)" : "rgba(20,20,28,0.9)",
                  border: `1px solid ${geoError ? "#ef444455" : geoLoading ? "#a855f755" : "#22222f"}`,
                  borderRadius: "8px",
                  color: geoError ? "#ef4444" : geoLoading ? "#a855f7" : "#e2e8f0",
                  padding: "0.3rem 0.55rem",
                  fontSize: "0.72rem", cursor: geoLoading ? "default" : "pointer",
                  display: "flex", alignItems: "center", gap: "0.25rem",
                  transition: "all 0.2s",
                }}
              >
                {geoLoading ? "⟳" : geoError ? "✗" : "📍"} Ближайшая
              </button>

              {/* Nearest green from map center */}
              <button
                onClick={() => { findNearestGreenFromCenter(); setShowFilters(false); }}
                title="Ближайшая с топливом от центра карты"
                style={{
                  background: "rgba(20,20,28,0.9)",
                  border: "1px solid #22222f",
                  borderRadius: "8px",
                  color: "#4ade80",
                  padding: "0.3rem 0.55rem",
                  fontSize: "0.72rem", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: "0.25rem",
                  transition: "all 0.2s",
                }}
              >
                🟢 С топливом
              </button>

              {/* Heatmap toggle */}
              <button
                onClick={() => setShowHeatmap((v) => !v)}
                title="Тепловая карта регионов"
                style={{
                  background: showHeatmap ? "rgba(168,85,247,0.18)" : "rgba(20,20,28,0.9)",
                  border: `1px solid ${showHeatmap ? "#a855f755" : "#22222f"}`,
                  borderRadius: "8px",
                  color: showHeatmap ? "#a855f7" : "#9ca3af",
                  padding: "0.3rem 0.55rem",
                  fontSize: "0.72rem", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: "0.25rem",
                  transition: "all 0.2s",
                }}
              >
                🌡 Тепловая карта
              </button>

              {/* Available fuel only */}
              {(() => {
                const withFuel = stations.filter((s) => s.fuel_statuses.some((f) => f.availability_pct > 0)).length;
                const isActive = filterStatus === "green";
                return (
                  <button
                    onClick={() => setFilter("filterStatus", isActive ? "all" : "green")}
                    title={isActive ? "Показать все АЗС" : "Только с топливом"}
                    style={{
                      background: isActive ? "rgba(34,197,94,0.18)" : "rgba(20,20,28,0.9)",
                      border: `1px solid ${isActive ? "#22c55e55" : "#22222f"}`,
                      borderRadius: "8px",
                      color: isActive ? "#4ade80" : "#6b7280",
                      padding: "0.3rem 0.55rem",
                      fontSize: "0.72rem", fontWeight: isActive ? 700 : 400, cursor: "pointer",
                      display: "flex", alignItems: "center", gap: "0.25rem",
                      transition: "all 0.2s",
                      boxShadow: isActive ? "0 0 8px rgba(34,197,94,0.22)" : "none",
                      fontFamily: "'JetBrains Mono',monospace",
                    }}
                  >
                    ⛽ {withFuel}
                  </button>
                );
              })()}

              {/* Favorites */}
              <button
                onClick={() => setShowFavoritesOnly((v) => !v)}
                title={showFavoritesOnly ? "Показать все АЗС" : "Только избранные"}
                style={{
                  background: showFavoritesOnly ? "rgba(234,179,8,0.18)" : "rgba(20,20,28,0.9)",
                  border: `1px solid ${showFavoritesOnly ? "#eab30855" : "#22222f"}`,
                  borderRadius: "8px",
                  color: showFavoritesOnly ? "#fde047" : "#9ca3af",
                  padding: "0.3rem 0.55rem",
                  fontSize: "0.72rem", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: "0.25rem",
                  transition: "all 0.2s",
                  boxShadow: showFavoritesOnly ? "0 0 10px rgba(234,179,8,0.25)" : "none",
                }}
              >
                ⭐ Избранные
              </button>

              {/* Crisis quick-filter */}
              {(() => {
                const redCount = stations.filter((s) => dominantStatus(s) === "red").length;
                const isCrisisFilter = filterStatus === "red";
                if (redCount === 0) return null;
                return (
                  <button
                    onClick={() => setFilter("filterStatus", isCrisisFilter ? "all" : "red")}
                    title="Только кризисные АЗС"
                    style={{
                      background: isCrisisFilter ? "rgba(239,68,68,0.2)" : "rgba(20,20,28,0.9)",
                      border: `1px solid ${isCrisisFilter ? "#ef444488" : "#ef444430"}`,
                      borderRadius: "8px",
                      color: isCrisisFilter ? "#fca5a5" : "#ef4444",
                      padding: "0.3rem 0.55rem",
                      fontSize: "0.72rem", fontWeight: 700, cursor: "pointer",
                      display: "flex", alignItems: "center", gap: "0.22rem",
                      transition: "all 0.2s",
                      boxShadow: isCrisisFilter ? "0 0 10px rgba(239,68,68,0.3)" : "none",
                    }}
                  >
                    <span style={{ fontSize: "0.55rem" }}>●</span> Кризис {redCount}
                  </button>
                );
              })()}
            </div>

            {/* Zone quick-filters */}
            <p style={{ color: "#374151", fontSize: "0.6rem", margin: "0 0 0.35rem", textTransform: "uppercase", letterSpacing: "0.12em" }}>Зона</p>
            <div style={{ display: "flex", gap: "0.35rem", marginBottom: "0.65rem" }}>
              {([
                { z: "critical", label: "🔴 Кризисная", title: "Кризисная зона" },
                { z: "standard", label: "🟣 Стандартная", title: "Стандартная зона" },
                { z: "eastern",  label: "🟡 Восточная", title: "Восточная зона" },
              ] as const).map(({ z, label, title }) => (
                <button key={z}
                  onClick={() => setFilter("filterZone", filterZone === z ? null : z)}
                  title={title}
                  style={{
                    background: filterZone === z ? "rgba(168,85,247,0.15)" : "#0b0b10",
                    border: `1px solid ${filterZone === z ? "#a855f755" : "#1e1e2a"}`,
                    borderRadius: "8px",
                    color: filterZone === z ? "#c084fc" : "#4b5563",
                    padding: "0.28rem 0.55rem",
                    fontSize: "0.7rem",
                    fontWeight: filterZone === z ? 700 : 400,
                    cursor: "pointer",
                    transition: "all 0.2s",
                    boxShadow: filterZone === z ? "0 0 8px rgba(168,85,247,0.2)" : "none",
                  }}
                >{label}</button>
              ))}
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

            {/* Region */}
            <div style={{ marginBottom: "0.55rem" }}>
              <p style={{ color: "#374151", fontSize: "0.6rem", margin: "0 0 0.3rem", textTransform: "uppercase", letterSpacing: "0.12em" }}>Регион</p>
              {/* Quick city chips */}
              <div style={{ display: "flex", gap: "0.28rem", flexWrap: "wrap", marginBottom: "0.4rem" }}>
                {[
                  { label: "🌐 Все",    value: null,                          color: "#6b7280", coords: null as [number,number]|null, zoom: 5  },
                  { label: "🏙 Москва", value: "г. Москва и Новая Москва",    color: "#3b82f6", coords: [55.75, 37.62] as [number,number], zoom: 11 },
                  { label: "🌊 Крым",   value: "Севастополь",                 color: "#a855f7", coords: [44.60, 33.52] as [number,number], zoom: 10 },
                  { label: "⚓ Питер",  value: "г. Санкт-Петербург",          color: "#06b6d4", coords: [59.95, 30.32] as [number,number], zoom: 11 },
                ].map(({ label, value, color, coords, zoom }) => {
                  const active = filterRegion === value;
                  return (
                    <button key={String(value)} onClick={() => {
                      setFilter("filterRegion", value);
                      if (coords) mapRef.current?.flyTo(coords, zoom, { duration: 1.2 });
                    }}
                      style={{
                        flexShrink: 0, padding: "0.18rem 0.45rem",
                        background: active ? `${color}18` : "#0b0b10",
                        border: `1px solid ${active ? color + "60" : "#1e1e2a"}`,
                        borderRadius: "6px", color: active ? color : "#374151",
                        fontSize: "0.6rem", fontWeight: active ? 700 : 400, cursor: "pointer",
                      }}
                    >{label}</button>
                  );
                })}
              </div>
              <select
                value={filterRegion ?? ""}
                onChange={(e) => setFilter("filterRegion", e.target.value || null)}
                style={{ width: "100%", background: "#0b0b10", border: `1px solid ${filterRegion ? "#a855f744" : "#1e1e2a"}`, borderRadius: "8px", color: filterRegion ? "#e2e8f0" : "#4b5563", padding: "0.3rem 0.5rem", fontSize: "0.7rem", outline: "none", cursor: "pointer" }}
              >
                <option value="">Все регионы</option>
                {uniqueRegions.map((r) => <option key={r} value={r}>{r.slice(0, 30)}</option>)}
              </select>
            </div>

            {/* Brand / Network chips */}
            <p style={{ color: "#374151", fontSize: "0.6rem", margin: "0 0 0.35rem", textTransform: "uppercase", letterSpacing: "0.12em" }}>Сеть / Бренд</p>
            <div style={{ display: "flex", gap: "0.28rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
              {topNetworks.map((brand) => {
                const active = filterNetwork === brand;
                const cnt = networkCounts[brand] || 0;
                return (
                  <button
                    key={brand}
                    onClick={() => setFilter("filterNetwork", active ? null : brand)}
                    style={{
                      background: active ? "#a855f720" : "#0b0b10",
                      border: `1px solid ${active ? "#a855f7" : "#1e1e2a"}`,
                      borderRadius: "7px",
                      color: active ? "#c084fc" : "#4b5563",
                      padding: "0.22rem 0.5rem",
                      fontSize: "0.68rem",
                      fontWeight: active ? 700 : 400,
                      cursor: "pointer",
                      transition: "all 0.15s",
                      display: "flex", alignItems: "center", gap: "0.28rem",
                      boxShadow: active ? "0 0 6px #a855f730" : "none",
                    }}
                  >
                    {brand}
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", color: active ? "#a855f7aa" : "#374151", fontSize: "0.58rem" }}>{cnt}</span>
                  </button>
                );
              })}
              {/* Any non-top network that is currently selected */}
              {filterNetwork && !topNetworks.includes(filterNetwork) && (
                <button
                  onClick={() => setFilter("filterNetwork", null)}
                  style={{
                    background: "#a855f720", border: "1px solid #a855f7", borderRadius: "7px",
                    color: "#c084fc", padding: "0.22rem 0.5rem", fontSize: "0.68rem", fontWeight: 700,
                    cursor: "pointer", display: "flex", alignItems: "center", gap: "0.3rem",
                    boxShadow: "0 0 6px #a855f730",
                  }}
                >
                  {filterNetwork} <span style={{ fontSize: "0.62rem" }}>✕</span>
                </button>
              )}
            </div>
            {/* Other networks dropdown */}
            <select
              value={topNetworks.includes(filterNetwork ?? "") ? "" : (filterNetwork ?? "")}
              onChange={(e) => setFilter("filterNetwork", e.target.value || null)}
              style={{ width: "100%", background: "#0b0b10", border: `1px solid ${filterNetwork && !topNetworks.includes(filterNetwork) ? "#a855f744" : "#1e1e2a"}`, borderRadius: "8px", color: filterNetwork && !topNetworks.includes(filterNetwork) ? "#e2e8f0" : "#4b5563", padding: "0.3rem 0.5rem", fontSize: "0.7rem", outline: "none", cursor: "pointer", marginBottom: "0.5rem" }}
            >
              <option value="">Другая сеть...</option>
              {uniqueNetworks.filter((n) => !topNetworks.includes(n)).map((n) => (
                <option key={n} value={n}>{n.slice(0, 22)} ({networkCounts[n]})</option>
              ))}
            </select>

            {(filterStatus !== "all" || filterFuel || filterRegion || filterNetwork || filterZone) && (
              <button
                onClick={() => {
                  setFilter("filterStatus", "all");
                  setFilter("filterFuel", null);
                  setFilter("filterRegion", null);
                  setFilter("filterNetwork", null);
                  setFilter("filterZone", null);
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

      {/* Map legend — bottom-left, fixed so it never moves with nav bar */}
      {(() => {
        const gs = filtered.filter(s => { const a = s.fuel_statuses.length ? s.fuel_statuses.reduce((x,f) => x+f.availability_pct,0)/s.fuel_statuses.length : 0; return a >= 60; }).length;
        const ys = filtered.filter(s => { const a = s.fuel_statuses.length ? s.fuel_statuses.reduce((x,f) => x+f.availability_pct,0)/s.fuel_statuses.length : 0; return a >= 25 && a < 60; }).length;
        const rs = filtered.length - gs - ys;
        const legend: [string,string,number][] = [["#00E676","≥60%",gs],["#FFD600","25–60%",ys],["#FF1744","<25%",rs]];
        return (
          <div style={{
            position: "fixed",
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)",
            left: "0.75rem",
            zIndex: 1000,
            background: "rgba(8,8,20,0.88)",
            border: "1px solid #1e1e2a",
            borderRadius: "10px",
            padding: "0.35rem 0.55rem",
            backdropFilter: "blur(12px)",
            display: "flex", flexDirection: "column", gap: "4px",
          }}>
            {legend.map(([c,l,n]) => (
              <div key={c} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: c, boxShadow: `0 0 5px ${c}88`, flexShrink: 0 }} />
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.42rem", color: "#6b7280" }}>{l}</span>
                {n > 0 && <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.4rem", color: c, opacity: 0.8 }}>{n}</span>}
              </div>
            ))}
          </div>
        );
      })()}


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
              icon={createStationIcon(dominantStatus(station), isStationFavorite(station.id), station.network ?? "", station.queue_cars)}
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
            }}
          >
            {/* Glass card shell */}
            <div
              ref={(el) => { (dragControls as any)._sheetEl = el; }}
              onPointerDown={(e) => {
                const el = e.currentTarget as HTMLDivElement;
                if (el.scrollTop === 0) dragControls.start(e);
              }}
              style={{
                background: "rgba(8,8,28,0.97)",
                backdropFilter: "blur(32px)",
                borderRadius: "28px 28px 0 0",
                border: `1px solid ${ambientColor}22`,
                borderBottom: "none",
                boxShadow: `0 -12px 48px rgba(0,0,0,0.7), 0 -2px 0 ${ambientColor}33`,
                maxHeight: "72vh",
                overflowY: "auto",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Mercedes ambient strip — brand color, top edge */}
              <AmbientStrip color={ambientColor} thickness={2} style={{ top: 0, left: 0, right: 0, borderRadius: "28px 28px 0 0" }} />
              {/* Subtle brand glow bloom inside top */}
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 140, background: `radial-gradient(ellipse at 50% 0%, ${ambientColor}18 0%, transparent 70%)`, pointerEvents: "none", zIndex: 0 }} />

              {/* Drag handle — brand color */}
              <div
                onPointerDown={(e) => dragControls.start(e)}
                style={{ display: "flex", justifyContent: "center", paddingTop: "14px", paddingBottom: "4px", cursor: "grab", touchAction: "none", position: "relative", zIndex: 1 }}
              >
                <div style={{ width: "40px", height: "4px", background: `${ambientColor}77`, borderRadius: "99px", boxShadow: `0 0 8px ${ambientColor}66` }} />
              </div>

              <div style={{ position: "relative", paddingBottom: "6rem" }}>
                <StationCard
                  station={selectedStation}
                  onClose={() => selectStation(null)}
                />
              </div>

              {/* Sticky CTA at bottom */}
              <div style={{
                position: "sticky",
                bottom: 0,
                padding: "0.75rem 1.25rem 1.25rem",
                background: "linear-gradient(to top, rgba(8,8,28,1) 70%, transparent)",
              }}>
                <button
                  onClick={() => { impact("medium"); selectStation(null); }}
                  style={{
                    width: "100%",
                    padding: "1rem",
                    borderRadius: "16px",
                    background: "linear-gradient(135deg, #E8622A 0%, #c04010 60%, #9a2f08 100%)",
                    color: "#fff",
                    fontWeight: 900,
                    fontSize: "1rem",
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    border: "none",
                    cursor: "pointer",
                    boxShadow: `0 4px 24px rgba(232,98,42,0.55), 0 0 0 1px rgba(232,98,42,0.2)`,
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <span style={{ position: "relative", zIndex: 1 }}>Зарезервировать ⛽</span>
                  {/* Shimmer sweep */}
                  <div style={{
                    position: "absolute", inset: 0,
                    background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)",
                    animation: "shimmer 2.2s infinite",
                  }} />
                  {/* Ambient strip on button bottom edge — brand color */}
                  <AmbientStrip color={ambientColor} thickness={2} style={{ bottom: 0, left: 0, right: 0, opacity: 0.7 }} />
                  <style>{`@keyframes shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }`}</style>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
