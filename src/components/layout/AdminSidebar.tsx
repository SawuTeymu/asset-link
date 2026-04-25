import React from 'react';
import { useRouter } from 'next/navigation';

/**
 * ==========================================
 * 檔案：src/components/layout/AdminSidebar.tsx
 * 物理職責：全域共用之側邊導覽列 (解決 4 大頁面重複代碼問題)
 * ==========================================
 */

interface AdminSidebarProps {
  currentRoute: '/admin' | '/pending' | '/nsr' | '/internal';
  isOpen: boolean;
  onLogout: () => void;
}

export default function AdminSidebar({ currentRoute, isOpen, onLogout }: AdminSidebarProps) {
  const router = useRouter();

  return (
    <aside className={`fixed left-0 top-0 h-screen w-64 bg-white/40 backdrop-blur-3xl border-r border-white/40 p-6 flex flex-col z-[140] transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
      <div className="flex items-center gap-3 mb-12">
        <div className="w-10 h-10 rounded-xl bg-[#0058bc] flex items-center justify-center text-white shadow-lg">
          <span className="material-symbols-outlined">token</span>
        </div>
        <div>
          <h1 className="text-lg font-black tracking-tighter text-slate-800">Asset-Link</h1>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Admin Hub V0.0</p>
        </div>
      </div>
      
      <nav className="flex-1 space-y-1.5">
        <button onClick={() => router.push("/admin")} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${currentRoute === '/admin' ? 'bg-blue-600/10 text-blue-600 border-l-4 border-blue-600' : 'text-slate-500 hover:bg-white/50'}`}>
          <span className="material-symbols-outlined">dashboard</span>控制面板總覽
        </button>
        
        <div className="pt-8 pb-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">業務調度中心</div>
        
        <button onClick={() => router.push("/pending")} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${currentRoute === '/pending' ? 'bg-blue-600/10 text-blue-600 border-l-4 border-blue-600' : 'text-slate-500 hover:bg-white/50'}`}>
          <span className="material-symbols-outlined text-orange-500">pending_actions</span>待核定 ERI 案件
        </button>
        
        <button onClick={() => router.push("/nsr")} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${currentRoute === '/nsr' ? 'bg-blue-600/10 text-blue-600 border-l-4 border-blue-600' : 'text-slate-500 hover:bg-white/50'}`}>
          <span className="material-symbols-outlined text-blue-500">hub</span>網點需求 NSR
        </button>

        <button onClick={() => router.push("/internal")} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${currentRoute === '/internal' ? 'bg-blue-600/10 text-blue-600 border-l-4 border-blue-600' : 'text-slate-500 hover:bg-white/50'}`}>
          <span className="material-symbols-outlined text-emerald-500">flash_on</span>內部緊急配發
        </button>
      </nav>

      <div className="mt-auto pt-6 border-t border-slate-200">
         <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[#ba1a1a] font-black hover:bg-red-50 transition-all">
            <span className="material-symbols-outlined">logout</span>安全登出
         </button>
      </div>
    </aside>
  );
}