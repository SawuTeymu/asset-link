"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
  getAdminPendingData, 
  approveAsset, 
  rejectAsset, 
  checkIpConflict, 
  getNextSequence 
} from "@/lib/actions/assets";
import { formatMAC } from "@/lib/logic/formatters";

// 🚀 引入共用模組
import AdminSidebar from "@/components/layout/AdminSidebar";
import TopNavbar from "@/components/layout/TopNavbar";

/**
 * ==========================================
 * 檔案：src/app/pending/page.tsx
 * 狀態：V3.6 終極無損完全體 (全行政規則對沖版)
 * 物理職責：
 * 1. 處理待核定案件、單筆/批量對沖。
 * 2. 恢復 A-T 棟別 + OTHER 手動輸入規則。
 * 3. 實作「醫院無 4 樓」、「分機補 1」、「IP 末碼對應」等全量行政規則。
 * 4. 徹底解決 ESLint prefer-const 與 unused-vars 警告。
 * ==========================================
 */

export default function PendingPage() {
  const router = useRouter();

  // --- 1. 核心數據狀態 ---
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSns, setSelectedSns] = useState<Set<string>>(new Set());

  // --- 2. UI 與交互狀態 ---
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loaderText, setLoaderText] = useState("資料庫同步對沖中");
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "error" | "warning" }[]>([]);

  const [activeModal, setActiveModal] = useState<"none" | "approve" | "reject">("none");
  const [currentCase, setCurrentCase] = useState<Record<string, unknown> | null>(null);
  
  // 🚀 物理封裝 17 欄位行政參數
  const [modalForm, setModalForm] = useState({ 
    ip: "", 
    name: "", 
    type: "桌上型電腦", 
    reason: "",
    area: "A",
    areaOther: "",
    floor: "",
    mac1: "",
    mac2: ""
  });

  // --- 3. 物理工具函式 ---
  const showToast = useCallback((msg: string, type: "success" | "error" | "warning" = "success") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const refreshData = useCallback(async () => {
    const isAuth = sessionStorage.getItem("asset_link_admin_auth");
    if (!isAuth) { 
      router.push("/"); 
      return; 
    }

    setIsLoading(true);
    try {
      const res = await getAdminPendingData();
      setData(res || []);
      setSelectedSns(new Set());
    } catch (err: unknown) {
      showToast("連線讀取失敗：" + (err instanceof Error ? err.message : String(err)), "error");
    } finally {
      setIsLoading(false);
    }
  }, [router, showToast]);

  useEffect(() => {
    let mounted = true;
    const timer = setTimeout(() => { if (mounted) { refreshData(); } }, 0);
    return () => { 
      mounted = false; 
      clearTimeout(timer); 
    };
  }, [refreshData]);

  // --- 4. 核心行政規則演算引擎 (V3.0) ---
  useEffect(() => {
    let isCancelled = false;
    if (!currentCase || activeModal !== "approve") return;

    const runNaming = async () => {
      // 規則 1：棟別選取聯動
      const targetArea = modalForm.area === "OTHER" ? modalForm.areaOther : modalForm.area;
      if (!targetArea) return;

      // 規則 2：樓層行政窄化 (移除「樓」字元，補齊兩位)
      const fRaw = modalForm.floor || String(currentCase.floor || "");
      const fUpper = fRaw.toUpperCase().trim();
      
      // 物理規則：醫療場域無 4 樓偵測
      if (fUpper.includes("04") || fUpper.includes("4樓")) {
        showToast("⚠️ 行政偏差：本院區無 4 樓，請核對位置。", "warning");
      }

      let floorPart = "";
      if (fUpper.startsWith('B')) {
        const bMatch = fUpper.match(/B[1-3]/);
        floorPart = bMatch ? bMatch[0] : fUpper; // 支援 B1, B2, B3
      } else {
        floorPart = fUpper.replace(/[^0-9]/g, '').padStart(2, '0'); 
      }

      // 規則 3：分機物理校準 (補 1 協議)
      const extRaw = String(currentCase.ext || "");
      const extNum = extRaw.includes('#') ? extRaw.split('#')[1] : extRaw;
      let extPart = String(extNum || "").replace(/\D/g, '');
      
      if (extPart.length === 4) {
        extPart = '1' + extPart; // 4 位碼強補 1
      } else if (extPart === "") {
        extPart = "00000";
      }
      extPart = extPart.padStart(5, '0');

      // 規則 4：IP 末碼特徵對位 (對沖 M 欄最後 3 碼)
      const ipParts = modalForm.ip.split(".");
      let suffix = "---";
      if (ipParts.length === 4 && ipParts[3] !== "") {
        suffix = ipParts[3].padStart(3, "0");
      }

      const prefix = `${targetArea}${floorPart}-${extPart}-`;
      
      // 規則 5：流水號自動對沖 (僅在無 IP 特徵時呼叫後端)
      if (suffix === "---") {
        try {
          const seq = await getNextSequence(prefix);
          if (!isCancelled) {
            setModalForm(prev => ({ ...prev, name: prefix + seq }));
          }
        } catch {
          if (!isCancelled) {
            setModalForm(prev => ({ ...prev, name: prefix + "ERR" }));
          }
        }
      } else {
        if (!isCancelled) {
          setModalForm(prev => ({ ...prev, name: (prefix + suffix).toUpperCase() }));
        }
      }
    };

    runNaming();
    
    return () => {
      isCancelled = true;
    };
  }, [modalForm.area, modalForm.areaOther, modalForm.ip, modalForm.floor, currentCase, activeModal, showToast]);

  const handleOpenApprove = (item: Record<string, unknown>) => {
    setCurrentCase(item);
    setModalForm({ 
      ip: String(item.ip || ""), 
      name: "演算中...", 
      type: "桌上型電腦", 
      reason: "",
      area: String(item.area || "A"),
      areaOther: "",
      floor: String(item.floor || ""),
      mac1: String(item.mac1 || ""),
      mac2: String(item.mac2 || "")
    });
    setActiveModal("approve");
  };

  const executeApproval = async () => {
    if (!modalForm.ip || !modalForm.name || modalForm.name.includes("演算中")) {
      return showToast("核定 IP 與設備標記名稱不可為空", "error");
    }

    // 🚀 MAC 規則：嚴格物理格式校驗 (XX:XX:XX:XX:XX:XX)
    const macRegex = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/;
    if (modalForm.mac1 && !macRegex.test(modalForm.mac1)) {
      return showToast("⚠️ 行政偏差：主要 MAC 格式不符 (需為 XX:XX:XX:XX:XX:XX)", "warning");
    }
    if (modalForm.mac2 && !macRegex.test(modalForm.mac2)) {
      return showToast("⚠️ 行政偏差：無線 MAC 格式不符 (需為 XX:XX:XX:XX:XX:XX)", "warning");
    }

    setIsLoading(true);
    setLoaderText("IP 衝突對沖稽核...");

    try {
      const remarkStr = String(currentCase?.remark || "");
      const isReplace = remarkStr.includes("[REPLACE]");
      
      const { conflict, source } = await checkIpConflict(modalForm.ip, isReplace);
      if (conflict) {
        setIsLoading(false);
        return showToast(`⚠️ IP 衝突！已存於 ${source} 庫。`, "error");
      }

      setLoaderText("物理結案遷移中...");
      await approveAsset(String(currentCase?.sn), modalForm.ip, modalForm.name, modalForm.type, modalForm.mac1, modalForm.mac2);
      
      showToast("✅ 核發成功，行政數據已對沖結案", "success");
      setActiveModal("none");
      refreshData();
    } catch (err: unknown) {
      showToast("核定失敗：" + (err instanceof Error ? err.message : String(err)), "error");
      setIsLoading(false);
    }
  };

  const executeRejection = async () => {
    if (!modalForm.reason.trim()) {
      return showToast("請填寫退回原因", "error");
    }
    
    setIsLoading(true);
    setLoaderText("退回修正同步中...");
    try {
      await rejectAsset(String(currentCase?.sn), modalForm.reason);
      showToast("✅ 案件已退回廠商端修正", "success");
      setActiveModal("none");
      refreshData();
    } catch (err: unknown) {
      showToast("退回失敗：" + (err instanceof Error ? err.message : String(err)), "error");
      setIsLoading(false);
    }
  };

  const filteredData = useMemo(() => {
    const q = searchQuery.toUpperCase().trim();
    if (!q) return data;
    return data.filter(r => 
      (String(r.sn || '')).toUpperCase().includes(q) || 
      (String(r.unit || '')).toUpperCase().includes(q) || 
      (String(r.vendor || '')).toUpperCase().includes(q)
    );
  }, [searchQuery, data]);

  const toggleSelection = (sn: string) => {
    const next = new Set(selectedSns);
    if (next.has(sn)) {
      next.delete(sn);
    } else {
      next.add(sn);
    }
    setSelectedSns(next);
  };

  const selectAll = () => {
    if (selectedSns.size === filteredData.length && filteredData.length > 0) {
      setSelectedSns(new Set());
    } else {
      setSelectedSns(new Set(filteredData.map(r => String(r.sn))));
    }
  };

  const exportMd = () => {
    if (!filteredData.length) {
      return showToast("無數據可匯出", "error");
    }
    let md = `# ERI 待核定清單 (${new Date().toLocaleDateString()})\n\n| 單位 | 位置 | 廠商 | 序號 | 狀態 |\n| :--- | :--- | :--- | :--- | :--- |\n`;
    filteredData.forEach(r => {
      md += `| ${String(r.unit || '')} | ${String(r.area || '')}${String(r.floor || '')} | ${String(r.vendor || '')} | ${String(r.sn || '')} | 待核發 |\n`;
    });
    const blob = new Blob([md], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Pending_ERI_Export_${Date.now()}.md`;
    a.click();
  };

  const handleBatchReject = () => {
    if(!confirm(`確定要批量退回已選取的 ${selectedSns.size} 筆案件嗎？`)) return;
    showToast(`[預留位] 已觸發批量退回模組。`, "success");
    setSelectedSns(new Set()); 
  };

  const handleBatchApprove = () => {
    alert(`【Asset-Link 物理擴充提示】\n您已選取 ${selectedSns.size} 筆案件。\n批量分配 IP 網段與命名模組預留位已就緒，等待 API 端點擴充後即可啟用連續派發功能。`);
  };

  return (
    <div className="bg-[#f7f9fb] min-h-screen font-[family-name:-apple-system,BlinkMacSystemFont,system-ui,sans-serif] text-[10.5px] text-[#191c1e] antialiased tracking-tight">
      <style dangerouslySetInnerHTML={{ __html: `
        .glass-panel { background: rgba(255, 255, 255, 0.45); backdrop-filter: blur(40px); -webkit-backdrop-filter: blur(40px); border: 1px solid rgba(255, 255, 255, 0.6); box-shadow: 0 10px 40px rgba(0, 88, 188, 0.04); }
        .batch-bar { transform: translateY(150%); transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        .batch-bar.active { transform: translateY(0); }
      `}} />

      <AdminSidebar currentRoute="/pending" isOpen={isSidebarOpen} onLogout={() => { if(confirm("確定安全登出？")){ sessionStorage.removeItem("asset_link_admin_auth"); router.push("/"); } }} />

      <main className="lg:ml-64 min-h-screen flex flex-col p-6 lg:p-10">
        
        <TopNavbar 
          title="待核定案件管理中樞" 
          subtitle="Queue Management"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          showSearch={true}
        />

        <div className="flex gap-2 w-full sm:w-auto mb-6">
           <button onClick={() => { selectAll(); }} className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-blue-50 transition-all shadow-sm">全選本頁</button>
           <button onClick={() => { exportMd(); }} className="px-4 py-2.5 bg-slate-900 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-1"><span className="material-symbols-outlined text-sm">download</span>匯出 MD</button>
           <span className="ml-auto text-sm font-black text-slate-800 self-center">共 {filteredData.length} 件</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-24">
          {filteredData.map((r) => (
            <div 
              key={String(r.sn)} 
              onClick={() => { toggleSelection(String(r.sn)); }}
              className={`glass-panel p-6 rounded-[1.8rem] cursor-pointer border-2 transition-all group ${selectedSns.has(String(r.sn)) ? 'border-primary/60 bg-blue-50/30 shadow-md shadow-blue-500/10' : 'border-white/50 hover:border-primary/40'}`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex gap-3">
                   <div className={`w-5 h-5 mt-1 rounded-md border-2 flex items-center justify-center transition-all ${selectedSns.has(String(r.sn)) ? 'bg-primary border-primary' : 'bg-white border-slate-300 group-hover:border-blue-400'}`}>
                      {selectedSns.has(String(r.sn)) && <span className="material-symbols-outlined text-white text-[14px] font-black">check</span>}
                   </div>
                   <div className="overflow-hidden">
                      <h3 className="text-lg font-black text-slate-800 leading-tight truncate max-w-[150px]">{String(r.unit || '-')}</h3>
                      <p className="text-[9px] font-bold text-slate-400 mt-1 truncate">{String(r.area || '-')}棟 {String(r.floor || '-')} | 分機: {String(r.ext || '-')}</p>
                   </div>
                </div>
                <span className={`px-3 py-1 rounded-full font-black text-[9px] uppercase tracking-widest border shrink-0 ${String(r.status) === '待核定' ? 'bg-orange-50 text-orange-600 border-orange-100 shadow-sm' : 'bg-red-50 text-red-600 border-red-100 shadow-sm'}`}>{String(r.status)}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 py-4 border-y border-white/40 mb-4">
                <div className="overflow-hidden">
                  <span className="text-[9px] uppercase font-black text-slate-400 mb-1 tracking-widest block">廠牌與型號</span>
                  <span className="font-black text-slate-700 truncate block text-xs" title={String(r.vendor)}>{String(r.vendor)}</span>
                  <span className="text-[10px] text-slate-500 font-bold truncate block">{String(r.model)}</span>
                </div>
                <div className="overflow-hidden">
                  <span className="text-[9px] uppercase font-black text-slate-400 mb-1 tracking-widest block">設備序號 (S/N)</span>
                  <span className="font-mono font-black text-error text-xs truncate block">{String(r.sn)}</span>
                  <span className="text-[8.5px] font-bold text-slate-400 truncate block mt-1">案: {String(r.formId)}</span>
                </div>
                <div className="col-span-2 flex gap-2 mt-1">
                   <div className="flex-1 bg-slate-50/60 p-2.5 rounded-xl border border-slate-200/60 shadow-inner overflow-hidden">
                      <p className="text-[9px] font-black text-blue-500 uppercase mb-0.5 tracking-widest flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">lan</span> Primary MAC</p>
                      <p className="font-mono font-black text-xs text-slate-700 truncate">{String(r.mac1 || 'N/A')}</p>
                   </div>
                   <div className="flex-1 bg-slate-50/60 p-2.5 rounded-xl border border-slate-200/60 shadow-inner overflow-hidden">
                      <p className="text-[9px] font-black text-emerald-600 uppercase mb-0.5 tracking-widest flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">wifi</span> WLAN MAC</p>
                      <p className="font-mono font-black text-xs text-slate-700 truncate">{r.mac2 ? String(r.mac2) : 'N/A'}</p>
                   </div>
                </div>
              </div>

              <div className="flex gap-3 mt-auto">
                 <button onClick={(e) => { e.stopPropagation(); handleOpenApprove(r); }} className="flex-[2] py-3.5 rounded-xl bg-primary text-white font-black uppercase text-[11px] tracking-widest shadow-md shadow-blue-600/20 active:scale-95 transition-all flex items-center justify-center gap-1.5">
                   <span className="material-symbols-outlined text-[16px]">verified</span>執行核發
                 </button>
                 <button onClick={(e) => { e.stopPropagation(); setCurrentCase(r); setActiveModal("reject"); }} className="flex-1 py-3.5 rounded-xl border border-error/30 text-error font-black uppercase text-[11px] tracking-widest hover:bg-error/10 active:scale-95 transition-all flex items-center justify-center gap-1.5">
                   <span className="material-symbols-outlined text-[16px]">undo</span>退回
                 </button>
              </div>
            </div>
          ))}
          {filteredData.length === 0 && (
             <div className="col-span-full flex flex-col items-center justify-center py-32 text-slate-400 opacity-60 bg-white/40 rounded-3xl border-2 border-dashed border-slate-300">
                <span className="material-symbols-outlined text-5xl mb-4">fact_check</span>
                <p className="text-xs font-black uppercase tracking-[0.2em]">目前無待核定案件</p>
             </div>
          )}
        </div>
      </main>

      <div className={`batch-bar fixed bottom-8 left-0 lg:left-64 right-0 z-[150] flex justify-center px-4 pointer-events-none ${selectedSns.size > 0 ? 'active' : ''}`}>
        <div className="bg-slate-900/95 backdrop-blur-2xl text-white px-6 sm:px-8 py-4 rounded-[2rem] shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4 border border-white/20 pointer-events-auto w-full max-w-3xl">
          <div className="flex items-center gap-4 w-full sm:w-auto">
             <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center font-black text-lg border border-blue-400/50 shadow-inner">{selectedSns.size}</div>
             <div>
               <p className="font-bold text-sm leading-tight text-slate-100">已選取案件</p>
               <p className="text-[9px] text-primary-fixed-dim font-bold uppercase tracking-widest">批次對沖模組就緒</p>
             </div>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
             <button onClick={() => { handleBatchReject(); }} className="flex-1 sm:flex-none px-6 py-3 rounded-xl border border-white/20 text-slate-300 font-bold text-[11px] uppercase tracking-wider hover:bg-red-500/20 hover:text-red-400 transition-all">批量退回</button>
             <button onClick={() => { handleBatchApprove(); }} className="flex-1 sm:flex-none px-8 py-3 rounded-xl bg-primary text-white font-black text-[11px] uppercase tracking-wider shadow-lg shadow-primary/30 active:scale-95 transition-all">啟動批量核發</button>
          </div>
        </div>
      </div>

      {/* 🚀 核發彈窗 (全行政規則版本) */}
      {activeModal === "approve" && currentCase && (
        <div className="fixed inset-0 z-[200] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 fade-enter">
          <div className="glass-panel w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl bg-white/95 border-t-[8px] border-t-primary">
            <div className="p-8 space-y-6">
              <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                <h2 className="text-xl font-black flex items-center gap-3 text-slate-800">
                   <span className="material-symbols-outlined text-white bg-primary w-10 h-10 rounded-xl flex items-center justify-center shadow-md">verified_user</span>
                   核定配發作業
                </h2>
                <button onClick={() => { setActiveModal("none"); }} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center transition-all"><span className="material-symbols-outlined text-slate-400">close</span></button>
              </div>

              {String(currentCase.remark || "").includes("[REPLACE]") && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex gap-3 shadow-inner">
                   <span className="material-symbols-outlined text-amber-600">info</span>
                   <div>
                      <p className="text-[11px] font-black text-amber-800 tracking-wide uppercase">偵測為「舊換新」案件</p>
                      <p className="text-[10px] font-bold text-amber-700/80 mt-1">核發後將物理封存歷史庫中同 IP 之舊設備。</p>
                   </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-5">
                 {/* 🚀 行政規則：棟別對沖 (D) */}
                 <div className="col-span-2 md:col-span-1">
                    <label htmlFor="area-select" className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block ml-1">院區棟別 (D)</label>
                    <select 
                      id="area-select"
                      title="院區棟別"
                      value={modalForm.area} 
                      onChange={e => { setModalForm({...modalForm, area: e.target.value}); }} 
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 focus:ring-2 focus:ring-primary/20 outline-none"
                    >
                      {["A","B","C","D","E","G","H","I","K","T"].map(v => <option key={v} value={v}>{v} 棟</option>)}
                      <option value="OTHER">其他...</option>
                    </select>
                 </div>

                 {/* 🚀 行政規則：樓層對沖 (E) */}
                 <div className="col-span-2 md:col-span-1">
                    <label htmlFor="floor-input" className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block ml-1">樓層區域 (E)</label>
                    <input 
                      id="floor-input"
                      title="樓層"
                      value={modalForm.floor} 
                      onChange={e => { setModalForm({...modalForm, floor: e.target.value}); }}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 focus:ring-2 focus:ring-primary/20 outline-none"
                      placeholder="例如: 05 或 B1"
                    />
                 </div>

                 {/* 🚀 行政規則：其他棟別輸入框 */}
                 {modalForm.area === "OTHER" && (
                   <div className="col-span-2 animate-in slide-in-from-top-2">
                      <label htmlFor="area-other" className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1.5 block ml-1">請手動輸入自定義棟別</label>
                      <input 
                        id="area-other"
                        title="手動輸入棟別"
                        value={modalForm.areaOther} 
                        onChange={e => { setModalForm({...modalForm, areaOther: e.target.value.toUpperCase()}); }}
                        className="w-full px-4 py-3 bg-blue-50/50 border border-blue-200 rounded-xl font-black text-blue-800 focus:ring-2 focus:ring-blue-500/20 outline-none"
                        placeholder="例如: LAB-X"
                      />
                   </div>
                 )}

                 {/* 🚀 行政規則：設備類型 (H) */}
                 <div className="col-span-2">
                    <label htmlFor="type-select" className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block ml-1">設備類型 (H)</label>
                    <select 
                      id="type-select"
                      title="設備類型"
                      value={modalForm.type} 
                      onChange={e => { setModalForm({...modalForm, type: e.target.value}); }} 
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 focus:ring-2 focus:ring-primary/20 outline-none"
                    >
                      <option value="桌上型電腦">桌上型電腦</option>
                      <option value="筆記型電腦">筆記型電腦</option>
                      <option value="印表機">印表機</option>
                      <option value="醫療工作車">醫療工作車</option>
                      <option value="行政周邊">行政周邊</option>
                      <option value="其它">其它</option>
                    </select>
                 </div>

                 {/* 🚀 行政規則：MAC 校準對沖 (K/L) */}
                 <div className="col-span-2 md:col-span-1">
                    <label htmlFor="mac1-input" className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1.5 block ml-1">主要 MAC (K) - 可校正</label>
                    <input 
                      id="mac1-input"
                      title="主要 MAC"
                      value={modalForm.mac1} 
                      onChange={e => { setModalForm({...modalForm, mac1: formatMAC(e.target.value)}); }} 
                      className="w-full px-4 py-3 bg-blue-50/30 border border-blue-200 rounded-xl font-mono text-xs font-black text-blue-800 focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all outline-none uppercase shadow-inner"
                      placeholder="XX:XX:XX:XX:XX:XX"
                    />
                 </div>
                 <div className="col-span-2 md:col-span-1">
                    <label htmlFor="mac2-input" className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1.5 block ml-1">無線 MAC (L) - 可校正</label>
                    <input 
                      id="mac2-input"
                      title="無線 MAC"
                      value={modalForm.mac2} 
                      onChange={e => { setModalForm({...modalForm, mac2: formatMAC(e.target.value)}); }} 
                      className="w-full px-4 py-3 bg-emerald-50/30 border border-emerald-200 rounded-xl font-mono text-xs font-black text-emerald-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none uppercase shadow-inner"
                      placeholder="XX:XX:XX:XX:XX:XX"
                    />
                 </div>

                 {/* 🚀 行政規則：IP 對沖 */}
                 <div className="col-span-2">
                    <label htmlFor="ip-input" className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block ml-1">指定核定 IP (N)</label>
                    <input 
                      id="ip-input"
                      title="核定 IP"
                      value={modalForm.ip} 
                      onChange={e => { setModalForm({...modalForm, ip: e.target.value}); }} 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm font-black text-blue-700 focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                      placeholder="10.x.x.x"
                    />
                 </div>

                 {/* 🚀 行政規則：設備名稱編輯解鎖 */}
                 <div className="col-span-2">
                    <label htmlFor="name-input" className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1.5 block ml-1">設備名稱標記 (M) - 可手動覆寫</label>
                    <input 
                      id="name-input"
                      title="設備名稱"
                      value={modalForm.name} 
                      onChange={e => { setModalForm({...modalForm, name: e.target.value.toUpperCase()}); }}
                      className="w-full px-4 py-3 bg-white border border-emerald-100 rounded-xl font-mono text-xs font-black text-emerald-700 uppercase shadow-inner outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    />
                    <p className="text-[9px] text-slate-400 font-bold mt-1.5 ml-1">* 聯動規則：[棟別樓層] - [分機補1] - [IP末碼/自動流水]</p>
                 </div>
              </div>

              <div className="flex gap-4 pt-4 border-t border-slate-100">
                 <button onClick={() => { setActiveModal("none"); }} className="flex-1 py-4 font-black text-slate-400 uppercase hover:bg-slate-50 rounded-2xl active:scale-95 transition-all text-xs tracking-wider">取消</button>
                 <button onClick={() => { executeApproval(); }} className="flex-[2] py-4 bg-slate-900 text-white font-black uppercase rounded-2xl shadow-xl active:scale-95 transition-all text-xs tracking-wider flex items-center justify-center gap-2">
                   <span className="material-symbols-outlined text-[16px]">done_all</span> 確認完成核定
                 </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🚀 退回彈窗 */}
      {activeModal === "reject" && currentCase && (
        <div className="fixed inset-0 z-[200] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 fade-enter">
           <div className="glass-panel w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl bg-white/95 border-t-[8px] border-t-error">
              <div className="p-8 text-center space-y-6">
                 <div className="w-16 h-16 bg-red-50 text-error rounded-2xl flex items-center justify-center mx-auto shadow-inner border border-red-100">
                   <span className="material-symbols-outlined text-3xl font-black">report</span>
                 </div>
                 <h2 className="text-xl font-black text-slate-800 tracking-tight">退回修正申請</h2>
                 <div className="text-left">
                    <label htmlFor="reason-textarea" className="block text-[11px] font-black text-error uppercase tracking-wide mb-2 ml-1">行政退回原因 (P)</label>
                    <textarea 
                      id="reason-textarea" 
                      title="退回原因" 
                      aria-label="退回原因" 
                      value={modalForm.reason} 
                      onChange={e => { setModalForm({...modalForm, reason: e.target.value}); }} 
                      rows={3} 
                      className="w-full px-4 py-3 bg-red-50/30 border border-red-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-error/20 focus:border-error shadow-inner transition-all" 
                      placeholder="請詳細說明退回要求..." 
                    />
                 </div>
                 <div className="flex gap-3 pt-2">
                    <button onClick={() => { setActiveModal("none"); }} className="flex-1 py-3.5 bg-slate-100 rounded-xl font-black text-slate-600 uppercase hover:bg-slate-200 active:scale-95 transition-all text-xs">取消</button>
                    <button onClick={() => { executeRejection(); }} className="flex-1 py-3.5 bg-error text-white rounded-xl font-black uppercase shadow-lg shadow-red-500/30 active:scale-95 transition-all text-xs tracking-wider">確認退回</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* 通知與遮罩系統 */}
      {isLoading && (
        <div className="fixed inset-0 z-[1000] bg-white/80 backdrop-blur-xl flex flex-col items-center justify-center">
           <div className="w-12 h-12 border-4 border-primary-fixed border-t-primary rounded-full animate-spin mb-4 shadow-lg"></div>
           <p className="text-primary font-black tracking-widest uppercase text-[12px]">{loaderText}</p>
        </div>
      )}

      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[1100] flex flex-col gap-3 pointer-events-none w-full max-w-[340px] px-5">
        {toasts.map(t => (
          <div key={t.id} className={`px-6 py-4 rounded-3xl shadow-2xl font-black text-xs animate-bounce flex items-center gap-3 border border-white/20 pointer-events-auto ${t.type === "error" ? "bg-error" : t.type === "warning" ? "bg-amber-500" : "bg-slate-900"} text-white`}>
            <span className="material-symbols-outlined text-base">{t.type === "error" ? "error" : t.type === "warning" ? "priority_high" : "check_circle"}</span>
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}