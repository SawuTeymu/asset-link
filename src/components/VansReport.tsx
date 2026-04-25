import React from 'react';

/**
 * ==========================================
 * 檔案：src/components/  
 * 物理職責：VANS API 深度稽核報告 (組件 46-50)
 * 來源：原 vans_report_components.html 轉譯
 * ==========================================
 */

export default function VansReport() {
  return (
    <div className="max-w-[1300px] mx-auto space-y-6 font-[family-name:-apple-system,BlinkMacSystemFont,'SF_Pro_TC','PingFang_TC',system-ui,sans-serif] text-[10.5px]">
      
      {/* 46. USB 物理儲存與外設對沖 */}
      <div className="glass-panel p-6 bg-white/40 border border-white/60 shadow-sm rounded-2xl">
        <h3 className="text-sm font-black tracking-tight mb-4 text-slate-800 flex items-center gap-2">
          <span className="material-symbols-outlined text-orange-500">usb</span>
          46. 非授權 USB 儲存裝置物理偵測對沖
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="text-[9px] text-slate-400 border-b border-slate-200">
                <th className="pb-2 font-bold uppercase tracking-widest">設備位置</th>
                <th className="pb-2 font-bold uppercase tracking-widest">USB 裝置名稱</th>
                <th className="pb-2 font-bold uppercase tracking-widest">序號 (S/N)</th>
                <th className="pb-2 font-bold uppercase tracking-widest">Asset-Link 狀態</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="py-3 font-bold text-slate-700">A-2F-財委會</td>
                <td className="py-3 text-slate-600">SanDisk Ultra USB 3.0</td>
                <td className="py-3 font-mono text-[10px] text-slate-500">4C5310...</td>
                <td className="py-3"><span className="px-2 py-1 rounded bg-red-50 text-red-600 font-black text-[9px] uppercase">非法掛載</span></td>
              </tr>
              <tr>
                <td className="py-3 font-bold text-slate-700">H-B1-醫材庫</td>
                <td className="py-3 text-slate-600">Generic USB Hub</td>
                <td className="py-3 font-mono text-[10px] text-slate-500">A02194...</td>
                <td className="py-3"><span className="px-2 py-1 rounded bg-slate-100 text-slate-500 font-black text-[9px] uppercase">已知外設</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 47. API 端點調用熱點圖 */}
      <div className="glass-panel p-6 bg-white/40 border border-white/60 shadow-sm rounded-2xl">
        <h3 className="text-sm font-black tracking-tight mb-4 text-slate-800 flex items-center gap-2">
          <span className="material-symbols-outlined text-blue-500">api</span>
          47. VANS API 端點調用負載分佈
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
            <p className="text-[9px] text-slate-500 font-mono font-bold">/vuln/sync</p>
            <p className="font-black text-sm text-blue-700 mt-1">High</p>
          </div>
          <div className="p-3 bg-blue-50/50 border border-blue-50 rounded-xl">
            <p className="text-[9px] text-slate-500 font-mono font-bold">/asset/list</p>
            <p className="font-black text-sm text-blue-600 mt-1">Med</p>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
            <p className="text-[9px] text-slate-500 font-mono font-bold">/auth/token</p>
            <p className="font-black text-sm text-slate-600 mt-1">Low</p>
          </div>
          <div className="p-3 bg-red-50 border border-red-100 rounded-xl">
            <p className="text-[9px] text-red-500 font-mono font-bold">/system/err</p>
            <p className="font-black text-sm text-red-600 mt-1 animate-pulse">Spike</p>
          </div>
        </div>
      </div>

      {/* 48. 系統安全啟動合規狀態 */}
      <div className="glass-panel p-6 bg-white/40 border border-white/60 border-l-4 border-l-indigo-500 shadow-sm rounded-2xl">
        <h3 className="text-sm font-black tracking-tight mb-4 text-slate-800 flex items-center gap-2">
          <span className="material-symbols-outlined text-indigo-500">security</span>
          48. 設備韌體 (UEFI/Secure Boot) 合規狀態
        </h3>
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex-1 text-center w-full p-4 bg-white/50 rounded-xl">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Secure Boot 開啟率</p>
            <p className="text-2xl font-black text-indigo-600 mt-1">92.4%</p>
          </div>
          <div className="flex-1 text-center w-full p-4 bg-white/50 rounded-xl">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">TPM 2.0 啟用率</p>
            <p className="text-2xl font-black text-indigo-600 mt-1">88.2%</p>
          </div>
          <div className="flex-1 text-center w-full p-4 bg-red-50/50 rounded-xl border border-red-100">
            <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest">CSM 兼容模式 (風險)</p>
            <p className="text-2xl font-black text-red-600 mt-1">12 <span className="text-xs text-red-400">台</span></p>
          </div>
        </div>
      </div>

      {/* 49. 管理員人工標記與行政附註 */}
      <div className="glass-panel p-6 bg-white/40 border border-white/60 shadow-sm rounded-2xl">
        <h3 className="text-sm font-black tracking-tight mb-4 text-slate-800 flex items-center gap-2">
          <span className="material-symbols-outlined text-amber-500">edit_note</span>
          49. 管理員人工標記與行政例外附註
        </h3>
        <div className="space-y-3">
          <div className="p-3 bg-amber-50/50 rounded-xl flex gap-3 border border-amber-100">
            <div className="w-1 bg-amber-400 rounded-full"></div>
            <div>
              <p className="text-[10px] font-black text-slate-800">資產 VDS-9901 (MRI)</p>
              <p className="text-[10px] text-slate-500 italic mt-1 font-bold">"廠商回報：系統限制無法修補 KB5034, 已採物理斷網防護。" - 04/22 管理員 A</p>
            </div>
          </div>
          <div className="p-3 bg-blue-50/50 rounded-xl flex gap-3 border border-blue-100">
            <div className="w-1 bg-blue-400 rounded-full"></div>
            <div>
              <p className="text-[10px] font-black text-slate-800">批次對沖偏差 (A 棟 4F)</p>
              <p className="text-[10px] text-slate-500 italic mt-1 font-bold">"確認為測試網段，MAC 變動屬正常開發行為。" - 04/22 管理員 B</p>
            </div>
          </div>
        </div>
      </div>

      {/* 50. 全局總結與匯出 */}
      <div className="glass-panel p-6 bg-slate-900 border border-slate-800 shadow-xl rounded-2xl text-white">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h3 className="text-sm font-black tracking-tight flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-400">check_circle</span>
              50. 全院 VANS API 資安對沖全局總結
            </h3>
            <p className="text-[9px] text-slate-400 mt-1 uppercase tracking-widest font-bold">資料最後更新：{new Date().toISOString().split('T')[0]} 13:30:00</p>
          </div>
          <button className="bg-white text-slate-900 text-[10px] px-5 py-2.5 rounded-xl font-black uppercase tracking-widest active:scale-95 transition-all shadow-md flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">download</span> 匯出行政核銷報告
          </button>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="p-4 bg-white/5 rounded-xl border border-white/10">
            <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">總體風險等級</p>
            <p className="text-sm font-black text-emerald-400 uppercase mt-1">Low Risk</p>
          </div>
          <div className="p-4 bg-white/5 rounded-xl border border-white/10">
            <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">資產對沖精準度</p>
            <p className="text-sm font-black text-white mt-1">99.85%</p>
          </div>
          <div className="p-4 bg-white/5 rounded-xl border border-white/10">
            <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">系統穩定性指數</p>
            <p className="text-sm font-black text-white mt-1">A+</p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-700/50">
          <p className="text-[9px] text-center text-slate-500 leading-relaxed font-bold tracking-wide">
            本報告由 Asset-Link 自動對沖引擎生成，具備法律與行政稽核效力。<br/>
            © 2026 Asset-Link System Administration.
          </p>
        </div>
      </div>

    </div>
  );
}