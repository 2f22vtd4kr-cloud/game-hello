import React from 'react';
import { Settings, Trophy, ShoppingCart, BarChart2, Map, LayoutGrid, Gamepad2, User, Wallet } from 'lucide-react';

export function GamesScreen() {
  return (
    <div
      className="flex flex-col relative overflow-hidden"
      style={{
        width: '390px',
        height: '844px',
        backgroundColor: '#08090f',
        color: 'rgba(255,255,255,0.95)',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-12 pb-4 shrink-0 relative z-10">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold tracking-tight">Империя Топлива</h1>
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: 'rgba(167, 139, 250, 0.15)',
                color: '#a78bfa',
                border: '1px solid rgba(167, 139, 250, 0.3)',
              }}
            >
              Ур. 7 · Оперативник
            </span>
          </div>
        </div>
        <button
          className="p-2 rounded-full transition-colors active:bg-white/10"
          style={{ color: 'rgba(255,255,255,0.55)' }}
        >
          <Settings size={22} />
        </button>
      </div>

      {/* Resource bar */}
      <div className="px-5 mb-6 shrink-0 relative z-10">
        <div
          className="flex justify-between items-center rounded-2xl px-4 py-3"
          style={{
            backgroundColor: 'rgba(20,20,32,0.88)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.05)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}
        >
          <div className="flex flex-col items-center">
            <span className="text-sm mb-0.5">💰</span>
            <span className="text-sm font-bold" style={{ color: '#fbbf24' }}>12,450</span>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="flex flex-col items-center">
            <span className="text-sm mb-0.5">🛢</span>
            <span className="text-sm font-bold" style={{ color: '#06b6d4' }}>847</span>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="flex flex-col items-center">
            <span className="text-sm mb-0.5">⛽</span>
            <span className="text-sm font-bold" style={{ color: '#34d399' }}>234</span>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="flex flex-col items-center">
            <span className="text-sm mb-0.5">⭐</span>
            <span className="text-sm font-bold" style={{ color: '#a78bfa' }}>1.2k</span>
          </div>
        </div>
      </div>

      {/* Main Game Area */}
      <div className="flex-1 px-5 relative overflow-y-auto pb-48 z-10 no-scrollbar">
        {/* Decorative Grid Background for Game Area */}
        <div
          className="absolute inset-0 z-0 rounded-3xl"
          style={{
            backgroundColor: '#0f1020',
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
            transform: 'perspective(1000px) rotateX(20deg) scale(1.1)',
            transformOrigin: 'top center',
            opacity: 0.6,
          }}
        />

        <div className="relative z-10 pt-4">
          <h2 className="text-sm font-medium mb-4" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Ваши активы
          </h2>
          <div className="grid grid-cols-2 gap-4">
            
            {/* Card 1: Cyan */}
            <div
              className="flex flex-col rounded-2xl p-4 relative overflow-hidden group"
              style={{
                backgroundColor: 'rgba(20,20,32,0.88)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(6, 182, 212, 0.3)',
                boxShadow: '0 0 20px rgba(6, 182, 212, 0.1)',
              }}
            >
              <div 
                className="absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl opacity-20"
                style={{ backgroundColor: '#06b6d4' }}
              />
              <div className="flex justify-between items-start mb-3 relative z-10">
                <div className="text-3xl drop-shadow-md">🛢</div>
                <div className="text-xs font-bold px-2 py-0.5 rounded bg-white/10" style={{ color: '#06b6d4' }}>
                  Ур. 3
                </div>
              </div>
              <h3 className="font-bold text-sm mb-1 relative z-10">Нефтяная Вышка</h3>
              <p className="text-xs mb-4 relative z-10" style={{ color: 'rgba(255,255,255,0.55)' }}>
                +12 / ч
              </p>
              <button
                className="w-full py-2 rounded-lg text-xs font-bold mt-auto transition-all relative z-10"
                style={{
                  background: 'linear-gradient(135deg, rgba(6,182,212,0.2) 0%, rgba(6,182,212,0.05) 100%)',
                  border: '1px solid rgba(6,182,212,0.4)',
                  color: '#06b6d4'
                }}
              >
                Улучшить
              </button>
            </div>

            {/* Card 2: Violet */}
            <div
              className="flex flex-col rounded-2xl p-4 relative overflow-hidden"
              style={{
                backgroundColor: 'rgba(20,20,32,0.88)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(167, 139, 250, 0.3)',
                boxShadow: '0 0 20px rgba(167, 139, 250, 0.1)',
              }}
            >
              <div 
                className="absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl opacity-20"
                style={{ backgroundColor: '#a78bfa' }}
              />
              <div className="flex justify-between items-start mb-3 relative z-10">
                <div className="text-3xl drop-shadow-md">⚙️</div>
                <div className="text-xs font-bold px-2 py-0.5 rounded bg-white/10" style={{ color: '#a78bfa' }}>
                  Ур. 2
                </div>
              </div>
              <h3 className="font-bold text-sm mb-1 relative z-10">НПЗ Завод</h3>
              <p className="text-xs mb-4 relative z-10" style={{ color: 'rgba(255,255,255,0.55)' }}>
                +8 / ч
              </p>
              <button
                className="w-full py-2 rounded-lg text-xs font-bold mt-auto transition-all relative z-10"
                style={{
                  background: 'linear-gradient(135deg, rgba(167,139,250,0.2) 0%, rgba(167,139,250,0.05) 100%)',
                  border: '1px solid rgba(167,139,250,0.4)',
                  color: '#a78bfa'
                }}
              >
                Улучшить
              </button>
            </div>

            {/* Card 3: Green */}
            <div
              className="flex flex-col rounded-2xl p-4 relative overflow-hidden"
              style={{
                backgroundColor: 'rgba(20,20,32,0.88)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(52, 211, 153, 0.3)',
                boxShadow: '0 0 20px rgba(52, 211, 153, 0.1)',
              }}
            >
              <div 
                className="absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl opacity-20"
                style={{ backgroundColor: '#34d399' }}
              />
              <div className="flex justify-between items-start mb-3 relative z-10">
                <div className="text-3xl drop-shadow-md">⛽</div>
                <div className="text-xs font-bold px-2 py-0.5 rounded bg-white/10" style={{ color: '#34d399' }}>
                  Ур. 4
                </div>
              </div>
              <h3 className="font-bold text-sm mb-1 relative z-10">АЗС Сеть</h3>
              <p className="text-xs mb-4 relative z-10" style={{ color: 'rgba(255,255,255,0.55)' }}>
                +25 / ч
              </p>
              <button
                className="w-full py-2 rounded-lg text-xs font-bold mt-auto transition-all relative z-10"
                style={{
                  background: 'linear-gradient(135deg, rgba(52,211,153,0.2) 0%, rgba(52,211,153,0.05) 100%)',
                  border: '1px solid rgba(52,211,153,0.4)',
                  color: '#34d399'
                }}
              >
                Улучшить
              </button>
            </div>

            {/* Card 4: Build */}
            <div
              className="flex flex-col justify-center items-center rounded-2xl p-4 cursor-pointer"
              style={{
                backgroundColor: 'rgba(20,20,32,0.4)',
                backdropFilter: 'blur(20px)',
                border: '2px dashed rgba(255,255,255,0.15)',
              }}
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                <span className="text-xl" style={{ color: 'rgba(255,255,255,0.55)' }}>+</span>
              </div>
              <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.55)' }}>Построить</span>
            </div>

          </div>
        </div>
      </div>

      {/* Bottom Action Strip */}
      <div className="absolute bottom-[88px] left-0 right-0 px-5 z-20">
        <div className="flex gap-2 justify-between">
          <button
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-colors"
            style={{
              backgroundColor: 'rgba(20,20,32,0.9)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <Trophy size={16} style={{ color: '#fbbf24' }} />
            <span className="text-xs font-medium">Лидеры</span>
          </button>
          <button
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-colors"
            style={{
              backgroundColor: 'rgba(20,20,32,0.9)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <ShoppingCart size={16} style={{ color: '#f472b6' }} />
            <span className="text-xs font-medium">Кризис-шоп</span>
          </button>
          <button
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-colors"
            style={{
              backgroundColor: 'rgba(20,20,32,0.9)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <BarChart2 size={16} style={{ color: '#06b6d4' }} />
            <span className="text-xs font-medium">Статистика</span>
          </button>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[80px] flex items-center justify-around px-2 z-30"
        style={{
          backgroundColor: 'rgba(20,20,32,0.95)',
          backdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <button className="flex flex-col items-center justify-center gap-1 p-2 w-16">
          <Map size={24} style={{ color: 'rgba(255,255,255,0.55)' }} />
          <span className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.55)' }}>Карта</span>
        </button>
        
        <button className="flex flex-col items-center justify-center gap-1 p-2 w-16">
          <LayoutGrid size={24} style={{ color: 'rgba(255,255,255,0.55)' }} />
          <span className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.55)' }}>Сервисы</span>
        </button>
        
        <button className="flex flex-col items-center justify-center gap-1 p-2 w-16">
          <div className="relative">
            <Gamepad2 size={24} style={{ color: '#fbbf24' }} />
            <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500" style={{ backgroundColor: '#fb7185' }} />
          </div>
          <span className="text-[10px] font-medium" style={{ color: '#fbbf24' }}>Игра</span>
        </button>
        
        <button className="flex flex-col items-center justify-center gap-1 p-2 w-16">
          <Wallet size={24} style={{ color: 'rgba(255,255,255,0.55)' }} />
          <span className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.55)' }}>Активы</span>
        </button>
        
        <button className="flex flex-col items-center justify-center gap-1 p-2 w-16">
          <User size={24} style={{ color: 'rgba(255,255,255,0.55)' }} />
          <span className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.55)' }}>Профиль</span>
        </button>
      </div>

    </div>
  );
}

export default GamesScreen;
