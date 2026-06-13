/**
 * Root application component.
 *
 * Responsibilities:
 *  - Initialize Telegram WebApp SDK (ready, expand, theme colours)
 *  - Parse deep-link startParam → navigate to correct tab + pre-select entity
 *  - Manage Telegram BackButton (shows when leaving the default map tab)
 *  - Keep MapTab always mounted (visibility toggle) to preserve Leaflet state
 *  - Fetch baseline data (user profile, station list) on boot
 */
import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ToastContainer } from "@/components/Toast";
import { BottomNav } from "@/components/BottomNav";
import { MapTab } from "@/components/MapTab";
import { AnalyticsTab } from "@/components/AnalyticsTab";
import { CatalogTab } from "@/components/CatalogTab";
import { VaultTab } from "@/components/VaultTab";
import { ReserveTab } from "@/components/ReserveTab";
import { VpnModal } from "@/components/VpnModal";
import { useUserStore } from "@/stores/useUserStore";
import { useStationStore } from "@/stores/useStationStore";
import { useMapStore } from "@/stores/useMapStore";
import { parseStartParam } from "@/lib/deeplink";
import { select as hapticSelect } from "@/lib/haptic";
import type { TabId } from "@/types";

// ─── Telegram WebApp type augmentation ────────────────────────────────────────
declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  close: () => void;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  initDataUnsafe?: {
    user?: { id: number; username?: string; first_name?: string; last_name?: string };
    /** Deep-link payload passed via ?startapp= */
    start_param?: string;
  };
  MainButton: {
    hide: () => void;
    show: () => void;
    setText: (text: string) => void;
    onClick: (cb: () => void) => void;
  };
  BackButton: {
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  };
  HapticFeedback?: {
    impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
    notificationOccurred: (type: "error" | "success" | "warning") => void;
    selectionChanged: () => void;
  };
  themeParams?: {
    bg_color?: string;
    text_color?: string;
    hint_color?: string;
    link_color?: string;
    button_color?: string;
    button_text_color?: string;
  };
}

// ─── App ──────────────────────────────────────────────────────────────────────

const DEFAULT_TAB: TabId = "map";

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>(DEFAULT_TAB);
  const [initialStationId, setInitialStationId] = useState<number | undefined>();
  const [initialPurchaseId, setInitialPurchaseId] = useState<number | undefined>();
  const [navVisible, setNavVisible] = useState(true);
  const [showVpn, setShowVpn] = useState(false);
  const [vpnTroubleshooter, setVpnTroubleshooter] = useState(false);
  const vpnSuggested = useRef(false);

  const { init: initUser } = useUserStore();
  const { fetch: fetchStations } = useStationStore();
  const { selectStation } = useMapStore();

  // Keep a stable reference to the BackButton callback so we can offClick it
  const backCbRef = useRef<(() => void) | null>(null);

  // ── SDK + deep-link init ────────────────────────────────────────
  useEffect(() => {
    const tg = window.Telegram?.WebApp;

    if (tg) {
      // Tell Telegram the Mini App is ready and should be full-screen
      tg.ready();
      tg.expand();

      // Force the dark theme colours used by this app
      try {
        tg.setHeaderColor("#050507");
        tg.setBackgroundColor("#050507");
      } catch {
        // Older SDK versions throw on unknown colour strings — safe to ignore
      }

      // Hide the MainButton — we manage our own navigation
      try { tg.MainButton.hide(); } catch {}
    }

    // ── Parse deep-link startParam ──────────────────────────────
    const startParam = tg?.initDataUnsafe?.start_param;
    const deepLink = parseStartParam(startParam);

    if (deepLink.tab !== DEFAULT_TAB || deepLink.stationId || deepLink.purchaseId) {
      setActiveTab(deepLink.tab);
    }
    if (deepLink.stationId) {
      setInitialStationId(deepLink.stationId);
      // Also pre-select in the map store so MapTab shows the popup immediately
      selectStation(deepLink.stationId);
    }
    if (deepLink.purchaseId) {
      setInitialPurchaseId(deepLink.purchaseId);
    }

    // ── User + stations ─────────────────────────────────────────
    const tgUser = tg?.initDataUnsafe?.user;
    initUser(tgUser?.id ?? 0, tgUser?.username ?? tgUser?.first_name ?? undefined);

    // Detect slow/failed loads and suggest VPN after 8 seconds
    const vpnTimer = setTimeout(() => {
      if (!vpnSuggested.current) {
        vpnSuggested.current = true;
        setVpnTroubleshooter(true);
        setShowVpn(true);
      }
    }, 8000);

    fetchStations().then(() => clearTimeout(vpnTimer)).catch(() => {
      clearTimeout(vpnTimer);
      if (!vpnSuggested.current) {
        vpnSuggested.current = true;
        setVpnTroubleshooter(true);
        setShowVpn(true);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Telegram BackButton — show when not on the default tab ─────
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg?.BackButton) return;

    // Remove the previous click listener before registering a new one
    if (backCbRef.current) {
      try { tg.BackButton.offClick(backCbRef.current); } catch {}
    }

    if (activeTab !== DEFAULT_TAB) {
      tg.BackButton.show();
      const cb = () => setActiveTab(DEFAULT_TAB);
      backCbRef.current = cb;
      tg.BackButton.onClick(cb);
    } else {
      tg.BackButton.hide();
      backCbRef.current = null;
    }
  }, [activeTab]);

  // ── Tab change with haptics ─────────────────────────────────────
  const handleTabChange = (tab: TabId) => {
    hapticSelect();
    setActiveTab(tab);
    // Always show nav when switching tabs from outside the map
    if (!navVisible) setNavVisible(true);
  };

  return (
    <ErrorBoundary>
      <ToastContainer />

      <AnimatePresence>
        {showVpn && (
          <VpnModal
            isTroubleshooter={vpnTroubleshooter}
            onClose={() => { setShowVpn(false); setVpnTroubleshooter(false); }}
          />
        )}
      </AnimatePresence>

      {/* VPN floating button */}
      <button
        onClick={() => { setVpnTroubleshooter(false); setShowVpn(true); }}
        title="VPN-доступ"
        style={{
          position: "fixed", bottom: "72px", right: "12px",
          zIndex: 9500,
          width: "40px", height: "40px",
          borderRadius: "50%",
          background: "linear-gradient(135deg,#a855f7,#db2777)",
          border: "none",
          boxShadow: "0 0 14px #a855f755",
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "1.1rem",
        }}
      >
        🔒
      </button>

      {/*
        Content area:
        · MapTab is ALWAYS in the DOM — unmounting it resets the Leaflet
          viewport (zoom/pan). We toggle CSS visibility instead.
        · All other tabs use conditional rendering — they're lightweight.
      */}
      <div
        style={{
          flex: 1,
          position: "relative",
          overflow: "hidden",
          paddingBottom: navVisible ? "60px" : "0px",
          transition: "padding-bottom 0.3s",
        }}
      >
        {/* Map — always mounted, hidden via CSS when another tab is active */}
        <MapTab
          visible={activeTab === "map"}
          initialStationId={initialStationId}
          navVisible={navVisible}
          onNavToggle={() => setNavVisible((v) => !v)}
        />

        {activeTab === "analytics" && (
          <div style={{ position: "absolute", inset: 0, overflowY: "auto" }}>
            <AnalyticsTab />
          </div>
        )}
        {activeTab === "catalog" && (
          <div style={{ position: "absolute", inset: 0, overflowY: "auto" }}>
            <CatalogTab initialStationId={initialStationId} />
          </div>
        )}
        {activeTab === "vault" && (
          <div style={{ position: "absolute", inset: 0, overflowY: "auto" }}>
            <VaultTab initialPurchaseId={initialPurchaseId} />
          </div>
        )}
        {activeTab === "reserve" && (
          <div style={{ position: "absolute", inset: 0, overflowY: "auto" }}>
            <ReserveTab />
          </div>
        )}
      </div>

      <BottomNav active={activeTab} onChange={handleTabChange} visible={navVisible} />
    </ErrorBoundary>
  );
}
