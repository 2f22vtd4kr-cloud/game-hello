import React, { useState } from 'react';
import { Map, ShoppingCart, Newspaper, Zap, User } from 'lucide-react';

export function NewsScreen() {
  const [activeTab, setActiveTab] = useState('Новости');
  const [activeFilter, setActiveFilter] = useState('Все');

  const filters = ['Все', 'Крым', 'Донбасс', 'Херсон', 'Краснодар', 'Москва'];

  const timelineEvents = [
    { date: '25 Июн', title: 'Остановка НПЗ' },
    { date: '26 Июн', title: 'Перекрытие М04' },
    { date: '27 Июн', title: 'Дефицит АИ-95', active: true },
    { date: '28 Июн', title: 'Ожидание танкера' },
  ];

  return (
    <div 
      className="flex flex-col relative overflow-hidden font-sans mx-auto"
      style={{ 
        width: '390px', 
        height: '844px', 
        backgroundColor: '#08090f',
        color: 'rgba(255,255,255,0.95)',
        fontFamily: 'Inter, sans-serif'
      }}
    >
      {/* Header */}
      <div className="flex flex-col pt-12 pb-4 px-4 z-10" style={{ backgroundColor: 'rgba(8,9,15,0.9)', backdropFilter: 'blur(10px)' }}>
        <div className="flex justify-between items-center mb-1">
          <h1 className="text-2xl font-bold tracking-tight">Оперативная Сводка</h1>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-500/20 border border-red-500/30">
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#fb7185' }}></span>
            <span className="text-xs font-bold tracking-wider" style={{ color: '#fb7185' }}>LIVE</span>
          </div>
        </div>
        <div className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.55)' }}>
          27 июня 2026
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24 scrollbar-hide">
        {/* Crisis Timeline */}
        <div className="px-4 py-4 mb-2">
          <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.55)' }}>Crisis Timeline</h2>
          <div className="relative flex items-center justify-between">
            <div className="absolute top-1/2 left-0 right-0 h-px bg-white/10 -translate-y-1/2 z-0"></div>
            {timelineEvents.map((event, i) => (
              <div key={i} className="relative z-10 flex flex-col items-center gap-1.5 group cursor-pointer">
                <div 
                  className="w-3 h-3 rounded-full border-2 transition-colors"
                  style={{ 
                    backgroundColor: event.active ? '#fb7185' : '#141420',
                    borderColor: event.active ? '#fb7185' : 'rgba(255,255,255,0.2)',
                    boxShadow: event.active ? '0 0 10px rgba(251, 113, 133, 0.5)' : 'none'
                  }}
                ></div>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-bold" style={{ color: event.active ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.55)' }}>{event.date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Region Filters */}
        <div className="px-4 mb-4 flex gap-2 overflow-x-auto scrollbar-hide pb-2">
          {filters.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className="px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all border"
              style={{
                backgroundColor: activeFilter === filter ? 'rgba(167, 139, 250, 0.15)' : 'rgba(20, 20, 32, 0.5)',
                borderColor: activeFilter === filter ? '#a78bfa' : 'transparent',
                color: activeFilter === filter ? '#a78bfa' : 'rgba(255,255,255,0.7)'
              }}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* News Feed */}
        <div className="px-4 flex flex-col gap-3">
          
          {/* Card 1: CRITICAL */}
          <div 
            className="rounded-xl p-4 flex flex-col gap-2 relative overflow-hidden"
            style={{ 
              backgroundColor: 'rgba(20,20,32,0.88)', 
              backdropFilter: 'blur(20px)',
              borderLeft: '4px solid #fb7185',
              borderTop: '1px solid rgba(255,255,255,0.05)',
              borderRight: '1px solid rgba(255,255,255,0.05)',
              borderBottom: '1px solid rgba(255,255,255,0.05)'
            }}
          >
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ background: 'linear-gradient(90deg, rgba(251,113,133,0.1) 0%, transparent 40%)' }}></div>
            <div className="flex justify-between items-start z-10">
              <span className="text-xs font-bold tracking-wide" style={{ color: '#fb7185' }}>🔴 КРИТИЧНО</span>
            </div>
            <h3 className="text-base font-bold leading-tight z-10">Дефицит АИ-95 в Симферополе: очереди 40+ машин</h3>
            <p className="text-sm leading-relaxed z-10" style={{ color: 'rgba(255,255,255,0.65)' }}>Несколько крупных АЗС вывесили таблички «Нет бензина», водители сообщают о перебоях на всех основных заправках региона...</p>
            <div className="flex justify-between items-center mt-2 z-10">
              <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>АР Крым · 2 ч назад</span>
              <span className="text-xs font-bold" style={{ color: '#fb7185' }}>+8.2% к цене</span>
            </div>
          </div>

          {/* Card 2: WARNING */}
          <div 
            className="rounded-xl p-4 flex flex-col gap-2 relative overflow-hidden"
            style={{ 
              backgroundColor: 'rgba(20,20,32,0.88)', 
              backdropFilter: 'blur(20px)',
              borderLeft: '4px solid #fbbf24',
              borderTop: '1px solid rgba(255,255,255,0.05)',
              borderRight: '1px solid rgba(255,255,255,0.05)',
              borderBottom: '1px solid rgba(255,255,255,0.05)'
            }}
          >
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ background: 'linear-gradient(90deg, rgba(251,191,36,0.05) 0%, transparent 30%)' }}></div>
            <div className="flex justify-between items-start z-10">
              <span className="text-xs font-bold tracking-wide" style={{ color: '#fbbf24' }}>⚠️ ВНИМАНИЕ</span>
            </div>
            <h3 className="text-base font-bold leading-tight z-10">Поставки задержаны из-за ремонта трассы М04</h3>
            <div className="flex justify-between items-center mt-1 z-10">
              <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Донецкая обл. · 5 ч назад</span>
            </div>
          </div>

          {/* Card 3: SUCCESS */}
          <div 
            className="rounded-xl p-4 flex flex-col gap-2 relative overflow-hidden"
            style={{ 
              backgroundColor: 'rgba(20,20,32,0.88)', 
              backdropFilter: 'blur(20px)',
              borderLeft: '4px solid #34d399',
              borderTop: '1px solid rgba(255,255,255,0.05)',
              borderRight: '1px solid rgba(255,255,255,0.05)',
              borderBottom: '1px solid rgba(255,255,255,0.05)'
            }}
          >
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ background: 'linear-gradient(90deg, rgba(52,211,153,0.05) 0%, transparent 30%)' }}></div>
            <div className="flex justify-between items-start z-10">
              <span className="text-xs font-bold tracking-wide" style={{ color: '#34d399' }}>✅ НОРМА</span>
            </div>
            <h3 className="text-base font-bold leading-tight z-10">АЗС Восток-Ресурс возобновили отпуск дизеля</h3>
            <div className="flex justify-between items-center mt-1 z-10">
              <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Запорожская обл. · 8 ч назад</span>
              <span className="text-xs font-bold" style={{ color: '#34d399' }}>-3.1% к цене</span>
            </div>
          </div>

          {/* Card 4: INFO */}
          <div 
            className="rounded-xl p-4 flex flex-col gap-2 relative overflow-hidden"
            style={{ 
              backgroundColor: 'rgba(20,20,32,0.88)', 
              backdropFilter: 'blur(20px)',
              borderLeft: '4px solid #06b6d4',
              borderTop: '1px solid rgba(255,255,255,0.05)',
              borderRight: '1px solid rgba(255,255,255,0.05)',
              borderBottom: '1px solid rgba(255,255,255,0.05)'
            }}
          >
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ background: 'linear-gradient(90deg, rgba(6,182,212,0.05) 0%, transparent 30%)' }}></div>
            <div className="flex justify-between items-start z-10">
              <span className="text-xs font-bold tracking-wide" style={{ color: '#06b6d4' }}>ℹ️ ИНФО</span>
            </div>
            <h3 className="text-base font-bold leading-tight z-10">Роснефть: нормализация поставок в течение суток</h3>
            <div className="flex justify-between items-center mt-1 z-10">
              <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Белгородская обл. · 12 ч назад</span>
            </div>
          </div>

        </div>
      </div>

      {/* Bottom Navigation */}
      <div 
        className="absolute bottom-0 w-full flex justify-around items-center pt-3 pb-8 px-2 border-t"
        style={{ 
          backgroundColor: 'rgba(8,9,15,0.85)', 
          backdropFilter: 'blur(20px)',
          borderColor: 'rgba(255,255,255,0.05)',
          zIndex: 50
        }}
      >
        {[
          { id: 'Карта', icon: Map, color: '#a78bfa' },
          { id: 'Каталог', icon: ShoppingCart, color: '#a78bfa' },
          { id: 'Новости', icon: Newspaper, color: '#f472b6' },
          { id: 'Заряды', icon: Zap, color: '#a78bfa' },
          { id: 'Профиль', icon: User, color: '#a78bfa' }
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className="flex flex-col items-center gap-1 p-2 transition-all relative"
          >
            {activeTab === item.id && (
              <div 
                className="absolute -top-3 w-8 h-1 rounded-full"
                style={{ backgroundColor: item.color, boxShadow: `0 0 10px ${item.color}` }}
              />
            )}
            <item.icon 
              size={24} 
              style={{ 
                color: activeTab === item.id ? item.color : 'rgba(255,255,255,0.4)',
                filter: activeTab === item.id ? `drop-shadow(0 0 8px ${item.color}80)` : 'none'
              }} 
            />
            <span 
              className="text-[10px] font-medium"
              style={{ color: activeTab === item.id ? item.color : 'rgba(255,255,255,0.4)' }}
            >
              {item.id}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
