import { useEffect, useState } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ToastContainer } from "@/components/Toast";
import { BottomNav } from "@/components/BottomNav";
import { MapTab } from "@/components/MapTab";
import { AnalyticsTab } from "@/components/AnalyticsTab";
import { CatalogTab } from "@/components/CatalogTab";
import { VaultTab } from "@/components/VaultTab";
import { ReserveTab } from "@/components/ReserveTab";
import { useUserStore } from "@/stores/useUserStore";
import { useStationStore } from "@/stores/useStationStore";
import type { TabId } from "@/types";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        initDataUnsafe?: {
          user?: { id: number; username?: string; first_name?: string };
        };
        setHeaderColor: (color: string) => void;
        setBackgroundColor: (color: string) => void;
        MainButton: { hide: () => void };
      };
    };
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("map");
  const { init } = useUserStore();
  const { fetch: fetchStations } = useStationStore();

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      try {
        tg.setHeaderColor("#050507");
        tg.setBackgroundColor("#050507");
        tg.MainButton.hide();
      } catch {}
    }

    // Get user identity from Telegram WebApp or use a dev fallback
    const tgUser = tg?.initDataUnsafe?.user;
    const userId = tgUser?.id ?? 0;
    const username = tgUser?.username ?? tgUser?.first_name ?? undefined;

    init(userId, username);
    fetchStations();
  }, [init, fetchStations]);

  const BOTTOM_NAV_HEIGHT = "60px";

  return (
    <ErrorBoundary>
      <ToastContainer />

      {/* Main content area */}
      <div style={{
        flex: 1,
        position: "relative",
        overflow: "hidden",
        paddingBottom: BOTTOM_NAV_HEIGHT,
      }}>
        {/* Map is always mounted to preserve viewport state */}
        <MapTab visible={activeTab === "map"} />

        {/* Other tabs render only when active */}
        {activeTab === "analytics" && (
          <div style={{ position: "absolute", inset: 0, overflowY: "auto" }}>
            <AnalyticsTab />
          </div>
        )}
        {activeTab === "catalog" && (
          <div style={{ position: "absolute", inset: 0, overflowY: "auto" }}>
            <CatalogTab />
          </div>
        )}
        {activeTab === "vault" && (
          <div style={{ position: "absolute", inset: 0, overflowY: "auto" }}>
            <VaultTab />
          </div>
        )}
        {activeTab === "reserve" && (
          <div style={{ position: "absolute", inset: 0, overflowY: "auto" }}>
            <ReserveTab />
          </div>
        )}
      </div>

      <BottomNav active={activeTab} onChange={setActiveTab} />
    </ErrorBoundary>
  );
}
