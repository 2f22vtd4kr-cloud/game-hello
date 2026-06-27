import React, { useState } from 'react';
import { Search, SlidersHorizontal, Map, Ticket, Bot, Gamepad2, Newspaper, Navigation, CheckCircle2, AlertTriangle, XCircle, ChevronUp } from 'lucide-react';

export function MapScreen() {
  const [activeTab, setActiveTab] = useState('Карта');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>('АИ-95');

  const filters = ['АИ-92', 'АИ-95', 'ДТ', 'Газ'];

  // Coordinates are percentages (top, left)
  const pins = [
    { id: 1, top: '25%', left: '30%', status: 'green', active: false },
    { id: 2, top: '40%', left: '60%', status: 'yellow', active: false },
    { id: 3, top: '55%', left: '45%', status: 'red', active: false },
    { id: 4, top: '20%', left: '75%', status: 'green', active: false },
    { id: 5, top: '70%', left: '25%', status: 'yellow', active: false },
    { id: 6, top: '65%', left: '80%', status: 'green', active: false },
    { id: 7, top: '48%', left: '50%', status: 'green', active: true },
    { id: 8, top: '80%', left: '55%', status: 'red', active: false },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'green': return '#34d399';
      case 'yellow': return '#fbbf24';
      case 'red': return '#fb7185';
      default: return '#34d399';
    }
  };

  return (
    <div 
      className="relative w-full h-[844px] max-w-[390px] mx-auto overflow-hidden shadow-2xl rounded-[40px] border-[8px] border-zinc-950 flex flex-col"
      style={{ 
        backgroundColor: '#08090f',
        fontFamily: "'Inter', sans-serif" 
      }}
    >
      {/* Fake Map Background */}
      <div 
        className="absolute inset-0 z-0"
        style={{
          backgroundColor: '#0f1018',
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(45deg, rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(-45deg, rgba(255,255,255,0.02) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px, 40px 40px, 60px 60px, 60px 60px',
          backgroundPosition: 'center'
        }}
      >
        {/* Subtle glowing areas to simulate regions/density */}
        <div className="absolute top-[20%] left-[30%] w-64 h-64 bg-violet-500/10 rounded-full blur-[80px]"></div>
        <div className="absolute bottom-[30%] right-[10%] w-48 h-48 bg-cyan-500/10 rounded-full blur-[60px]"></div>
      </div>

      {/* Map Pins */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        {pins.map((pin) => (
          <div 
            key={pin.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center transition-transform duration-300 pointer-events-auto cursor-pointer"
            style={{ 
              top: pin.top, 
              left: pin.left,
              transform: pin.active ? 'translate(-50%, -50%) scale(1.2)' : 'translate(-50%, -50%) scale(1)',
              zIndex: pin.active ? 20 : 10
            }}
          >
            {pin.active && (
              <div className="absolute -top-10 px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap mb-2 backdrop-blur-md"
                style={{ backgroundColor: 'rgba(20,20,32,0.88)', color: 'rgba(255,255,255,0.95)', border: '1px solid rgba(255,255,255,0.1)' }}>
                АЗС Роснефть
              </div>
            )}
            <div className="relative">
              <div 
                className="absolute inset-0 rounded-full animate-ping opacity-30"
                style={{ backgroundColor: getStatusColor(pin.status) }}
              />
              <div 
                className="relative w-5 h-5 rounded-full border-2 border-[#0f1018] shadow-lg flex items-center justify-center"
                style={{ 
                  backgroundColor: getStatusColor(pin.status),
                  boxShadow: `0 0 10px ${getStatusColor(pin.status)}80`
                }}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-white opacity-80" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Top Floating Controls */}
      <div className="absolute top-0 inset-x-0 z-20 pt-[60px] px-4 flex flex-col gap-3">
        {/* Search Bar */}
        <div 
          className="flex items-center w-full rounded-2xl h-14 px-4 backdrop-blur-xl border border-white/5 shadow-2xl"
          style={{ backgroundColor: 'rgba(20,20,32,0.88)' }}
        >
          <Search size={20} style={{ color: 'rgba(255,255,255,0.55)' }} />
          <input 
            type="text" 
            placeholder="Поиск АЗС..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none px-3 text-base"
            style={{ color: 'rgba(255,255,255,0.95)' }}
          />
          <div className="h-8 w-[1px] mx-2" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
          <button className="p-2 -mr-2 rounded-xl transition-colors hover:bg-white/5">
            <SlidersHorizontal size={20} style={{ color: '#a78bfa' }} />
          </button>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {filters.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className="px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-all backdrop-blur-md border"
              style={{
                backgroundColor: activeFilter === filter ? 'rgba(167, 139, 250, 0.15)' : 'rgba(20,20,32,0.7)',
                color: activeFilter === filter ? '#a78bfa' : 'rgba(255,255,255,0.7)',
                borderColor: activeFilter === filter ? '#a78bfa' : 'rgba(255,255,255,0.05)',
                boxShadow: activeFilter === filter ? '0 0 15px rgba(167, 139, 250, 0.2)' : 'none'
              }}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom Area (Station Card + Nav) */}
      <div className="absolute bottom-0 inset-x-0 z-30 flex flex-col pointer-events-none">
        
        {/* Selected Station Drawer Card */}
        <div className="px-4 pb-4 pointer-events-auto">
          <div 
            className="w-full rounded-[24px] p-5 backdrop-blur-xl border border-white/10 shadow-2xl flex flex-col gap-4 relative overflow-hidden"
            style={{ backgroundColor: 'rgba(20,20,32,0.88)' }}
          >
            {/* Subtle top glare */}
            <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
            
            {/* Handle */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/20"></div>
            
            <div className="flex justify-between items-start mt-1">
              <div className="flex flex-col">
                <h2 className="text-xl font-bold tracking-tight" style={{ color: '#a78bfa' }}>
                  АЗС Роснефть #14
                </h2>
                <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  ул. Ленина, 42, Симферополь
                </p>
              </div>
              <button className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/5">
                <Navigation size={14} style={{ color: '#06b6d4' }} />
              </button>
            </div>

            {/* Fuel Pills */}
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/5 bg-black/40">
                <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>АИ-92</span>
                <CheckCircle2 size={12} style={{ color: '#34d399' }} />
                <span className="text-xs font-medium" style={{ color: '#34d399' }}>72%</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/5 bg-black/40">
                <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>АИ-95</span>
                <AlertTriangle size={12} style={{ color: '#fbbf24' }} />
                <span className="text-xs font-medium" style={{ color: '#fbbf24' }}>31%</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/5 bg-black/40">
                <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>ДТ</span>
                <XCircle size={12} style={{ color: '#fb7185' }} />
                <span className="text-xs font-medium" style={{ color: '#fb7185' }}>0%</span>
              </div>
            </div>

            {/* Queue Info */}
            <div className="flex items-center gap-2 py-2 px-3 rounded-xl bg-white/5 border border-white/5">
              <span className="text-sm">🚗</span>
              <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>
                4 машины · ~16 мин
              </span>
            </div>

            {/* CTA Button */}
            <button 
              className="w-full py-4 rounded-xl font-bold text-base transition-transform active:scale-[0.98] relative overflow-hidden"
              style={{ 
                backgroundColor: '#a78bfa',
                color: '#08090f',
                boxShadow: '0 4px 20px rgba(167, 139, 250, 0.4)'
              }}
            >
              Зарезервировать
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] animate-[shimmer_2s_infinite]"></div>
            </button>
          </div>
        </div>

        {/* Bottom Nav */}
        <div 
          className="h-[84px] w-full px-6 flex justify-between items-start pt-4 border-t border-white/10 backdrop-blur-2xl pointer-events-auto"
          style={{ backgroundColor: 'rgba(20,20,32,0.95)' }}
        >
          {[
            { id: 'Карта', icon: Map },
            { id: 'Талоны', icon: Ticket },
            { id: 'ИИ', icon: Bot },
            { id: 'Игра', icon: Gamepad2 },
            { id: 'Новости', icon: Newspaper }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex flex-col items-center gap-1.5 relative w-12"
            >
              <tab.icon 
                size={24} 
                style={{ 
                  color: activeTab === tab.id ? '#a78bfa' : 'rgba(255,255,255,0.4)',
                  filter: activeTab === tab.id ? 'drop-shadow(0 0 8px rgba(167, 139, 250, 0.5))' : 'none'
                }} 
              />
              <span 
                className="text-[10px] font-medium"
                style={{ color: activeTab === tab.id ? '#a78bfa' : 'rgba(255,255,255,0.4)' }}
              >
                {tab.id}
              </span>
            </button>
          ))}
        </div>
      </div>
      
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}

export default MapScreen;
