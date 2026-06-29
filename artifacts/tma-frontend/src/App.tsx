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
import { NewsTab } from "@/components/NewsTab";
import { AiTab } from "@/components/AiTab";
import { GamesTab } from "@/components/GamesTab";
import { VaultTab } from "@/components/VaultTab";
import { VpnModal } from "@/components/VpnModal";
import { IntroSplash } from "@/components/IntroSplash";
import { AdminPanel } from "@/components/AdminPanel";
import { AdminPasswordGate } from "@/components/AdminPasswordGate";
import { OnboardingTour } from "@/components/OnboardingTour";
import { useUserStore } from "@/stores/useUserStore";
import { useStationStore } from "@/stores/useStationStore";
import { useMapStore } from "@/stores/useMapStore";
import { usePriceStore } from "@/stores/usePriceStore";
import { useVaultStore } from "@/stores/useVaultStore";
import { fetchNews } from "@/api/client";
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
  disableVerticalSwipes: () => void;
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
const AI_BANNER_KEY = "tma-ai-banner-dismissed-v1";
const NEWS_LAST_VISIT_KEY = "tma-news-last-visit";
const TICKER_H = 0;

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>(DEFAULT_TAB);
  const [initialStationId, setInitialStationId] = useState<number | undefined>();
  const [initialPurchaseId, setInitialPurchaseId] = useState<number | undefined>();
  const [navVisible, setNavVisible] = useState(true);
  const [catalogSuccess, setCatalogSuccess] = useState(false);
  const [showVpn, setShowVpn] = useState(false);
  const [vpnActive, setVpnActive] = useState(false);
  const [vpnTroubleshooter, setVpnTroubleshooter] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [showMapHint, setShowMapHint] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminPass, setAdminPass] = useState("");
  const [showWallet, setShowWallet] = useState(false);
  const [showAiBanner, setShowAiBanner] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [newsBadgeCount, setNewsBadgeCount] = useState(0);
  const vpnSuggested = useRef(false);
  const adminPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { init: initUser } = useUserStore();
  const { fetch: fetchStations, stations } = useStationStore();
  const { selectStation } = useMapStore();
  const { initPrices, connectWs, priceAlerts, dismissAlert } = usePriceStore();
  const { purchases } = useVaultStore();

  const crisisCount = stations.reduce((n, s) => {
    const avg = s.fuel_statuses.length
      ? s.fuel_statuses.reduce((a, b) => a + b.availability_pct, 0) / s.fuel_statuses.length
      : 100;
    return avg < 25 ? n + 1 : n;
  }, 0);

  const activeNetworkVoucherCount = purchases.filter(
    (p) => p.status === "active" && p.station_name?.startsWith("Любая АЗС сети ")
  ).length;

  // ── Price store + WebSocket live feed ───────────────────────────
  useEffect(() => {
    void initPrices();
    const disconnect = connectWs();
    return disconnect;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── News badge — count critical+warning items since last visit ───
  useEffect(() => {
    const lastVisit = parseInt(localStorage.getItem(NEWS_LAST_VISIT_KEY) ?? "0", 10);
    fetchNews(undefined, 30)
      .then((items) => {
        const unread = items.filter((n) => {
          const isImportant = n.severity === "critical" || n.severity === "warning";
          const isNew = new Date(n.created_at).getTime() > lastVisit;
          return isImportant && isNew;
        });
        if (unread.length > 0) setNewsBadgeCount(unread.length);
      })
      .catch(() => {});
    const onReadAll = () => setNewsBadgeCount(0);
    window.addEventListener("tma-news-read-all", onReadAll);
    return () => window.removeEventListener("tma-news-read-all", onReadAll);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── AI suggestion banner (Phase 4.3): show if last purchase >7d ─
  useEffect(() => {
    if (localStorage.getItem(AI_BANNER_KEY)) return;
    const check = () => {
      if (purchases.length === 0) return; // wait for vault to load
      const last = purchases.reduce<Date | null>((max, p) => {
        const d = new Date(p.created_at);
        return !max || d > max ? d : max;
      }, null);
      if (!last) return;
      const daysSince = (Date.now() - last.getTime()) / 86_400_000;
      if (daysSince > 7) setShowAiBanner(true);
    };
    check();
  }, [purchases]);

  const backCbRef = useRef<(() => void) | null>(null);

  // ── SDK init ────────────────────────────────────────────────────
  useEffect(() => {
    const tg = window.Telegram?.WebApp;

    if (tg) {
      tg.ready();
      tg.expand();
      try { tg.disableVerticalSwipes(); } catch {}

      try {
        tg.setHeaderColor("#1318B0");
        tg.setBackgroundColor("#1318B0");
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

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("admin") === "1") {
      setShowAdmin(true);
    }
    const urlTab = urlParams.get("tab") as TabId | null;
    const validTabs: TabId[] = ["map", "analytics", "catalog", "news"];
    if (urlTab && validTabs.includes(urlTab)) {
      setActiveTab(urlTab);
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

  // ── Wallet event bridge ─────────────────────────────────────────
  useEffect(() => {
    const openWallet = () => setShowWallet(true);
    window.addEventListener("tma-open-wallet", openWallet);
    return () => window.removeEventListener("tma-open-wallet", openWallet);
  }, []);

  // ── Catalog success mode — hide all UI except Карман ────────────
  useEffect(() => {
    const onSuccess = (e: Event) => setCatalogSuccess((e as CustomEvent<boolean>).detail);
    window.addEventListener("tma-catalog-success", onSuccess);
    return () => window.removeEventListener("tma-catalog-success", onSuccess);
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
    if (tab === "news") {
      setNewsBadgeCount(0);
      localStorage.setItem(NEWS_LAST_VISIT_KEY, Date.now().toString());
    }
  };

  // ── Splash done → show onboarding for first-timers ──────────────
  const handleSplashDone = () => {
    localStorage.setItem(SPLASH_KEY, "1");
    setShowSplash(false);
    setShowMapHint(true);
    setTimeout(() => setShowMapHint(false), 3500);
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

  const tabOrder: TabId[] = ["map", "analytics", "catalog", "news"];
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
        <div style={{ position: "absolute", top: "-10%", right: "-15%", width: 360, height: 360, background: "rgba(232,98,42,0.08)", borderRadius: "50%", filter: "blur(120px)" }} />
        <div style={{ position: "absolute", bottom: "-10%", left: "-15%", width: 400, height: 400, background: "rgba(232,98,42,0.05)", borderRadius: "50%", filter: "blur(120px)" }} />
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
        {showMapHint && (
          <motion.div
            key="map-hint"
            initial={{ opacity: 0, y: 24, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.95 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 9999,
              pointerEvents: "none",
              background: "rgba(13,14,80,0.93)",
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: "20px",
              padding: "0.75rem 1.4rem",
              display: "flex",
              alignItems: "center",
              gap: "0.55rem",
              boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(232,98,42,0.15)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
            }}
          >
            <motion.span
              animate={{ scale: [1, 1.25, 1] }}
              transition={{ repeat: Infinity, duration: 1.1, ease: "easeInOut" }}
              style={{ fontSize: "1.3rem", lineHeight: 1 }}
            >🤏</motion.span>
            <span style={{
              color: "#fff",
              fontSize: "0.88rem",
              fontWeight: 600,
              letterSpacing: "0.01em",
              lineHeight: 1.3,
            }}>
              Подожди — сейчас подгрузим<br />
              <span style={{ color: "#E8622A" }}>АЗС на карте</span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showOnboarding && !showSplash && (
          <OnboardingTour onDone={handleOnboardingDone} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAdmin && isAdminAuthenticated && <AdminPanel onClose={() => setShowAdmin(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {showAdmin && !isAdminAuthenticated && (
          <AdminPasswordGate
            onAuth={(pass) => { setIsAdminAuthenticated(true); setAdminPass(pass); }}
            onCancel={() => setShowAdmin(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showVpn && (
          <VpnModal
            isTroubleshooter={vpnTroubleshooter}
            onClose={() => { setShowVpn(false); setVpnTroubleshooter(false); }}
            onSessionChange={setVpnActive}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showWallet && (
          <motion.div
            key="wallet-overlay"
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.25 }}
            onDragEnd={(_e, info) => { if (info.offset.y > 100 || info.velocity.y > 500) setShowWallet(false); }}
            style={{
              position: "fixed", inset: 0, zIndex: 9200,
              background: "var(--bg-base)",
              overflowY: "auto", overflowX: "hidden",
              paddingTop: `${TICKER_H + 8}px`, paddingBottom: "20px",
              touchAction: "none",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px 4px" }}>
              <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>🎟️ Карман</h2>
              <button
                onClick={() => setShowWallet(false)}
                style={{ background: "var(--bg-glass)", border: "1px solid var(--border-glass)", borderRadius: "50%", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-muted)", fontSize: "1.1rem" }}
              >×</button>
            </div>
            <VaultTab initialPurchaseId={initialPurchaseId} onNavigate={(tab) => { setShowWallet(false); handleTabChange(tab); }} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* VPN floating button */}
      <style>{`@keyframes vpnGlow{0%,100%{box-shadow:0 0 8px #22c55e88,0 0 18px #22c55e44}50%{box-shadow:0 0 16px #22c55ecc,0 0 32px #22c55e66}}`}</style>
      <button
        onClick={() => { setVpnTroubleshooter(false); setShowVpn(true); }}
        title="VPN-доступ"
        style={{
          position: "fixed",
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)",
          left: "12px",
          zIndex: 9500,
          width: "44px", height: "44px",
          borderRadius: "10px",
          background: vpnActive ? "#22c55e" : "#E8622A",
          border: "none",
          animation: vpnActive ? "vpnGlow 2s ease-in-out infinite" : "none",
          cursor: "pointer",
          display: catalogSuccess ? "none" : "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 2px 12px rgba(0,0,0,0.35)",
          transition: "background 0.4s",
        }}
      >
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.62rem", fontWeight: 800, color: "#ffffff", letterSpacing: "0.04em" }}>VPN</span>
      </button>

      {/* Universal nav hide/show pill — visible on all tabs, hidden on success */}
      <button
        onClick={() => setNavVisible((v) => !v)}
        title={navVisible ? "Скрыть навигацию" : "Показать навигацию"}
        style={{
          position: "fixed",
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)",
          left: calcOpen ? "33%" : "50%",
          display: catalogSuccess ? "none" : "flex",
          alignItems: "center", justifyContent: "center", gap: "4px",
          transform: "translateX(-50%)",
          transition: "left 0.25s cubic-bezier(0.25,0.46,0.45,0.94)",
          zIndex: 10001,
          background: "rgba(8,8,20,0.88)",
          border: "1px solid #1e1e2a",
          borderRadius: "999px",
          padding: "3px 12px",
          cursor: "pointer",
          backdropFilter: "blur(12px)",
        }}
      >
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.38rem", color: "#4b5563", letterSpacing: "0.08em" }}>
          {navVisible ? "▼ СКРЫТЬ" : "▲ МЕНЮ"}
        </span>
      </button>

      {/* Wallet floating button */}
      <div style={{ position: "fixed", bottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)", right: "12px", zIndex: 9500 }}>
        {(() => {
          const activeCount = purchases.filter((p) => p.status === "active").length;
          return (
            <>
              {activeCount > 0 && (
                <motion.div
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  style={{
                    position: "absolute", top: "-4px", right: "-4px",
                    background: "linear-gradient(135deg,#E8622A,#E8622A)",
                    color: "#fff", borderRadius: "999px",
                    minWidth: "16px", height: "16px",
                    fontSize: "0.44rem", fontWeight: 800,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "0 3px",
                    boxShadow: "0 0 8px rgba(232,98,42,0.7)",
                    border: "1.5px solid rgba(8,8,16,0.9)",
                    zIndex: 1,
                  }}
                >
                  {activeCount}
                </motion.div>
              )}
              <motion.button
                onClick={() => setShowWallet(true)}
                whileTap={{ scale: 0.9 }}
                title="Карман"
                style={{
                  width: "44px", height: "44px",
                  borderRadius: "10px",
                  background: "linear-gradient(160deg, #1E22DC, #1318B0)",
                  border: "1px solid rgba(100,120,255,0.3)",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.35), 0 0 20px rgba(30,34,220,0.35)",
                  cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1.2rem",
                }}
              >
                🎟️
              </motion.button>
            </>
          );
        })()}
      </div>

      {/* AI Suggestion Banner (Phase 4.3) */}
      <AnimatePresence>
        {showAiBanner && (
          <motion.div
            key="ai-banner"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25 }}
            style={{
              position: "fixed", top: `${TICKER_H + 4}px`, left: "12px", right: "12px",
              zIndex: 9750,
              background: "linear-gradient(135deg, rgba(232,98,42,0.15), rgba(232,98,42,0.1))",
              border: "1px solid rgba(232,98,42,0.3)",
              borderRadius: "12px", padding: "8px 12px",
              backdropFilter: "blur(12px)",
              boxShadow: "0 4px 20px rgba(232,98,42,0.2)",
              display: "flex", alignItems: "center", gap: "8px",
            }}
          >
            <span style={{ fontSize: "1rem", flexShrink: 0 }}>💡</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: "#e2e8f0", fontSize: "0.72rem", fontWeight: 600, margin: "0 0 1px" }}>
                ИИ-подсказка: ситуация в регионе ухудшилась
              </p>
              <p style={{ color: "#9ca3af", fontSize: "0.62rem", margin: 0 }}>
                Запасы на АЗС снизились. Рекомендуем пополнить талоны.
              </p>
            </div>
            <button
              onClick={() => { handleTabChange("catalog"); setShowAiBanner(false); localStorage.setItem(AI_BANNER_KEY, "1"); }}
              style={{
                background: "linear-gradient(135deg,#E8622A,#E8622A)", border: "none",
                borderRadius: "7px", color: "#fff", fontSize: "0.62rem", fontWeight: 700,
                padding: "4px 8px", cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap",
              }}
            >Талоны</button>
            <button
              onClick={() => { setShowAiBanner(false); localStorage.setItem(AI_BANNER_KEY, "1"); }}
              style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: "1rem", padding: "0 2px", flexShrink: 0, lineHeight: 1 }}
            >×</button>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Phone-width clamp — ensures proper mobile rendering in canvas/iframe previews */}
      <style>{`body{max-width:430px;margin:0 auto;overflow-x:hidden}`}</style>

      {/* Ambient dot-grid */}
      <div aria-hidden style={{
        position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
        backgroundImage: "radial-gradient(circle, rgba(232,98,42,0.07) 1px, transparent 1px)",
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
        paddingTop: 0,
        paddingBottom: "96px",
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
              style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, overflowY: "auto", overflowX: "hidden" }}
            >
              {activeTab === "analytics" && <AnalyticsTab />}
              {activeTab === "catalog"   && <CatalogTab initialStationId={initialStationId} onCalcOpenChange={setCalcOpen} isAdmin={isAdminAuthenticated} adminPass={adminPass} />}
              {activeTab === "news"      && <NewsTab onNavigate={handleTabChange} />}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <BottomNav
        active={activeTab}
        onChange={handleTabChange}
        visible={navVisible && !catalogSuccess}
        badges={{
          ...(crisisCount > 0 || activeNetworkVoucherCount > 0
            ? { catalog: (crisisCount > 0 ? crisisCount : 0) + activeNetworkVoucherCount }
            : {}),
          ...(newsBadgeCount > 0 ? { news: newsBadgeCount } : {}),
        }}
      />
    </ErrorBoundary>
  );
}
