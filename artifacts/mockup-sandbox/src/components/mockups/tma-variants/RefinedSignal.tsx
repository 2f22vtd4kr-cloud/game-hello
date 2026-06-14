import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Map, BarChart2, ShoppingCart, Lock, Dice5, Zap, ChevronUp, MapPin, Fuel } from 'lucide-react';
import './_group.css';

export function RefinedSignal() {
  const [activeTab, setActiveTab] = useState('map');
  const [activeFilter, setActiveFilter] = useState('all');

  const tabs = [
    { id: 'map', icon: Map, label: 'Карта' },
    { id: 'analytics', icon: BarChart2, label: 'Данные' },
    { id: 'catalog', icon: ShoppingCart, label: 'Каталог' },
    { id: 'vault', icon: Lock, label: 'Сейф' },
    { id: 'reserve', icon: Dice5, label: 'Фортуна' },
  ];

  return (
    <div style={{ width: '100%', height: '100vh', background: '#020204', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 390, height: 844, position: 'relative', overflow: 'hidden', borderRadius: 40, boxShadow: '0 0 80px rgba(168,85,247,0.25), 0 0 1px rgba(168,85,247,0.6)', border: '1px solid rgba(168,85,247,0.2)', backgroundColor: '#050507', fontFamily: 'Inter, sans-serif' }}>
        
        {/* Main Map Area */}
        <div className="absolute inset-0 refined-signal-bg flex items-center justify-center">
            {/* Some fake map pins */}
            <div className="absolute top-[35%] left-[25%] text-purple-500 flex flex-col items-center">
                <MapPin size={24} fill="rgba(168,85,247,0.2)" />
                <div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
            </div>
            <div className="absolute top-[45%] left-[65%] text-pink-500 flex flex-col items-center">
                <MapPin size={24} fill="rgba(219,39,119,0.2)" />
                <div className="w-1.5 h-1.5 rounded-full bg-pink-500 mt-1 shadow-[0_0_8px_rgba(219,39,119,0.8)]" />
            </div>
            <div className="absolute top-[25%] left-[75%] text-green-500 flex flex-col items-center opacity-50">
                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
            </div>
            <div className="absolute top-[65%] left-[30%] text-yellow-500 flex flex-col items-center opacity-70">
                <div className="w-2 h-2 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.8)]" />
            </div>
            <div className="absolute top-[55%] left-[45%] text-red-500 flex flex-col items-center">
                <MapPin size={32} fill="rgba(239,68,68,0.2)" />
                <div className="w-2 h-2 rounded-full bg-red-500 mt-1 shadow-[0_0_12px_rgba(239,68,68,1)]" />
            </div>
        </div>

        {/* Top Bar Area */}
        <div className="absolute top-0 left-0 right-0 z-20">
            <div className="pt-12 pb-3 px-5 flex items-center justify-between bg-gradient-to-b from-[#050507] to-transparent">
                <div className="font-mono text-[10px] tracking-widest text-slate-300">МАТРИЦА СНАБЖЕНИЯ</div>
                <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 px-2 py-1 rounded-full text-red-400 font-mono text-[9px] uppercase tracking-wider shadow-[0_0_10px_rgba(239,68,68,0.1)]">
                    <Zap size={10} className="text-red-500" />
                    12 кризисных АЗС
                </div>
            </div>

            {/* Market Ticker */}
            <div className="h-7 bg-[#0a0a0f] border-y border-white/5 flex items-center overflow-hidden font-mono text-[10px] text-slate-400 relative">
                <div className="w-8 h-full absolute left-0 bg-gradient-to-r from-[#0a0a0f] to-transparent z-10" />
                <div className="w-8 h-full absolute right-0 bg-gradient-to-l from-[#0a0a0f] to-transparent z-10" />
                <div className="flex refined-signal-ticker">
                    {[1, 2].map(i => (
                        <div key={i} className="flex gap-6 pr-6">
                            <span className="flex items-center gap-2">АИ-92 <span className="text-purple-400">47.50₽</span></span>
                            <span className="flex items-center gap-2">АИ-95 <span className="text-slate-300">52.80₽</span></span>
                            <span className="flex items-center gap-2">ДТ <span className="text-red-400">60.20₽ <ChevronUp size={10} className="inline" /></span></span>
                            <span className="flex items-center gap-2">ГАЗ <span className="text-slate-300">28.90₽</span></span>
                            <span className="flex items-center gap-2">АИ-100 <span className="text-pink-400">65.00₽</span></span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Filter Chips */}
            <div className="px-4 mt-4 flex gap-2">
                {['all', 'available'].map(filter => {
                    const isActive = activeFilter === filter;
                    return (
                        <button 
                            key={filter}
                            onClick={() => setActiveFilter(filter)}
                            className={`px-4 py-1.5 rounded-full text-[11px] font-medium transition-all duration-300 backdrop-blur-md ${isActive ? 'bg-purple-500/20 text-purple-200 border border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.2)]' : 'bg-[#14141e]/80 text-slate-400 border border-white/10 hover:bg-[#1a1a24]'}`}
                        >
                            {filter === 'all' ? 'Все АЗС' : 'Доступны'}
                        </button>
                    )
                })}
            </div>
        </div>

        {/* Floating Station Card */}
        <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.2 }}
            className="absolute bottom-[90px] left-4 right-4 bg-[#14141e]/90 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden shadow-2xl"
        >
            <div className="h-[2px] w-full bg-gradient-to-r from-purple-500 to-pink-500" />
            <div className="p-4">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-slate-200 font-semibold text-[15px] mb-1 tracking-tight">TES #42 Острякова</h3>
                        <p className="text-slate-500 text-[11px]">обновлено 2 мин. назад</p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/5 text-slate-400">
                        <Fuel size={14} />
                    </div>
                </div>

                <div className="space-y-3 mb-5">
                    {/* Fuel Bars */}
                    <div>
                        <div className="flex justify-between text-[10px] font-mono mb-1.5">
                            <span className="text-green-400">АИ-92</span>
                            <span className="text-slate-400">В наличии</span>
                        </div>
                        <div className="h-1.5 bg-black/50 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500 w-[85%] rounded-full shadow-[0_0_8px_rgba(34,197,94,0.5)] refined-signal-shimmer" />
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between text-[10px] font-mono mb-1.5">
                            <span className="text-yellow-400">АИ-95</span>
                            <span className="text-slate-400">Заканчивается</span>
                        </div>
                        <div className="h-1.5 bg-black/50 rounded-full overflow-hidden">
                            <div className="h-full bg-yellow-500 w-[30%] rounded-full shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between text-[10px] font-mono mb-1.5">
                            <span className="text-red-400">ДТ</span>
                            <span className="text-red-400/80">Нет топлива</span>
                        </div>
                        <div className="h-1.5 bg-black/50 rounded-full overflow-hidden">
                            <div className="h-full bg-red-500 w-[5%] rounded-full" />
                        </div>
                    </div>
                </div>

                <button className="w-full py-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/5 text-slate-300 text-[12px] font-medium flex items-center justify-center gap-2">
                    Подтвердить статус
                </button>
            </div>
        </motion.div>

        {/* Bottom Nav Bar */}
        <div className="absolute bottom-0 left-0 right-0 h-[80px] bg-[#06060a]/90 backdrop-blur-[24px] border-t border-white/5 z-30 pb-4">
            {/* Active Indicator Line */}
            <div className="absolute top-0 left-0 w-full h-[1px] bg-white/5">
                <motion.div 
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                    initial={false}
                    animate={{
                        width: '20%',
                        x: `${tabs.findIndex(t => t.id === activeTab) * 100}%`
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
            </div>
            
            <div className="flex h-full px-2">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className="flex-1 flex flex-col items-center justify-center gap-1.5 relative"
                        >
                            <div className="relative">
                                <Icon 
                                    size={20} 
                                    className={`transition-colors duration-300 ${isActive ? 'text-purple-400' : 'text-slate-500'}`}
                                />
                                {isActive && (
                                    <div className="absolute inset-0 bg-purple-500 blur-md opacity-40 rounded-full scale-150" />
                                )}
                            </div>
                            <span className={`text-[9px] font-medium tracking-wide transition-colors duration-300 ${isActive ? 'text-purple-200' : 'text-slate-500'}`}>
                                {tab.label}
                            </span>
                        </button>
                    )
                })}
            </div>
        </div>

      </div>
    </div>
  );
}
