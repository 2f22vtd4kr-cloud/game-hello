/**
 * Deep-link parser for Telegram Mini App startParam.
 *
 * When the bot sends a link like:
 *   https://t.me/BotName?startapp=map_42
 *
 * Telegram sets window.Telegram.WebApp.initDataUnsafe.start_param = "map_42".
 * We parse that string here and return the initial navigation state.
 *
 * Supported payload formats:
 *   map             → Map tab, no specific station
 *   map_<id>        → Map tab, station <id> pre-selected
 *   catalog_<id>    → Catalog tab, station <id> pre-selected
 *   vault           → Vault tab (purchase history)
 *   vault_<id>      → Vault tab, purchase <id> highlighted
 *   analytics       → Analytics tab
 *   reserve         → Reserve (games) tab
 *   (empty / unknown) → default: Map tab
 */

import type { TabId } from "@/types";

export interface DeepLinkState {
  /** Which tab to open on first render */
  tab: TabId;
  /** Station to select on the map or pre-fill in catalog */
  stationId?: number;
  /** Purchase to highlight in the vault */
  purchaseId?: number;
}

/**
 * Parse a Telegram startParam string into navigation state.
 * Always returns a valid DeepLinkState (falls back to map tab on any error).
 */
export function parseStartParam(param: string | undefined | null): DeepLinkState {
  if (!param || typeof param !== "string") return { tab: "map" };

  // Payload is either "key" or "key_id"
  const underscoreIdx = param.indexOf("_");
  const key = underscoreIdx >= 0 ? param.slice(0, underscoreIdx) : param;
  const rawId = underscoreIdx >= 0 ? param.slice(underscoreIdx + 1) : undefined;
  const numId = rawId ? parseInt(rawId, 10) : undefined;
  const id = numId && !isNaN(numId) ? numId : undefined;

  switch (key) {
    case "map":
      return { tab: "map", stationId: id };

    case "catalog":
      return { tab: "catalog", stationId: id };

    case "vault":
      return { tab: "vault", purchaseId: id };

    case "analytics":
      return { tab: "analytics" };

    case "reserve":
      return { tab: "reserve" };

    default:
      // Attempt to treat the whole string as a tab name
      if (["map", "analytics", "catalog", "vault", "reserve"].includes(param as TabId)) {
        return { tab: param as TabId };
      }
      return { tab: "map" };
  }
}

/**
 * Build a startParam string from navigation state (for use in bot.py via Python).
 * This mirrors the Python `build_start_param()` helper in bot.py.
 */
export function buildStartParam(tab: TabId, id?: number): string {
  return id !== undefined ? `${tab}_${id}` : tab;
}
