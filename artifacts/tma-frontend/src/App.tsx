/**
 * Root application component.
 *
 * Responsibilities:
 *  - Intro splash screen on first launch
 *  - Onboarding tour for new users (after splash)
 *  - Initialize Telegram WebApp SDK (ready, expand)
 *  - Parse deep-link startParam → navigate to correct tab + pre-select entity
 *  - Manage Telegram BackButton (shows when leaving the default map tab)
 *  - Keep MapTab always mounted (visibility toggle) to preserve Leaflet state
 *  - Fetch baseline data (user profile, station list) on boot
 *  - Admin panel (long-press header or ?admin=1 param)
 */
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ToastContainer } from "@/components/Toast";
import { BottomNav } from "@/components/BottomNav";
import { PriceAlertBanner } from "@/components/PriceAlertBanner";
import { MapTab } from "@/components/MapTab";
import { AnalyticsTab } from "@/components/AnalyticsTab";
import { CatalogTab } from "@/components/CatalogTab";
import { VaultTab } from "@/components/VaultTab";
import { ReserveTab } from "@/components/ReserveTab";
import { VpnModal } from "@/components/VpnModal";
import { MarketTicker } from "@/components/MarketTicker";
import { IntroSplash } from "@/components/IntroSplash";
import { AdminPanel } from "@/components/AdminPanel";
import { OnboardingTour } from "@/components/OnboardingTour";
import { useUserStore } from "@/stores/useUserStore";
import { useStationStore } from "@/stores/useStationStore";
import { useMapStore } from "@/stores/useMapStore";
import { usePriceStore } from "@/stores/usePriceStore";
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
  colorScheme?: "light" | "dark";
  initDataUnsafe?: {
    user?: { id: number; username?: string; first_name?: string; last_name?: string };
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
const SPLASH_KEY = "tma-splash-seen-v2";
const ONBOARDING_KEY = "tma-onboarding-v1";
const TICKER_H = 40;

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>(DEFAULT_TAB);
  const [initialStationId, setInitialStationId] = useState<number | undefined>();
  const [initialPurchaseId, setInitialPurchaseId] = useState<number | undefined>();
  const [navVisible, setNavVisible] = useState(true);
  const [showVpn, setShowVpn] = useState(false);
  const [vpnTroubleshooter, setVpnTroubleshooter] = useState(false);
  const [showSplash, setShowSplash] = useState(() => !localStorage.getItem(SPLASH_KEY));
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const vpnSuggested = useRef(false);
  const adminPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { init: initUser } = useUserStore();
  const { fetch: fetchStations, stations } = useStationStore();
  const { selectStation } = useMapStore();
  const { initPrices, connectWs, priceAlerts, dismissAlert } = usePriceStore();

  const crisisCount = stations.reduce((n, s) => {
    const avg = s.fuel_statuses.length
      ? s.fuel_statuses.reduce((a, b) => a + b.availability_pct, 0) / s.fuel_statuses.length
      : 100;
    return avg < 25 ? n + 1 : n;
  }, 0);

  // ── Price store + WebSocket live feed ───────────────────────────
  useEffect(() => {
    void initPrices();
    const disconnect = connectWs();
    return disconnect;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const backCbRef = useRef<(() => void) | null>(null);

  // ── SDK init ────────────────────────────────────────────────────
  useEffect(() => {
    const tg = window.Telegram?.WebApp;

    if (tg) {
      tg.ready();
      tg.expand();

      try {
        tg.setHeaderColor("#050507");
        tg.setBackgroundColor("#050507");
      } catch {
        // older SDK versions throw on unknown colour strings — safe to ignore
      }

      try { tg.MainButton.hide(); } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Deep-link + user init ───────────────────────────────────────
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    const startParam = tg?.initDataUnsafe?.start_param;
    const deepLink = parseStartParam(startParam);

    if (deepLink.tab !== DEFAULT_TAB || deepLink.stationId || deepLink.purchaseId) {
      setActiveTab(deepLink.tab);
    }
    if (deepLink.stationId) {
      setInitialStationId(deepLink.stationId);
      selectStation(deepLink.stationId);
    }
    if (deepLink.purchaseId) {
      setInitialPurchaseId(deepLink.purchaseId);
    }

    if (new URLSearchParams(window.location.search).get("admin") === "1") {
      setShowAdmin(true);
    }

    const tgUser = tg?.initDataUnsafe?.user;
    initUser(tgUser?.id ?? 0, tgUser?.username ?? tgUser?.first_name ?? undefined);

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

  // ── Telegram BackButton ─────────────────────────────────────────
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg?.BackButton) return;

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
    if (!navVisible) setNavVisible(true);
  };

  // ── Splash done → show onboarding for first-timers ──────────────
  const handleSplashDone = () => {
    localStorage.setItem(SPLASH_KEY, "1");
    setShowSplash(false);
    if (!localStorage.getItem(ONBOARDING_KEY)) {
      setShowOnboarding(true);
    }
  };

  const handleOnboardingDone = () => {
    localStorage.setItem(ONBOARDING_KEY, "1");
    setShowOnboarding(false);
  };

  // ── Admin panel long-press on ticker ───────────────────────────
  const handleTickerPressStart = () => {
    adminPressTimer.current = setTimeout(() => setShowAdmin(true), 3000);
  };
  const handleTickerPressEnd = () => {
    if (adminPressTimer.current) {
      clearTimeout(adminPressTimer.current);
      adminPressTimer.current = null;
    }
  };

  const tabOrder: TabId[] = ["map", "analytics", "catalog", "vault", "reserve"];
  const tabIndexRef = useRef(0);
  const prevTabIndex = tabIndexRef.current;
  const curTabIndex = tabOrder.indexOf(activeTab);
  const slideDir = curTabIndex >= prevTabIndex ? 1 : -1;
  tabIndexRef.current = curTabIndex;

  return (
    <ErrorBoundary>
      <ToastContainer />

      {/* Deep Field — nebula background blobs */}
      <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-10%", right: "-15%", width: 360, height: 360, background: "rgba(168,85,247,0.08)", borderRadius: "50%", filter: "blur(120px)" }} />
        <div style={{ position: "absolute", bottom: "-10%", left: "-15%", width: 400, height: 400, background: "rgba(219,39,119,0.05)", borderRadius: "50%", filter: "blur(120px)" }} />
      </div>

      {/* Price change alert banners — slide in from top when fuel moves ≥1% */}
      <PriceAlertBanner
        alerts={priceAlerts}
        onDismiss={dismissAlert}
        onNavigate={() => handleTabChange("catalog")}
        topOffset={TICKER_H}
      />

      <AnimatePresence>
        {showSplash && <IntroSplash onDone={handleSplashDone} />}
      </AnimatePresence>

      <AnimatePresence>
        {showOnboarding && !showSplash && (
          <OnboardingTour onDone={handleOnboardingDone} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}
      </AnimatePresence>

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
          position: "fixed", bottom: "calc(env(safe-area-inset-bottom, 0px) + 104px)", left: "12px",
          zIndex: 9500,
          width: "38px", height: "38px",
          borderRadius: "50%",
          background: "linear-gradient(135deg,#a855f7,#db2777)",
          border: "none",
          boxShadow: "0 0 14px #a855f755",
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "1rem",
        }}
      >
        🔒
      </button>

      {/* Crisis badge */}
      {crisisCount >= 5 && (
        <div style={{
          position: "fixed", top: `${TICKER_H + 8}px`, right: "12px",
          zIndex: 9700,
          background: "linear-gradient(135deg,#1a0606,#200a0a)",
          border: "1px solid #ef444455",
          borderRadius: "8px",
          padding: "0.2rem 0.5rem",
          display: "flex", alignItems: "center", gap: "0.3rem",
          boxShadow: "0 0 12px #ef444430",
          pointerEvents: "none",
        }}>
          <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#ef4444", boxShadow: "0 0 5px #ef4444", animation: "crisisPulse 1.2s infinite", flexShrink: 0 }} />
          <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#ef4444", fontSize: "0.52rem", letterSpacing: "0.08em" }}>
            {crisisCount} КРИЗИС
          </span>
        </div>
      )}

      {/* Market ticker — fixed strip */}
      <div
        style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 9800 }}
        onMouseDown={handleTickerPressStart}
        onMouseUp={handleTickerPressEnd}
        onTouchStart={handleTickerPressStart}
        onTouchEnd={handleTickerPressEnd}
      >
        <MarketTicker />
      </div>

      {/* Ambient dot-grid */}
      <div aria-hidden style={{
        position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
        backgroundImage: "radial-gradient(circle, rgba(168,85,247,0.07) 1px, transparent 1px)",
        backgroundSize: "28px 28px",
        maskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)",
        WebkitMaskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)",
      }} />

      {/*
        Content area:
        · MapTab ALWAYS in DOM — unmounting resets Leaflet viewport.
        · Other tabs animated slide in/out.
        · paddingTop: ticker height (40px) + 8px buffer = 48px.
      */}
      <div style={{
        flex: 1,
        position: "relative",
        overflow: "hidden",
        paddingTop: `${TICKER_H + 8}px`,
        paddingBottom: navVisible ? "96px" : "0px",
        transition: "padding-bottom 0.3s",
        zIndex: 1,
      }}>
        <MapTab
          visible={activeTab === "map"}
          initialStationId={initialStationId}
          navVisible={navVisible}
          onNavToggle={() => setNavVisible((v) => !v)}
        />

        <AnimatePresence mode="wait" initial={false}>
          {activeTab !== "map" && (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: slideDir * 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: slideDir * -16 }}
              transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
              style={{ position: "absolute", inset: 0, overflowY: "auto", overflowX: "hidden" }}
            >
              {activeTab === "analytics" && <AnalyticsTab onNavigate={handleTabChange} />}
              {activeTab === "catalog" && <CatalogTab initialStationId={initialStationId} />}
              {activeTab === "vault" && <VaultTab initialPurchaseId={initialPurchaseId} />}
              {activeTab === "reserve" && <ReserveTab />}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <BottomNav
        active={activeTab}
        onChange={handleTabChange}
        visible={navVisible}
        badges={crisisCount > 0 ? { catalog: crisisCount } : {}}
      />
    </ErrorBoundary>
  );
}
