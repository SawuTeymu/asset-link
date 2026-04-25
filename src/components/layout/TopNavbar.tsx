import React from 'react';

/**
 * ==========================================
 * 檔案：src/components/layout/TopNavbar.tsx
 * 物理職責：全域共用之頂部導覽列 (解決重複代碼)
 * ==========================================
 */

interface TopNavbarProps {
  title: string;
  subtitle?: string;
  searchQuery?: string;
  onSearchChange?: (val: string) => void;
  onMenuToggle: () => void;
  showSearch?: boolean;
}

export default function TopNavbar({ 
  title, 
  subtitle = "Supabase 雲端鏈路穩定監控中", 
  searchQuery = "", 
  onSearchChange, 
  onMenuToggle,
  showSearch = true 
}: TopNavbarProps) {
  return (
    <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10">
      <div>
        <h2 className="text-2xl font-black tracking-tight text-slate-900">{title}</h2>
        <div className="flex items-center gap-2 mt-2">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
          <p className="text-slate-500 font-bold uppercase text-[9.5px] tracking-widest">{subtitle}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-4 w-full md:w-auto">
        {showSearch && onSearchChange && (
          <input 
            title="全域搜尋"
            aria-label="全域搜尋"
            value={searchQuery} 
            onChange={(e) => onSearchChange(e.target.value)} 
            placeholder="全域搜尋 IP / SN / 單位..." 
            className="flex-1 md:w-64 px-4 py-2.5 bg-white/60 border border-white/60 rounded-full font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all shadow-sm" 
          />
        )}
        <button 
          onClick={onMenuToggle} 
          className="lg:hidden p-2.5 bg-white/40 backdrop-blur-md border border-white/60 shadow-sm rounded-xl hover:bg-white/60 transition-colors"
        >
          <span className="material-symbols-outlined text-slate-600">menu</span>
        </button>
      </div>
    </header>
  );
}