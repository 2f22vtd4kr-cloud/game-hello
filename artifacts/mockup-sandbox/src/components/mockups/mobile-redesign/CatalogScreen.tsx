import React, { useState } from 'react';

export function CatalogScreen() {
  const [activeTab, setActiveTab] = useState<'network' | 'station'>('network');
  const [selectedVolume, setSelectedVolume] = useState<Record<string, string>>({
    rosneft: '20',
    lukoil: '40',
    tatneft: '20'
  });

  const handleVolume = (brand: string, vol: string) => {
    setSelectedVolume(prev => ({ ...prev, [brand]: vol }));
  };

  return (
    <div 
      className="relative mx-auto overflow-hidden bg-[#08090f] text-[rgba(255,255,255,0.95)] flex flex-col font-sans"
      style={{ width: 390, height: 844, fontFamily: 'Inter, sans-serif' }}
    >
      {/* Header */}
      <div className="pt-14 pb-4 px-5 z-10 relative">
        <h1 className="text-2xl font-bold mb-3 tracking-tight">Талоны на топливо</h1>
        
        {/* Price Ticker */}
        <div className="overflow-hidden rounded-md bg-[#141420]/50 py-1.5 flex whitespace-nowrap text-xs font-medium border border-white/5 relative">
          <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-[#08090f] to-transparent z-10"></div>
          <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-[#08090f] to-transparent z-10"></div>
          <div className="animate-marquee flex gap-6 px-4" style={{ 
            animation: 'marquee 15s linear infinite', 
            background: 'linear-gradient(90deg, #f472b6, #a78bfa)', 
            WebkitBackgroundClip: 'text', 
            WebkitTextFillColor: 'transparent'
          }}>
            <span>АИ-92: 58.4₽ ▲</span>
            <span>АИ-95: 63.1₽ ▼</span>
            <span>ДТ: 71.2₽ —</span>
            <span>АИ-92: 58.4₽ ▲</span>
            <span>АИ-95: 63.1₽ ▼</span>
            <span>ДТ: 71.2₽ —</span>
          </div>
          <style>{`
            @keyframes marquee {
              0% { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
          `}</style>
        </div>
      </div>

      {/* Segmented Control */}
      <div className="px-5 mb-5 z-10 relative">
        <div className="flex bg-[#141420]/80 backdrop-blur-[20px] rounded-full p-1 border border-white/5">
          <button 
            onClick={() => setActiveTab('network')}
            className={`flex-1 py-2 text-sm font-medium rounded-full transition-colors ${activeTab === 'network' ? 'bg-[#a78bfa] text-white shadow-[0_0_15px_rgba(167,139,250,0.3)]' : 'text-[rgba(255,255,255,0.55)]'}`}
          >
            Сетевые
          </button>
          <button 
            onClick={() => setActiveTab('station')}
            className={`flex-1 py-2 text-sm font-medium rounded-full transition-colors ${activeTab === 'station' ? 'bg-[#a78bfa] text-white shadow-[0_0_15px_rgba(167,139,250,0.3)]' : 'text-[rgba(255,255,255,0.55)]'}`}
          >
            Станционные
          </button>
        </div>
      </div>

      {/* Cards List */}
      <div className="flex-1 overflow-y-auto px-5 pb-24 z-10 relative flex flex-col gap-4 scrollbar-hide">
        
        {/* Card 1: Rosneft */}
        <div className="bg-[rgba(20,20,32,0.88)] backdrop-blur-[20px] border border-[#a78bfa]/40 rounded-2xl p-4 shadow-[0_0_20px_rgba(167,139,250,0.15)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#a78bfa]/10 blur-[40px] rounded-full"></div>
          
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#a78bfa]/20 flex items-center justify-center text-[#a78bfa] font-bold text-lg border border-[#a78bfa]/30">Р</div>
              <div>
                <h3 className="font-semibold text-[rgba(255,255,255,0.95)]">Роснефть</h3>
                <span className="text-[10px] uppercase tracking-wider text-[rgba(255,255,255,0.55)] bg-white/5 px-2 py-0.5 rounded-full border border-white/10">РФ • Сеть</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-[rgba(255,255,255,0.55)]">Тип</div>
              <div className="font-medium text-sm text-[#06b6d4]">АИ-92</div>
            </div>
          </div>

          <div className="bg-black/20 rounded-xl p-3 mb-4 border border-white/5">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-[rgba(255,255,255,0.55)]">Зафиксировано</span>
              <span className="font-bold text-sm">58.4 ₽/л</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-[rgba(255,255,255,0.55)]">Рынок</span>
              <span className="text-xs line-through text-[rgba(255,255,255,0.55)] mr-1">64.2 ₽/л</span>
            </div>
            <div className="mt-2 text-[10px] text-[#34d399] bg-[#34d399]/10 inline-block px-2 py-0.5 rounded flex items-center w-fit border border-[#34d399]/20">
              <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              +9.2% экономия
            </div>
          </div>

          <div className="flex gap-2 mb-4">
            {['20', '40', '60'].map(vol => (
              <button 
                key={vol}
                onClick={() => handleVolume('rosneft', vol)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  selectedVolume['rosneft'] === vol 
                    ? 'bg-[#a78bfa] border-[#a78bfa] text-white shadow-[0_0_10px_rgba(167,139,250,0.4)]' 
                    : 'bg-white/5 border-white/10 text-[rgba(255,255,255,0.55)]'
                }`}
              >
                {vol} л
              </button>
            ))}
          </div>

          <button className="w-full py-3 rounded-xl bg-gradient-to-r from-[#a78bfa] to-[#f472b6] text-white font-semibold text-sm shadow-[0_4px_15px_rgba(244,114,182,0.3)] flex items-center justify-center gap-2">
            <span>Купить за</span>
            <span className="text-[#fbbf24] text-lg leading-none">⭐</span>
            <span>{selectedVolume['rosneft'] === '20' ? '107' : selectedVolume['rosneft'] === '40' ? '214' : '321'}</span>
          </button>
        </div>

        {/* Card 2: Lukoil */}
        <div className="bg-[rgba(20,20,32,0.88)] backdrop-blur-[20px] border border-white/10 rounded-2xl p-4 relative overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#fb7185]/20 flex items-center justify-center text-[#fb7185] font-bold text-lg border border-[#fb7185]/30">Л</div>
              <div>
                <h3 className="font-semibold text-[rgba(255,255,255,0.95)]">Лукойл</h3>
                <span className="text-[10px] uppercase tracking-wider text-[rgba(255,255,255,0.55)] bg-white/5 px-2 py-0.5 rounded-full border border-white/10">РФ • Сеть</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-[rgba(255,255,255,0.55)]">Тип</div>
              <div className="font-medium text-sm text-[#06b6d4]">АИ-95</div>
            </div>
          </div>

          <div className="bg-black/20 rounded-xl p-3 mb-4 border border-white/5">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-[rgba(255,255,255,0.55)]">Зафиксировано</span>
              <span className="font-bold text-sm">62.1 ₽/л</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-[rgba(255,255,255,0.55)]">Рынок</span>
              <span className="text-xs line-through text-[rgba(255,255,255,0.55)] mr-1">68.5 ₽/л</span>
            </div>
            <div className="mt-2 text-[10px] text-[#34d399] bg-[#34d399]/10 inline-block px-2 py-0.5 rounded flex items-center w-fit border border-[#34d399]/20">
              <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              +10.3% экономия
            </div>
          </div>

          <div className="flex gap-2 mb-4">
            {['20', '40', '60'].map(vol => (
              <button 
                key={vol}
                onClick={() => handleVolume('lukoil', vol)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  selectedVolume['lukoil'] === vol 
                    ? 'bg-[#a78bfa] border-[#a78bfa] text-white shadow-[0_0_10px_rgba(167,139,250,0.4)]' 
                    : 'bg-white/5 border-white/10 text-[rgba(255,255,255,0.55)]'
                }`}
              >
                {vol} л
              </button>
            ))}
          </div>

          <button className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-white/10 transition-colors">
            <span>Купить за</span>
            <span className="text-[#fbbf24] text-lg leading-none">⭐</span>
            <span>{selectedVolume['lukoil'] === '20' ? '114' : selectedVolume['lukoil'] === '40' ? '228' : '342'}</span>
          </button>
        </div>

        {/* Card 3: Tatneft */}
        <div className="bg-[rgba(20,20,32,0.88)] backdrop-blur-[20px] border border-white/10 rounded-2xl p-4 relative overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#fbbf24]/20 flex items-center justify-center text-[#fbbf24] font-bold text-lg border border-[#fbbf24]/30">Т</div>
              <div>
                <h3 className="font-semibold text-[rgba(255,255,255,0.95)]">Татнефть</h3>
                <span className="text-[10px] uppercase tracking-wider text-[rgba(255,255,255,0.55)] bg-white/5 px-2 py-0.5 rounded-full border border-white/10">РФ • Сеть</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-[rgba(255,255,255,0.55)]">Тип</div>
              <div className="font-medium text-sm text-[#06b6d4]">ДТ</div>
            </div>
          </div>

          <div className="bg-black/20 rounded-xl p-3 mb-4 border border-white/5">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-[rgba(255,255,255,0.55)]">Зафиксировано</span>
              <span className="font-bold text-sm">69.5 ₽/л</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-[rgba(255,255,255,0.55)]">Рынок</span>
              <span className="text-xs line-through text-[rgba(255,255,255,0.55)] mr-1">74.8 ₽/л</span>
            </div>
            <div className="mt-2 text-[10px] text-[#34d399] bg-[#34d399]/10 inline-block px-2 py-0.5 rounded flex items-center w-fit border border-[#34d399]/20">
              <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              +7.6% экономия
            </div>
          </div>

          <div className="flex gap-2 mb-4">
            {['20', '40', '60'].map(vol => (
              <button 
                key={vol}
                onClick={() => handleVolume('tatneft', vol)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  selectedVolume['tatneft'] === vol 
                    ? 'bg-[#a78bfa] border-[#a78bfa] text-white shadow-[0_0_10px_rgba(167,139,250,0.4)]' 
                    : 'bg-white/5 border-white/10 text-[rgba(255,255,255,0.55)]'
                }`}
              >
                {vol} л
              </button>
            ))}
          </div>

          <button className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-white/10 transition-colors">
            <span>Купить за</span>
            <span className="text-[#fbbf24] text-lg leading-none">⭐</span>
            <span>{selectedVolume['tatneft'] === '20' ? '128' : selectedVolume['tatneft'] === '40' ? '256' : '384'}</span>
          </button>
        </div>

      </div>

      {/* Floating Crypto Badge */}
      <div className="absolute bottom-24 right-5 bg-[#141420]/90 backdrop-blur-md border border-[#06b6d4]/40 px-3 py-2 rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.2)] flex items-center gap-2 z-20 cursor-pointer">
        <span className="text-lg">💎</span>
        <span className="text-xs font-medium text-[#06b6d4]">Криптобот</span>
      </div>

      {/* Bottom Nav */}
      <div className="absolute bottom-0 w-full h-20 bg-[#08090f]/90 backdrop-blur-xl border-t border-white/10 flex justify-around items-center px-2 pb-5 pt-2 z-30">
        <div className="flex flex-col items-center gap-1 opacity-50">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
          <span className="text-[10px]">Главная</span>
        </div>
        <div className="flex flex-col items-center gap-1 opacity-50">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724a1 1 0 01-.553-.894V9a1 1 0 01.553-.894L9 5.382M9 20l5.447-2.724a1 1 0 00.553-.894V9a1 1 0 00-.553-.894L9 5.382M9 20V5.382M15 17.276L20.447 20a1 1 0 00.553-.894V9a1 1 0 00-.553-.894L15 5.382" /></svg>
          <span className="text-[10px]">Карта</span>
        </div>
        <div className="flex flex-col items-center gap-1 text-[#a78bfa] shadow-[0_0_20px_rgba(167,139,250,0)] relative">
          <div className="absolute -top-3 w-12 h-1 bg-[#a78bfa] rounded-full shadow-[0_0_10px_rgba(167,139,250,0.8)]"></div>
          <svg className="w-6 h-6 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>
          <span className="text-[10px] font-medium">Талоны</span>
        </div>
        <div className="flex flex-col items-center gap-1 opacity-50">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          <span className="text-[10px]">Сейф</span>
        </div>
        <div className="flex flex-col items-center gap-1 opacity-50">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
          <span className="text-[10px]">Профиль</span>
        </div>
      </div>
      
    </div>
  );
}

export default CatalogScreen;
