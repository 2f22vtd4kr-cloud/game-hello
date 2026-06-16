import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { sendAiMessage } from "@/api/client";
import { useUserStore } from "@/stores/useUserStore";
import { useStationStore } from "@/stores/useStationStore";
import { useEmpireStore } from "@/stores/useEmpireStore";
import type { AiMessage, TabId, TicketSuggestion } from "@/types";
import { Bot, MapPin, Fuel, Send, X, ShoppingCart } from "lucide-react";

interface Props {
  onNavigate?: (tab: TabId) => void;
}

const LS_KEY = (uid: number) => `ai_history_${uid}`;
const MAX_STORED = 20;

function loadHistory(uid: number): AiMessage[] {
  try {
    const raw = localStorage.getItem(LS_KEY(uid));
    if (raw) return JSON.parse(raw) as AiMessage[];
  } catch { /* ignore */ }
  return [];
}

function saveHistory(uid: number, msgs: AiMessage[]) {
  try {
    localStorage.setItem(LS_KEY(uid), JSON.stringify(msgs.slice(-MAX_STORED)));
  } catch { /* ignore */ }
}

function makeWelcome(): AiMessage {
  return {
    role: "bot",
    ts: Date.now(),
    text: `🤖 Добро пожаловать! Я — **КризисБот**, ИИ-советник по топливу.\n\nПомогу найти АЗС, сравнить цены, купить талон и подготовиться к кризису.\n\nПросто напишите вопрос или выберите подсказку ниже.`,
  };
}

// ── Simple markdown renderer ─────────────────────────────────────────────────
function MarkdownText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <span style={{ display: "block" }}>
      {lines.map((line, li) => {
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        const rendered = parts.map((p, pi) => {
          if (p.startsWith("**") && p.endsWith("**")) {
            return (
              <strong key={pi} style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                {p.slice(2, -2)}
              </strong>
            );
          }
          return <span key={pi}>{p}</span>;
        });
        return (
          <span key={li}>
            {rendered}
            {li < lines.length - 1 && <br />}
          </span>
        );
      })}
    </span>
  );
}

// ── Ticket suggestion block ───────────────────────────────────────────────────
function TicketSuggestionBlock({
  suggestion,
  onBuy,
  onDismiss,
}: {
  suggestion: TicketSuggestion;
  onBuy: () => void;
  onDismiss: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.93, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.93 }}
      transition={{ type: "spring", damping: 20, stiffness: 280 }}
      style={{
        marginTop: "8px",
        padding: "10px 12px",
        background: "linear-gradient(135deg, rgba(168,85,247,0.15), rgba(219,39,119,0.12))",
        border: "1px solid rgba(168,85,247,0.35)",
        borderRadius: "12px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <Fuel size={14} style={{ color: "var(--accent-primary)", flexShrink: 0 }} />
        <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600 }}>
          {suggestion.label}
        </span>
      </div>
      <div style={{ display: "flex", gap: "6px" }}>
        <motion.button
          whileTap={{ scale: 0.93 }}
          onClick={onBuy}
          style={{
            flex: 1,
            padding: "7px 0",
            borderRadius: "8px",
            background: "linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))",
            border: "none",
            color: "#fff",
            fontSize: "0.74rem",
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "4px",
            boxShadow: "var(--glow-primary)",
          }}
        >
          <ShoppingCart size={12} />
          Купить
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.93 }}
          onClick={onDismiss}
          style={{
            padding: "7px 12px",
            borderRadius: "8px",
            background: "var(--bg-glass)",
            border: "1px solid var(--border-glass)",
            color: "var(--text-tertiary)",
            fontSize: "0.74rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <X size={11} />
          Нет
        </motion.button>
      </div>
    </motion.div>
  );
}

// ── VPN fallback banner with animated arrow ──────────────────────────────────
function VpnFallbackBanner({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDone, 4000);
    return () => clearTimeout(id);
  }, [onDone]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      style={{
        position: "fixed",
        bottom: "160px",
        left: "12px",
        right: "12px",
        zIndex: 200,
        background: "linear-gradient(135deg, rgba(234,179,8,0.18), rgba(234,179,8,0.08))",
        border: "1px solid rgba(234,179,8,0.45)",
        borderRadius: "14px",
        padding: "10px 14px 14px",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
      }}
    >
      <p style={{ fontSize: "0.76rem", color: "#fde047", fontWeight: 600 }}>
        🔐 ИИ не отвечает — включи VPN
      </p>
      <p style={{ fontSize: "0.68rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
        Нажми кнопку VPN внизу слева для доступа к зарубежным сервисам.
      </p>
      {/* Animated arrow pointing down-left */}
      <div style={{ position: "relative", height: "36px" }}>
        <motion.svg
          width="56"
          height="36"
          viewBox="0 0 56 36"
          style={{ position: "absolute", left: "0", bottom: "0" }}
          animate={{ y: [0, 4, 0] }}
          transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
        >
          <defs>
            <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="#fde047" />
            </marker>
          </defs>
          <path
            d="M 48,4 Q 20,8 12,30"
            stroke="#fde047"
            strokeWidth="2"
            fill="none"
            strokeDasharray="4 3"
            markerEnd="url(#arrowhead)"
          />
        </motion.svg>
      </div>
    </motion.div>
  );
}

// ── Typing dots ───────────────────────────────────────────────────────────────
function BotThinking() {
  return (
    <div style={{ display: "flex", gap: "5px", padding: "12px 16px", alignItems: "center" }}>
      {[0, 0.18, 0.36].map((delay, i) => (
        <motion.div
          key={i}
          animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.7, delay, repeat: Infinity, ease: "easeInOut" }}
          style={{
            width: "8px", height: "8px", borderRadius: "50%",
            background: "var(--accent-fuel)",
            boxShadow: "0 0 6px var(--accent-fuel)",
          }}
        />
      ))}
      <span style={{ fontSize: "0.72rem", color: "var(--text-tertiary)", marginLeft: "6px" }}>
        КризисБот думает...
      </span>
    </div>
  );
}

// ── Chat bubble ───────────────────────────────────────────────────────────────
function ChatBubble({
  msg,
  onBuyTicket,
  onDismissTicket,
}: {
  msg: AiMessage;
  onBuyTicket?: (ts: TicketSuggestion) => void;
  onDismissTicket?: (msgTs: number) => void;
}) {
  const isBot = msg.role === "bot";
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", damping: 22, stiffness: 280 }}
      style={{
        display: "flex",
        justifyContent: isBot ? "flex-start" : "flex-end",
        marginBottom: "10px",
        paddingLeft: isBot ? 0 : "18%",
        paddingRight: isBot ? "18%" : 0,
      }}
    >
      {isBot && (
        <div style={{
          width: "28px", height: "28px", borderRadius: "50%", flexShrink: 0,
          background: "linear-gradient(135deg, var(--accent-fuel), #f59e0b)",
          display: "flex", alignItems: "center", justifyContent: "center",
          marginRight: "8px", marginTop: "2px",
          boxShadow: "var(--glow-fuel)",
        }}>
          <Bot size={14} style={{ color: "#fff" }} />
        </div>
      )}
      <div style={{ maxWidth: "100%", minWidth: 0 }}>
        <div style={{
          background: isBot
            ? "var(--bg-glass)"
            : "linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))",
          backdropFilter: isBot ? "var(--blur-glass)" : "none",
          WebkitBackdropFilter: isBot ? "var(--blur-glass)" : "none",
          border: isBot ? "1px solid var(--border-glass)" : "none",
          borderTopColor: isBot ? "rgba(255,255,255,0.22)" : undefined,
          borderRadius: isBot ? "4px 18px 18px 18px" : "18px 4px 18px 18px",
          padding: "10px 14px",
          boxShadow: isBot ? "var(--shadow-glass)" : "var(--glow-primary)",
        }}>
          <p style={{
            fontSize: "0.82rem", lineHeight: 1.55,
            color: "var(--text-primary)",
            wordBreak: "break-word",
            margin: 0,
          }}>
            <MarkdownText text={msg.text} />
          </p>
        </div>
        {/* Ticket suggestion block */}
        <AnimatePresence>
          {isBot && msg.ticket_suggestion && !msg.dismissed_ticket && (
            <TicketSuggestionBlock
              key="ticket"
              suggestion={msg.ticket_suggestion}
              onBuy={() => onBuyTicket?.(msg.ticket_suggestion!)}
              onDismiss={() => onDismissTicket?.(msg.ts)}
            />
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ── Dynamic chips ─────────────────────────────────────────────────────────────
function getDynamicChips(crisisPct: number, remainingL: number, empireLevel: number) {
  const chips: { label: string; query: string }[] = [];

  if (remainingL <= 0) {
    chips.push({ label: "⛽ Лимит исчерпан", query: "Мой суточный лимит исчерпан, что делать?" });
  } else if (remainingL < 20) {
    chips.push({ label: `⚠️ Осталось ${remainingL}л`, query: "Мне мало бензина, нужно топливо" });
  }

  if (crisisPct > 30) {
    chips.push({ label: "🚨 Острый кризис", query: "Прогноз кризиса — ситуация очень плохая?" });
  } else {
    chips.push({ label: "📊 Прогноз", query: "Каков прогноз кризиса?" });
  }

  chips.push({ label: "📍 Найти рядом", query: "Найди ближайшие АЗС с наличием топлива" });
  chips.push({ label: "🎫 Купить талоны", query: "Хочу купить топливный талон" });

  if (empireLevel > 1) {
    chips.push({ label: "🏰 Империя", query: "Как прокачать Империю быстрее?" });
  } else {
    chips.push({ label: "💰 Цены", query: "Сколько стоит АИ-95 сейчас?" });
  }

  return chips.slice(0, 4);
}

// ─── Main component ───────────────────────────────────────────────────────────
export function AiTab({ onNavigate }: Props) {
  const { user }     = useUserStore();
  const { stations } = useStationStore();
  const empireStore  = useEmpireStore();

  const uid = user?.id ?? 0;

  const [messages, setMessages]     = useState<AiMessage[]>(() => {
    if (uid) {
      const stored = loadHistory(uid);
      return stored.length ? stored : [makeWelcome()];
    }
    return [makeWelcome()];
  });
  const [input, setInput]           = useState("");
  const [thinking, setThinking]     = useState(false);
  const [showVpn, setShowVpn]       = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  // ── Computed context ────────────────────────────────────────────────────────
  const crisisCount = stations.filter(s => {
    const avg = s.fuel_statuses.length
      ? s.fuel_statuses.reduce((a, b) => a + b.availability_pct, 0) / s.fuel_statuses.length
      : 100;
    return avg < 25;
  }).length;
  const crisisPct = stations.length ? Math.round(crisisCount / stations.length * 100) : 0;

  const empireData   = empireStore.data;
  const empireLevel  = empireData?.empire_level ?? 1;
  const empireCoins  = empireData?.coins ?? 0;
  const dailyMax     = 60;
  const dailyUsed    = 0;
  const remainingL   = Math.max(0, dailyMax - dailyUsed);

  const dynamicChips = getDynamicChips(crisisPct, remainingL, empireLevel);

  // ── Persist history ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (uid) saveHistory(uid, messages);
  }, [messages, uid]);

  // ── Auto-scroll ─────────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  // ── Navigation detection from bot reply ─────────────────────────────────────
  const detectNavigation = useCallback((text: string) => {
    const t = text.toLowerCase();
    if (t.includes("открываю карту") || t.includes("вкладку карта")) onNavigate?.("map");
    else if (t.includes("открываю каталог") || t.includes("каталог талонов")) onNavigate?.("catalog");
    else if (t.includes("вкладку резерв") || t.includes("открыть резерв")) onNavigate?.("games");
  }, [onNavigate]);

  // ── Build history for backend ────────────────────────────────────────────────
  const buildBackendHistory = useCallback((msgs: AiMessage[]) => {
    return msgs.slice(-8).map(m => ({
      role: m.role === "bot" ? "assistant" : "user",
      content: m.text,
    }));
  }, []);

  // ── Send message ─────────────────────────────────────────────────────────────
  const send = async (text: string) => {
    if (!text.trim() || thinking) return;
    const userMsg: AiMessage = { role: "user", text: text.trim(), ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setThinking(true);
    setShowVpn(false);

    try {
      const context = {
        crisis_stations: crisisCount,
        user_id:         uid,
        total_stations:  stations.length,
        region:          "Севастополь",
        daily_used:      dailyUsed,
        daily_max:       dailyMax,
        empire_coins:    empireCoins,
        empire_level:    empireLevel,
      };
      const history = buildBackendHistory(messages);
      const res = await sendAiMessage(userMsg.text, context, history);

      const botMsg: AiMessage = {
        role: "bot",
        text: res.reply,
        ts:   Date.now(),
        ticket_suggestion: res.ticket_suggestion ?? null,
        vpn_fallback:      res.vpn_fallback ?? false,
      };

      setMessages(prev => [...prev, botMsg]);
      if (res.vpn_fallback) setShowVpn(true);
      detectNavigation(res.reply);
    } catch {
      const errMsg: AiMessage = {
        role: "bot",
        text: "⚠️ Сервер недоступен. Попробуйте чуть позже или откройте **Карту** для поиска АЗС.",
        ts: Date.now(),
        vpn_fallback: true,
      };
      setMessages(prev => [...prev, errMsg]);
      setShowVpn(true);
    } finally {
      setThinking(false);
    }
  };

  // ── Ticket actions ────────────────────────────────────────────────────────────
  const handleBuyTicket = (_ts: TicketSuggestion) => {
    onNavigate?.("catalog");
  };

  const handleDismissTicket = (msgTs: number) => {
    setMessages(prev => prev.map(m => m.ts === msgTs ? { ...m, dismissed_ticket: true } : m));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      height: "100%", minHeight: 0,
      background: "transparent",
      position: "relative",
    }}>
      {/* VPN fallback banner */}
      <AnimatePresence>
        {showVpn && <VpnFallbackBanner onDone={() => setShowVpn(false)} />}
      </AnimatePresence>

      {/* Header */}
      <div style={{
        padding: "14px 16px 10px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", gap: "10px",
        flexShrink: 0,
      }}>
        <div style={{
          width: "36px", height: "36px", borderRadius: "50%",
          background: "linear-gradient(135deg, var(--accent-fuel), #f59e0b)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "var(--glow-fuel)",
        }}>
          <Bot size={18} style={{ color: "#fff" }} />
        </div>
        <div>
          <p style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text-primary)" }}>
            КризисБот
          </p>
          <p style={{ fontSize: "0.63rem", color: thinking ? "var(--accent-fuel)" : "var(--accent-success)", display: "flex", alignItems: "center", gap: "4px" }}>
            <motion.span
              animate={{ opacity: thinking ? [1, 0.3, 1] : 1 }}
              transition={{ duration: 0.9, repeat: thinking ? Infinity : 0 }}
              style={{ width: "5px", height: "5px", borderRadius: "50%", background: "currentColor", display: "inline-block" }}
            />
            {thinking ? "Думает..." : `Онлайн · ${crisisPct}% станций в кризисе`}
          </p>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: "6px" }}>
          <button
            onClick={() => onNavigate?.("map")}
            title="Карта"
            className="btn-glass"
            style={{ width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
          >
            <MapPin size={14} style={{ color: "var(--accent-primary)" }} />
          </button>
          <button
            onClick={() => onNavigate?.("catalog")}
            title="Талоны"
            className="btn-glass"
            style={{ width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
          >
            <Fuel size={14} style={{ color: "var(--accent-secondary)" }} />
          </button>
          {messages.length > 2 && (
            <button
              onClick={() => {
                setMessages([makeWelcome()]);
                if (uid) localStorage.removeItem(LS_KEY(uid));
              }}
              title="Очистить чат"
              className="btn-glass"
              style={{ width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
            >
              <X size={13} style={{ color: "var(--text-tertiary)" }} />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: "auto", overflowX: "hidden",
        padding: "14px 12px",
        display: "flex", flexDirection: "column",
      }}>
        <AnimatePresence initial={false}>
          {messages.map(msg => (
            <ChatBubble
              key={msg.ts}
              msg={msg}
              onBuyTicket={handleBuyTicket}
              onDismissTicket={handleDismissTicket}
            />
          ))}
        </AnimatePresence>
        {thinking && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="glass-panel"
            style={{ alignSelf: "flex-start", marginBottom: "10px" }}
          >
            <BotThinking />
          </motion.div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Dynamic quick chips */}
      <div style={{
        padding: "8px 12px 4px",
        display: "flex", gap: "6px", overflowX: "auto",
        flexShrink: 0,
        borderTop: "1px solid rgba(255,255,255,0.05)",
        scrollbarWidth: "none",
      }}>
        {dynamicChips.map(chip => (
          <motion.button
            key={chip.label}
            onClick={() => void send(chip.query)}
            disabled={thinking}
            whileTap={{ scale: 0.93 }}
            style={{
              flexShrink: 0,
              background: "var(--bg-glass)",
              border: "1px solid var(--border-glass)",
              borderRadius: "999px",
              padding: "5px 11px",
              fontSize: "0.68rem",
              color: "var(--text-secondary)",
              cursor: thinking ? "default" : "pointer",
              whiteSpace: "nowrap",
              opacity: thinking ? 0.5 : 1,
              transition: "all 0.15s",
            }}
          >
            {chip.label}
          </motion.button>
        ))}
      </div>

      {/* Input row */}
      <form
        onSubmit={handleSubmit}
        style={{
          padding: "8px 12px 10px",
          display: "flex", gap: "8px", alignItems: "flex-end",
          flexShrink: 0,
        }}
      >
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Спросите об АЗС, талонах, кризисе..."
          style={{
            flex: 1,
            background: "var(--bg-glass)",
            border: "1px solid var(--border-glass)",
            borderRadius: "16px",
            padding: "10px 14px",
            color: "var(--text-primary)",
            fontSize: "0.82rem",
            outline: "none",
            transition: "border-color 0.2s",
          }}
          onFocus={e => (e.target.style.borderColor = "var(--accent-primary)")}
          onBlur={e => (e.target.style.borderColor = "var(--border-glass)")}
        />
        <motion.button
          type="submit"
          disabled={!input.trim() || thinking}
          whileTap={{ scale: 0.9 }}
          style={{
            width: "40px", height: "40px", flexShrink: 0,
            borderRadius: "50%",
            background: input.trim() && !thinking
              ? "linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))"
              : "var(--bg-glass)",
            border: "1px solid var(--border-glass)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: input.trim() && !thinking ? "pointer" : "default",
            transition: "all 0.2s",
            boxShadow: input.trim() && !thinking ? "var(--glow-primary)" : "none",
          }}
        >
          <Send size={16} style={{ color: input.trim() && !thinking ? "#fff" : "var(--text-tertiary)" }} />
        </motion.button>
      </form>
    </div>
  );
}
