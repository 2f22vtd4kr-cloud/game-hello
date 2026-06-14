import React from "react";
import { Map as MapIcon, BarChart2, ShoppingCart, Lock, Sparkles, Navigation, Fuel, AlertTriangle, ShieldCheck } from "lucide-react";

export function DeepField() {
  return (
    <div style={{ width: '100%', height: '100vh', background: '#020204', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ 
        width: 390, 
        height: 844, 
        position: 'relative', 
        overflow: 'hidden', 
        borderRadius: 40, 
        boxShadow: '0 0 80px rgba(168,85,247,0.25), 0 0 1px rgba(168,85,247,0.6)', 
        border: '1px solid rgba(168,85,247,0.2)',
        backgroundColor: '#050507',
        color: '#e2e8f0',
        fontFamily: 'Inter, sans-serif'
      }}>
        
        {/* Deep Field Background Nebulas */}
        <div style={{
          position: 'absolute', top: '-10%', right: '-20%', width: 300, height: 300,
          background: 'rgba(168,85,247,0.08)', filter: 'blur(120px)', borderRadius: '50%', pointerEvents: 'none'
        }} />
        <div style={{
          position: 'absolute', bottom: '-10%', left: '-20%', width: 350, height: 350,
          background: 'rgba(219,39,119,0.05)', filter: 'blur(120px)', borderRadius: '50%', pointerEvents: 'none'
        }} />

        {/* Top Header / Market Ticker */}
        <div className="absolute top-0 w-full z-20 px-4 pt-12 pb-4" style={{
          background: 'linear-gradient(180deg, rgba(5,5,7,0.9) 0%, rgba(5,5,7,0) 100%)'
        }}>
          <div className="flex justify-between items-center bg-white/[0.03] border border-white/[0.05] rounded-full px-4 py-2 backdrop-blur-md">
            <div className="flex space-x-4 font-mono text-xs tracking-wider font-bold">
              <span className="text-emerald-400">АИ-92 <span className="opacity-75">47₽</span></span>
              <span className="text-yellow-400">АИ-95 <span className="opacity-75">52₽</span></span>
              <span className="text-rose-400">ДТ <span className="opacity-75">60₽</span></span>
            </div>
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        </div>

        {/* Floating Map Area */}
        <div className="absolute top-28 left-4 right-4 bottom-48 z-10 p-1" style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(168,85,247,0.15)',
          borderRadius: 20,
          backdropFilter: 'blur(12px)',
          overflow: 'hidden'
        }}>
          {/* Map Grid Pattern Simulation */}
          <div className="absolute inset-0 opacity-20" style={{
            backgroundImage: 'radial-gradient(rgba(168,85,247,0.4) 1px, transparent 1px)',
            backgroundSize: '24px 24px'
          }} />
          
          <div className="absolute top-4 left-4 flex space-x-2">
            <div className="bg-purple-500/20 border border-purple-500/50 text-purple-200 px-3 py-1.5 rounded-lg text-xs font-mono tracking-wider backdrop-blur-md flex items-center shadow-[0_0_10px_rgba(168,85,247,0.3)]">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 mr-2 shadow-[0_0_5px_rgba(168,85,247,1)]" />
              Все АЗС
            </div>
            <div className="bg-white/5 border border-white/10 text-slate-400 px-3 py-1.5 rounded-lg text-xs font-mono tracking-wider backdrop-blur-md">
              Доступны
            </div>
          </div>
          
          {/* Fake Map Elements */}
          <div className="absolute top-1/3 left-1/4 w-3 h-3 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.8)]" />
          <div className="absolute top-1/2 right-1/3 w-3 h-3 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.8)]" />
          <div className="absolute bottom-1/4 left-1/3 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.8)] border border-white/20">
            <div className="w-1.5 h-1.5 bg-white rounded-full" />
          </div>
          <div className="absolute bottom-1/3 right-1/4 w-3 h-3 bg-yellow-500 rounded-full shadow-[0_0_10px_rgba(234,179,8,0.8)]" />
          
          <div className="absolute bottom-4 right-4 font-mono text-[10px] text-cyan-400/60 tracking-widest">
            236 АЗС / КРЫМ
          </div>
        </div>

        {/* Station Sheet / Heavy Bottom Drawer */}
        <div className="absolute bottom-0 left-0 right-0 h-64 z-20 flex flex-col pt-1" style={{
          background: 'linear-gradient(90deg, rgba(168,85,247,1) 0%, rgba(219,39,119,1) 100%)',
          borderTopLeftRadius: 64,
          borderTopRightRadius: 64,
          boxShadow: '0 -10px 40px rgba(168,85,247,0.15)'
        }}>
          <div className="flex-1 w-full h-full p-6 relative overflow-hidden" style={{
            background: 'rgba(8,8,20,0.97)',
            borderTopLeftRadius: 63,
            borderTopRightRadius: 63,
            backdropFilter: 'blur(24px)'
          }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-1 bg-white/10 rounded-full mt-3" />
            
            <div className="mt-4 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-white mb-1">АЗС "ATAN" #42</h2>
                <div className="flex items-center text-xs text-slate-400 font-mono">
                  <Navigation className="w-3 h-3 mr-1" />
                  ул. Гоголя, 22А • 1.2 км
                </div>
              </div>
              <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-purple-400 backdrop-blur-sm">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {[
                { name: 'АИ-92', price: '47.00', pct: '85%', color: 'bg-emerald-500' },
                { name: 'АИ-95', price: '52.50', pct: '40%', color: 'bg-yellow-500' },
                { name: 'ДТ', price: '60.00', pct: '10%', color: 'bg-rose-500' },
              ].map((fuel) => (
                <div key={fuel.name} className="flex items-center space-x-3 text-sm font-mono">
                  <div className="w-12 text-slate-300 font-bold">{fuel.name}</div>
                  <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden relative">
                    <div className={`absolute top-0 left-0 h-full ${fuel.color} rounded-full`} style={{ width: fuel.pct, boxShadow: '0 0 10px currentColor' }} />
                  </div>
                  <div className="w-10 text-right text-slate-400 text-xs">{fuel.pct}</div>
                </div>
              ))}
            </div>
            
            {/* Subtle inner glow for the sheet */}
            <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-purple-500/10 to-transparent pointer-events-none" />
          </div>
        </div>

        {/* Floating Pill Bottom Nav */}
        <div className="absolute bottom-6 left-4 right-4 z-30 h-16 flex items-center px-2" style={{
          background: 'rgba(8,8,16,0.85)',
          border: '1px solid rgba(168,85,247,0.2)',
          borderRadius: 99,
          boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(168,85,247,0.08) inset',
          backdropFilter: 'blur(24px)'
        }}>
          <div className="flex w-full justify-between items-center">
            
            {/* Active Tab: Карта */}
            <div className="flex flex-col items-center justify-center w-1/5 relative">
              <div className="absolute -top-3 w-8 h-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full shadow-[0_0_10px_rgba(168,85,247,0.8)]" />
              <div className="w-10 h-10 rounded-full bg-purple-500/15 flex flex-col items-center justify-center text-purple-400">
                <MapIcon className="w-5 h-5 mb-0.5" />
              </div>
            </div>

            {/* Inactive Tabs */}
            <div className="flex flex-col items-center justify-center w-1/5 text-slate-500 hover:text-slate-300 transition-colors">
              <BarChart2 className="w-5 h-5 mb-1" />
            </div>
            <div className="flex flex-col items-center justify-center w-1/5 text-slate-500 hover:text-slate-300 transition-colors">
              <ShoppingCart className="w-5 h-5 mb-1" />
            </div>
            <div className="flex flex-col items-center justify-center w-1/5 text-slate-500 hover:text-slate-300 transition-colors">
              <Lock className="w-5 h-5 mb-1" />
            </div>
            <div className="flex flex-col items-center justify-center w-1/5 text-slate-500 hover:text-slate-300 transition-colors relative">
              <div className="absolute top-1 right-3 w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse" />
              <Sparkles className="w-5 h-5 mb-1" />
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
