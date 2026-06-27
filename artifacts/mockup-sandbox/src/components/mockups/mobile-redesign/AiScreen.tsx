import React, { useState } from "react";
import { 
  Zap, 
  Send, 
  Map as MapIcon, 
  Bot, 
  Wallet, 
  Gamepad2, 
  User,
  Shield,
  ChevronRight,
  TrendingUp
} from "lucide-react";

export function AiScreen() {
  const [inputText, setInputText] = useState("");

  const theme = {
    bg: "#08090f",
    cardGlass: "rgba(20,20,32,0.88)",
    violet: "#a78bfa",
    magenta: "#f472b6",
    cyan: "#06b6d4",
    green: "#34d399",
    yellow: "#fbbf24",
    red: "#fb7185",
    textMain: "rgba(255,255,255,0.95)",
    textMuted: "rgba(255,255,255,0.55)",
    font: "'Inter', sans-serif"
  };

  return (
    <div 
      className="relative overflow-hidden w-full max-w-[390px] mx-auto flex flex-col font-sans"
      style={{ 
        height: '844px',
        backgroundColor: theme.bg,
        color: theme.textMain,
        fontFamily: theme.font
      }}
    >
      {/* Decorative gradient orbs */}
      <div 
        className="absolute top-[-100px] left-[-50px] w-[300px] h-[300px] rounded-full blur-[100px] pointer-events-none opacity-20"
        style={{ backgroundColor: theme.violet }}
      />
      <div 
        className="absolute bottom-[100px] right-[-50px] w-[200px] h-[200px] rounded-full blur-[80px] pointer-events-none opacity-10"
        style={{ backgroundColor: theme.cyan }}
      />

      {/* Header */}
      <header 
        className="flex items-center justify-between px-4 py-3 z-10 sticky top-0"
        style={{
          backgroundColor: theme.cardGlass,
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.05)"
        }}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg"
              style={{
                background: `linear-gradient(135deg, ${theme.violet}, ${theme.magenta})`,
              }}
            >
              <Zap size={20} color="#fff" fill="#fff" />
            </div>
            <div 
              className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#08090f]"
              style={{ backgroundColor: theme.green }}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[17px] font-semibold tracking-tight">CrisisBot</h1>
            </div>
            <p className="text-[12px]" style={{ color: theme.green }}>• онлайн</p>
          </div>
        </div>
        
        {/* VPN Status Pill */}
        <div 
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-medium"
          style={{ 
            backgroundColor: "rgba(6, 182, 212, 0.15)",
            color: theme.cyan,
            border: `1px solid rgba(6, 182, 212, 0.3)`
          }}
        >
          <Shield size={12} />
          <span>VPN вкл</span>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-5 z-10">
        
        {/* Date separator */}
        <div className="text-center text-[11px] font-medium my-2" style={{ color: theme.textMuted }}>
          Сегодня
        </div>

        {/* Bot Message 1 */}
        <div className="flex gap-2 max-w-[85%]">
          <div 
            className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center mt-auto"
            style={{ background: `linear-gradient(135deg, ${theme.violet}, ${theme.magenta})` }}
          >
            <Zap size={14} color="#fff" />
          </div>
          <div className="flex flex-col gap-1">
            <div 
              className="p-3.5 rounded-2xl rounded-bl-sm text-[15px] leading-relaxed shadow-sm"
              style={{ 
                backgroundColor: theme.cardGlass,
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(255,255,255,0.05)"
              }}
            >
              Привет! Я отслеживаю топливную обстановку в реальном времени. Где ты находишься?
            </div>
            <span className="text-[10px] ml-1" style={{ color: theme.textMuted }}>14:32</span>
          </div>
        </div>

        {/* User Message */}
        <div className="flex justify-end gap-2 max-w-[85%] self-end">
          <div className="flex flex-col gap-1 items-end">
            <div 
              className="p-3.5 rounded-2xl rounded-br-sm text-[15px] leading-relaxed shadow-md"
              style={{ 
                background: `linear-gradient(135deg, ${theme.violet}, rgba(167, 139, 250, 0.8))`
              }}
            >
              Симферополь, нужен АИ-95
            </div>
            <span className="text-[10px] mr-1" style={{ color: theme.textMuted }}>14:33</span>
          </div>
        </div>

        {/* Bot Message 2 (Status) */}
        <div className="flex gap-2 max-w-[90%]">
          <div 
            className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center mt-auto"
            style={{ background: `linear-gradient(135deg, ${theme.violet}, ${theme.magenta})` }}
          >
            <Zap size={14} color="#fff" />
          </div>
          <div className="flex flex-col gap-1 w-full">
            <div 
              className="p-3.5 rounded-2xl rounded-bl-sm text-[15px] leading-relaxed shadow-sm flex flex-col gap-3"
              style={{ 
                backgroundColor: theme.cardGlass,
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(255,255,255,0.05)"
              }}
            >
              <div>🔍 Анализирую 47 АЗС в Симферополе...</div>
              
              {/* Inline Result Card */}
              <div 
                className="rounded-xl p-3 flex flex-col gap-2"
                style={{ 
                  backgroundColor: "rgba(0,0,0,0.3)",
                  border: "1px solid rgba(255,255,255,0.03)"
                }}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-[14px]">АЗС Лукойл</h4>
                    <p className="text-[12px]" style={{ color: theme.textMuted }}>ул. Гагарина 18</p>
                  </div>
                  <div className="text-right">
                    <div className="text-[12px] font-medium" style={{ color: theme.green }}>АИ-95: 68%</div>
                    <div className="text-[11px]" style={{ color: theme.textMuted }}>3 мин езды</div>
                  </div>
                </div>
                
                <button 
                  className="mt-1 w-full py-2 rounded-lg text-[13px] font-medium flex items-center justify-center gap-1 transition-opacity active:opacity-80"
                  style={{ 
                    backgroundColor: "rgba(167, 139, 250, 0.15)",
                    color: theme.violet,
                    border: `1px solid rgba(167, 139, 250, 0.3)`
                  }}
                >
                  Зарезервировать <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bot Message 3 */}
        <div className="flex gap-2 max-w-[85%]">
          <div 
            className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center mt-auto"
            style={{ background: `linear-gradient(135deg, ${theme.violet}, ${theme.magenta})` }}
          >
            <Zap size={14} color="#fff" />
          </div>
          <div className="flex flex-col gap-1">
            <div 
              className="p-3.5 rounded-2xl rounded-bl-sm text-[15px] leading-relaxed shadow-sm"
              style={{ 
                backgroundColor: theme.cardGlass,
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(255,255,255,0.05)"
              }}
            >
              <div className="flex gap-2 items-start">
                <TrendingUp size={18} className="mt-0.5 flex-shrink-0" style={{ color: theme.yellow }} />
                <span>Также рекомендую зафиксировать цену сейчас — завтра прогнозируется рост на <strong>+4.2%</strong></span>
              </div>
            </div>
          </div>
        </div>

      </main>

      {/* Quick Suggestions */}
      <div className="px-3 pb-3 pt-1 overflow-x-auto whitespace-nowrap hide-scrollbar flex gap-2 z-10">
        {["Где заправиться рядом?", "Прогноз цен", "Купить талон"].map((text, i) => (
          <button 
            key={i}
            className="px-4 py-2 rounded-full text-[13px] font-medium transition-colors"
            style={{ 
              backgroundColor: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: theme.textMain
            }}
          >
            {text}
          </button>
        ))}
      </div>

      {/* Input Area */}
      <div 
        className="p-3 z-10"
        style={{
          backgroundColor: theme.bg,
          borderTop: "1px solid rgba(255,255,255,0.05)"
        }}
      >
        <div className="flex items-end gap-2">
          <div 
            className="flex-1 rounded-2xl flex items-center px-4 py-3 min-h-[48px]"
            style={{ 
              backgroundColor: theme.cardGlass,
              border: "1px solid rgba(255,255,255,0.08)"
            }}
          >
            <input 
              type="text"
              placeholder="Задать вопрос..."
              className="bg-transparent border-none outline-none w-full text-[15px] placeholder:opacity-50"
              style={{ color: theme.textMain }}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />
          </div>
          <button 
            className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg active:scale-95 transition-transform"
            style={{ background: theme.violet }}
          >
            <Send size={18} color="#fff" className="ml-1" />
          </button>
        </div>
      </div>

      {/* Bottom Nav */}
      <nav 
        className="flex items-center justify-between px-6 py-3 pb-6 z-20"
        style={{
          backgroundColor: "rgba(8, 9, 15, 0.95)",
          backdropFilter: "blur(20px)",
          borderTop: "1px solid rgba(255,255,255,0.05)"
        }}
      >
        {[
          { icon: MapIcon, label: "Карта", active: false },
          { icon: Bot, label: "ИИ", active: true },
          { icon: Wallet, label: "Сейф", active: false },
          { icon: Gamepad2, label: "Игры", active: false },
          { icon: User, label: "Профиль", active: false },
        ].map((item, idx) => {
          const Icon = item.icon;
          const color = item.active ? theme.cyan : theme.textMuted;
          return (
            <button key={idx} className="flex flex-col items-center gap-1.5 transition-colors active:scale-95">
              <Icon 
                size={22} 
                color={color} 
                strokeWidth={item.active ? 2.5 : 2}
                style={{
                  filter: item.active ? `drop-shadow(0 0 8px ${theme.cyan}80)` : 'none'
                }}
              />
              <span 
                className="text-[10px] font-medium" 
                style={{ color }}
              >
                {item.label}
              </span>
            </button>
          )
        })}
      </nav>

      {/* Global styles for hiding scrollbar */}
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}

export default AiScreen;
