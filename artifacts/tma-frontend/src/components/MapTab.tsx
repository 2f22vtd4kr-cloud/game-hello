import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { motion, AnimatePresence } from "framer-motion";
import type { GasStation } from "@/types";
import { STATUS_COLORS } from "@/types";
import { useStationStore } from "@/stores/useStationStore";
import { useMapStore } from "@/stores/useMapStore";
import { usePriceStore } from "@/stores/usePriceStore";
import { StationCard } from "@/components/StationCard";

// NOTE: Leaflet default marker icons are fixed globally in src/main.tsx via
// bundled asset imports.  No CDN URLs needed here — this file only uses
// L.divIcon() for custom station markers, so no further setup is required.

function createStationIcon(status: string) {
  const color = STATUS_COLORS[status] ?? "#9ca3af";
  return L.divIcon({
    html: `<div style="
      width:14px;height:14px;border-radius:50%;
      background:${color};
      border:2px solid rgba(255,255,255,0.4);
      box-shadow:0 0 10px ${color}88,0 0 4px ${color};
    "></div>`,
    className: "",
    iconSize: [14, 14],
    iconAnchor: [7, 7],
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

function PopupContent({ station }: { station: GasStation }) {
  const getPrice = usePriceStore((s) => s.getPrice);
  return (
    <div style={{
      background: "#14141c", color: "#e2e8f0",
      padding: "0.6rem 0.7rem", borderRadius: "8px",
      fontSize: "0.8rem", minWidth: "180px",
    }}>
      <strong style={{ display: "block", marginBottom: "0.2rem" }}>{station.name}</strong>
      <span style={{ color: "#6b7280", fontSize: "0.72rem" }}>{station.address}</span>
      <div style={{ marginTop: "0.45rem", display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
        {POPUP_FUELS.map((ft) => {
          const p = getPrice(station.region, ft);
          if (!p) return null;
          const crisis = p.is_crisis;
          return (
            <span
              key={ft}
              className={crisis ? "crisis-badge" : ""}
              style={{
                background: crisis ? "rgba(255,0,136,0.08)" : "rgba(168,85,247,0.08)",
                border: `1px solid ${crisis ? "#ff008855" : "#a855f733"}`,
                borderRadius: "6px",
                padding: "0.1rem 0.4rem",
                fontSize: "0.7rem",
              }}
            >
              <span style={{ color: "#9ca3af" }}>{ft}&#8239;</span>
              <span
                className={crisis ? "crisis-price-text" : ""}
                style={crisis ? undefined : {
                  color: "#a855f7",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 700,
                }}
              >
                {p.effective}₽
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
  const { viewport, filterStatus, filterFuel, setFilter, selectedStationId, selectStation } =
    useMapStore();
  const [showFilters, setShowFilters] = useState(false);

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
    return true;
  });

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
          top: "0.75rem",
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
            background: "rgba(20,20,28,0.92)",
            border: "1px solid #22222f",
            borderRadius: "10px",
            color: "#e2e8f0",
            padding: "0.4rem 0.75rem",
            fontSize: "0.78rem",
            cursor: "pointer",
            backdropFilter: "blur(12px)",
            display: "flex",
            alignItems: "center",
            gap: "0.3rem",
          }}
        >
          🔍 Фильтры{" "}
          {(filterStatus !== "all" || filterFuel) && (
            <span
              style={{
                background: "#a855f7",
                borderRadius: "50%",
                width: "6px",
                height: "6px",
                display: "inline-block",
              }}
            />
          )}
        </button>

        {/* Station count badge */}
        <div
          style={{
            background: "rgba(20,20,28,0.92)",
            border: "1px solid #22222f",
            borderRadius: "10px",
            color: "#9ca3af",
            padding: "0.4rem 0.75rem",
            fontSize: "0.78rem",
            backdropFilter: "blur(12px)",
          }}
        >
          {loading ? "…" : `${filtered.length} АЗС`}
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
              top: "3.5rem",
              left: "0.75rem",
              right: "0.75rem",
              zIndex: 1000,
              background: "rgba(20,20,28,0.96)",
              border: "1px solid #22222f",
              borderRadius: "14px",
              padding: "0.75rem",
              backdropFilter: "blur(20px)",
            }}
          >
            <p style={{ color: "#6b7280", fontSize: "0.72rem", margin: "0 0 0.5rem" }}>
              СТАТУС
            </p>
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
              {(["all", "green", "yellow", "red"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilter("filterStatus", s)}
                  style={{
                    background:
                      filterStatus === s
                        ? s === "all"
                          ? "#a855f7"
                          : { green: "#22c55e", yellow: "#eab308", red: "#ef4444" }[s]
                        : "#0b0b0f",
                    border: "1px solid #22222f",
                    borderRadius: "8px",
                    color: filterStatus === s ? "#fff" : "#9ca3af",
                    padding: "0.3rem 0.65rem",
                    fontSize: "0.75rem",
                    cursor: "pointer",
                  }}
                >
                  {s === "all"
                    ? "Все"
                    : s === "green"
                    ? "В наличии"
                    : s === "yellow"
                    ? "Ограничено"
                    : "Нет"}
                </button>
              ))}
            </div>
            <p style={{ color: "#6b7280", fontSize: "0.72rem", margin: "0 0 0.5rem" }}>
              ТОПЛИВО
            </p>
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
              <button
                onClick={() => setFilter("filterFuel", null)}
                style={{
                  background: filterFuel === null ? "#a855f7" : "#0b0b0f",
                  border: "1px solid #22222f",
                  borderRadius: "8px",
                  color: filterFuel === null ? "#fff" : "#9ca3af",
                  padding: "0.3rem 0.65rem",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                }}
              >
                Все
              </button>
              {FUEL_OPTIONS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter("filterFuel", f)}
                  style={{
                    background: filterFuel === f ? "#a855f7" : "#0b0b0f",
                    border: "1px solid #22222f",
                    borderRadius: "8px",
                    color: filterFuel === f ? "#fff" : "#9ca3af",
                    padding: "0.3rem 0.65rem",
                    fontSize: "0.75rem",
                    cursor: "pointer",
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nav toggle button — bottom-right corner of map */}
      {onNavToggle && (
        <button
          onClick={onNavToggle}
          style={{
            position: "absolute",
            bottom: navVisible ? "4.5rem" : "0.75rem",
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
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution=""
          subdomains="abcd"
          maxZoom={19}
        />
        <MapViewportSync />
        <MapRecenter lat={viewport.lat} lng={viewport.lng} zoom={viewport.zoom} />

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
              icon={createStationIcon(dominantStatus(station))}
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
            style={{
              position: "absolute",
              bottom: "0",
              left: 0,
              right: 0,
              zIndex: 1001,
              maxHeight: "70vh",
              overflowY: "auto",
              borderRadius: "20px 20px 0 0",
              boxShadow: "0 -8px 40px rgba(0,0,0,0.7)",
            }}
          >
            <StationCard
              station={selectedStation}
              onClose={() => selectStation(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
