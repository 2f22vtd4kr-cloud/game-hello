/**
 * Telegram WebApp HapticFeedback helpers.
 * All calls are safe no-ops when running outside Telegram WebView.
 */

type ImpactStyle = "light" | "medium" | "heavy" | "rigid" | "soft";
type NotificationType = "error" | "success" | "warning";

/** Trigger a physical impact sensation — use on button presses. */
export function impact(style: ImpactStyle = "medium"): void {
  try {
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(style);
  } catch {}
}

/** Trigger a notification sensation — use on success/error toasts. */
export function notify(type: NotificationType): void {
  try {
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred(type);
  } catch {}
}

/** Trigger a selection-change sensation — use on tab switches. */
export function select(): void {
  try {
    window.Telegram?.WebApp?.HapticFeedback?.selectionChanged();
  } catch {}
}
