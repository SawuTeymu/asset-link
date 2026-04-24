"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  getAdminPendingData, 
  approveAsset, 
  rejectAsset, 
  checkIpConflict, 
  getNextSequence 
} from "@/lib/actions/assets";
import { formatFloor } from "@/lib/logic/formatters";

/**
 * ==========================================
 * 檔案：src/app/pending/page.tsx
 * 狀態：V0.0 旗艦不刪減完全體 (Next.js 整合版)
 * 物理職責：ERI 待辦池管理、IP 防撞對沖、自動命名引擎、汰換自動封存
 * ==========================================
 */

export default function PendingPage() {
  const router = useRouter();

  // --- 1. 核心數據狀態 ---
  const [data, setData] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSns, setSelectedSns] = useState<Set<string>>(new Set());

  // --- 2. UI 狀態管理 ---
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loaderText, setLoaderText] = useState("資料同步對沖中");
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "error" }[]>([]);

  // 彈窗狀態
  const [activeModal, setActiveModal] = useState<"none" | "approve" | "reject">("none");
  const [currentCase, setCurrentCase] = useState<any>(null);
  
  // 核定表單狀態
  const [modalForm, setModalForm] = useState({
    ip: "",
    name: "",
    type: "桌上型電腦",
    reason: ""
  });

  // --- 3. 物理初始化 ---
  const refreshData = async () => {
    setIsLoading(true);
    try {
      const res = await getAdminPendingData();
      setData(res || []);
      setSelectedSns(new Set());
    } catch (e) {
      showToast("連線讀取失敗", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { refreshData(); }, []);

  // --- 4. 搜尋與過濾邏輯 ---
  const filteredData = useMemo(() => {
    const q = searchQuery.toUpperCase().trim();
    if (!q) return data;
    return data.filter(r => 
      (r.sn || '').toUpperCase().includes(q) || 
      (r.unit || '').toUpperCase().includes(q) || 
      (r.vendor || '').toUpperCase().includes(q)
    );
  }, [searchQuery, data]);

  // --- 5. 核心業務動作 ---

  // 選擇邏輯
  const toggleSelection = (sn: string) => {
    const next = new Set(selectedSns);
    if (next.has(sn)) next.delete(sn);
    else next.add(sn);
    setSelectedSns(next);
  };

  const selectAll = () => {
    if (selectedSns.size === filteredData.length && filteredData.length > 0) {
      setSelectedSns(new Set());
    } else {
      setSelectedSns(new Set(filteredData.map(r => r.sn)));
    }
  };

  // 開啟核發彈窗與建議命名
  const handleOpenApprove = async (item: any) => {
    setCurrentCase(item);
    setModalForm({ ...modalForm, ip: "", name: "演算中...", type: "桌上型電腦" });
    setActiveModal("approve");

    // 物理演算命名規則：[棟別][樓層]-[分機補1]-[流水號]
    const floorPart = formatFloor(item.floor);
    let extNum = item.ext?.includes('#') ? item.ext.split('#')[1] : item.ext;
    let extPart = String(extNum || "").replace(/\D/g, '');
    if (extPart.length === 4) extPart = '1' + extPart;
    extPart = extPart.padStart(5, '0');

    const prefix = `${item.area}${floorPart}-${extPart}-`;
    try {
      const seq = await getNextSequence(prefix);
      setModalForm(prev => ({ ...prev, name: prefix + seq }));
    } catch (e) {
      setModalForm(prev => ({ ...prev, name: prefix + "ERR" }));
    }
  };

  // 執行最終核發
  const executeApproval = async () => {
    if (!modalForm.ip || !modalForm.name || modalForm.name.includes("演算中")) {
      return showToast("核定 IP 與設備標記不可為空", "error");
    }

    setIsLoading(true);
    setLoaderText("IP 衝突對沖稽核...");

    try {
      // 1. 執行防撞稽核 (如果是 [REPLACE] 則豁免)
      const isReplace = currentCase.remark?.includes("[REPLACE]");
      const { conflict, source } = await checkIpConflict(modalForm.ip, isReplace);
      
      if (conflict) {
        setIsLoading(false);
        return showToast(`⚠️ IP 衝突！已存於 ${source} 庫。`, "error");
      }

      setLoaderText("物理結案遷移中...");
      // 2. 執行 Server Action 核定
      await approveAsset(currentCase.sn, modalForm.ip, modalForm.name, modalForm.type);
      
      showToast("✅ 核發成功，行政數據已對沖結案", "success");
      setActiveModal("none");
      refreshData();
    } catch (e: any) {
      showToast("核定失敗：" + e.message, "error");
      setIsLoading(false);
    }
  };

  // 執行退回
  const executeRejection = async () => {
    if (!modalForm.reason) return showToast("請填寫退回原因", "error");
    setIsLoading(true);
    try {
      await rejectAsset(currentCase.sn, modalForm.reason);
      showToast("✅ 案件已退回廠商端修正", "success");
      setActiveModal("none");
      refreshData();
    } catch (e: any) {
      showToast("退回失敗", "error");
      setIsLoading(false);
    }
  };

  // 工具
  const showToast = (msg: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const exportMd = () => {
    if (!filteredData.length) return showToast("無數據可匯出", "error");
    let md = `# ERI 待核定清單 (${new Date().toLocaleDateString()})\n\n| 單位 | 位置 | 廠商 | 序號 | 狀態 |\n| :--- | :--- | :--- | :--- | :--- |\n`;
    filteredData.forEach(r => md += `| ${r.unit} | ${r.area}${r.floor} | ${r.vendor} | ${r.sn} | 待核發 |\n`);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Pending_ERI_Export.md`;
    a.click();
  };

  return (
    <div className="bg-[#f7f9fb] min-h-screen font-[family-name:-apple-system,BlinkMacSystemFont,'SF_Pro_TC','PingFang_TC',system-ui,sans-serif] text-[10.5px] text-[#191c1e] antialiased tracking-tight">
      <style dangerouslySetInnerHTML={{ __html: `
        .glass-panel { background: rgba(255, 255, 255, 0.45); backdrop-filter: blur(40px); -webkit-backdrop-filter: blur(40px); border: 1px solid rgba(255, 255, 255, 0.6); box-shadow: 0 10px 40px rgba(0, 88, 188, 0.04); }
        .liquid-bg { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: -1; overflow: hidden; background: #f7f9fb; }
        .blob { position: absolute; filter: blur(80px); opacity: 0.2; border-radius: 50%; width: 600px; height: 600px; }
        .batch-bar { transform: translateY(150%); transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        .batch-bar.active { transform: translateY(0); }
        .material-symbols-outlined { font-family: 'Material Symbols Outlined' !important; font-variation-settings: 'FILL' 1; }
        .case-card { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .case-card.selected { border-color: #0058bc; background: rgba(0, 88, 188, 0.03); }
        input, select, textarea { border-radius: 12px; border: 1px solid rgba(0,0,0,0.1); padding: 10px 14px; font-weight: 700; outline: none; transition: all 0.2s; background: white; }
        input:focus { border-color: #0058bc; box-shadow: 0 0 0 4px rgba(0, 88, 188, 0.1); }
      `}} />

      <div className="liquid-bg">
        <div className="blob bg-primary-fixed-dim" style={{ top: '-100px', right: '-100px' }}></div>
        <div className="blob bg-secondary-fixed" style={{ bottom: '-150px', left: '-150px', width: '800px', height: '800px' }}></div>
      </div>

      {/* 側邊導覽列 */}
      <aside className={`fixed left-0 top-0 h-screen w-64 bg-white/40 backdrop-blur-3xl border-r border-white/40 p-6 flex flex-col z-[140] transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex items-center gap-3 mb-12">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg"><span className="material-symbols-outlined">token</span></div>
          <div><h1 className="text-lg font-black tracking-tighter">Asset-Link</h1><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Pending V0.0</p></div>
        </div>
        <nav className="flex-1 space-y-1.5">
          <button onClick={() => router.push("/admin")} className="nav-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 font-bold hover:bg-white/50 transition-all"><span className="material-symbols-outlined">grid_view</span>管理主面板</button>
          <button className="nav-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 text-primary border-l-4 border-primary font-black shadow-sm"><span className="material-symbols-outlined">pending_actions</span>待核定案件</button>
        </nav>
        <div className="mt-auto pt-6 border-t border-slate-200">
          <button onClick={() => router.push("/")} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-error font-black hover:bg-red-50 transition-all"><span className="material-symbols-outlined">logout</span>安全登出</button>
        </div>
      </aside>

      {/* 主內容區 */}
      <main className="lg:ml-64 min-h-screen flex flex-col p-6 lg:p-10">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10">
          <div>
            <p className="font-bold text-primary uppercase tracking-[0.2em] mb-1">Queue Management</p>
            <h2 className="text-2xl font-black tracking-tight text-slate-900">目前有 <span className="text-primary">{data.length}</span> 件案件等待核定</h2>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
             <div className="flex gap-2 w-full sm:w-auto">
                <button onClick={selectAll} className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-blue-50 transition-all shadow-sm">全選本頁</button>
                <button onClick={exportMd} className="flex-1 px-4 py-2.5 bg-slate-900 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-1"><span className="material-symbols-outlined text-sm">download</span>匯出 MD</button>
             </div>
             <div className="relative w-full sm:w-64">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="搜尋單位或序號..." className="w-full pl-10 pr-4 py-2.5 bg-white/60 border border-white/60 rounded-full shadow-sm font-bold" />
             </div>
          </div>
        </header>

        {/* 案件卡片網格 */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-24">
          {filteredData.map((r, i) => (
            <div 
              key={r.sn} 
              onClick={() => toggleSelection(r.sn)}
              className={`glass-panel p-6 rounded-[1.8rem] case-card cursor-pointer border-2 ${selectedSns.has(r.sn) ? 'border-primary/60 bg-blue-50/30' : 'border-white/50'}`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex gap-3">
                   <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${selectedSns.has(r.sn) ? 'bg-primary border-primary' : 'bg-white border-slate-200'}`}>
                      {selectedSns.has(r.sn) && <span className="material-symbols-outlined text-white text-[14px]">check</span>}
                   </div>
                   <div>
                      <h3 className="text-lg font-black text-slate-800 leading-tight truncate max-w-[150px]">{r.unit}</h3>
                      <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{r.area}棟 {r.floor} | {r.ext}</p>
                   </div>
                </div>
                <span className={`px-3 py-1 rounded-full font-black text-[9px] uppercase border ${r.status === '待核定' ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-red-50 text-red-600 border-red-100'}`}>{r.status}</span>
              </div>

              <div className="space-y-3 py-4 border-y border-white/40 mb-4">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">廠商</span>
                  <span className="font-black text-slate-700 truncate max-w-[120px]">{r.vendor}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">序號 (S/N)</span>
                  <span className="font-mono font-black text-error">{r.sn}</span>
                </div>
                <div className="flex gap-2">
                   <div className="flex-1 bg-slate-50/50 p-2 rounded-xl border text-center">
                      <p className="text-[8px] font-black text-blue-500 uppercase mb-0.5">Primary MAC</p>
                      <p className="font-mono font-black text-[9.5px] truncate">{r.mac1}</p>
                   </div>
                   <div className="flex-1 bg-slate-50/50 p-2 rounded-xl border text-center">
                      <p className="text-[8px] font-black text-emerald-500 uppercase mb-0.5">WLAN MAC</p>
                      <p className="font-mono font-black text-[9.5px] truncate">{r.mac2 || 'N/A'}</p>
                   </div>
                </div>
              </div>

              <div className="flex gap-3">
                 <button 
                  onClick={(e) => { e.stopPropagation(); handleOpenApprove(r); }}
                  className="flex-[2] py-3 rounded-xl bg-slate-900 text-white font-black uppercase text-[10px] shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                 >
                   <span className="material-symbols-outlined text-sm">verified</span>執行核發
                 </button>
                 <button 
                  onClick={(e) => { e.stopPropagation(); setCurrentCase(r); setActiveModal("reject"); }}
                  className="flex-1 py-3 rounded-xl border border-error/20 text-error font-black uppercase text-[10px] hover:bg-error/5 active:scale-95 transition-all"
                 >
                   退回
                 </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* 🚀 批次動作列 (Floating) */}
      <div className={`batch-bar fixed bottom-8 left-0 lg:left-64 right-0 z-[150] flex justify-center px-6 pointer-events-none ${selectedSns.size > 0 ? 'active' : ''}`}>
        <div className="bg-slate-900/95 backdrop-blur-2xl text-white px-8 py-5 rounded-[2.5rem] shadow-2xl flex items-center justify-between gap-10 border border-white/10 pointer-events-auto w-full max-w-2xl">
          <div className="flex items-center gap-4">
             <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center font-black text-lg border border-white/20">{selectedSns.size}</div>
             <div><p className="font-bold text-sm">已選取案件</p><p className="text-[9px] text-primary-fixed-dim font-black uppercase tracking-widest">批次對沖模組就緒</p></div>
          </div>
          <div className="flex gap-3">
             <button className="px-6 py-3 rounded-xl border border-white/20 text-slate-400 font-bold text-[10px] uppercase hover:bg-white/5 transition-all">批量退回</button>
             <button className="px-8 py-3 rounded-xl bg-primary text-white font-black text-[10px] uppercase shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all">啟動連續核發</button>
          </div>
        </div>
      </div>

      {/* 🚀 核發彈窗 */}
      {activeModal === "approve" && currentCase && (
        <div className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6 fade-enter">
          <div className="glass-panel w-full max-w-lg rounded-[2.5rem] p-10 space-y-6 shadow-2xl bg-white/95 border-t-[8px] border-t-primary">
            <div className="flex justify-between items-center border-b pb-4">
              <h2 className="text-xl font-black flex items-center gap-3">
                 <span className="material-symbols-outlined text-primary">verified_user</span>核定配發作業
              </h2>
              <button onClick={() => setActiveModal("none")} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center transition-all"><span className="material-symbols-outlined text-slate-400">close</span></button>
            </div>

            {currentCase.remark?.includes("[REPLACE]") && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex gap-3">
                 <span className="material-symbols-outlined text-amber-600">info</span>
                 <p className="text-[10px] font-bold text-amber-800 leading-relaxed">偵測為「舊換新」案件。核發後將物理封存歷史庫中同 IP 之舊設備。</p>
              </div>
            )}

            <div className="space-y-4">
               <div className="p-4 bg-blue-50/50 rounded-2xl border">
                  <p className="text-[9px] font-black text-blue-500 uppercase mb-1">目標案件</p>
                  <p className="text-sm font-black text-slate-800">{currentCase.unit} - {currentCase.model}</p>
                  <p className="text-[10px] font-mono font-bold text-slate-400 mt-1">MAC: {currentCase.mac1}</p>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase ml-1">指定核定 IP (N)</label>
                    <input value={modalForm.ip} onChange={e => setModalForm({...modalForm, ip: e.target.value})} className="font-mono text-base font-black text-blue-800" placeholder="10.x.x.x" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase ml-1">設備類型 (H)</label>
                    <select value={modalForm.type} onChange={e => setModalForm({...modalForm, type: e.target.value})}>
                       <option>桌上型電腦</option><option>筆記型電腦</option><option>印表機</option><option>行政周邊</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase ml-1">物理標記名稱 (M)</label>
                    <input value={modalForm.name} readOnly className="bg-slate-100 font-mono text-[11px] font-black text-emerald-700" />
                  </div>
               </div>
            </div>

            <div className="flex gap-4 pt-4">
               <button onClick={() => setActiveModal("none")} className="flex-1 py-4 rounded-2xl font-black text-slate-400 uppercase hover:bg-slate-50">取消</button>
               <button onClick={executeApproval} className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl font-black uppercase shadow-xl shadow-slate-900/20 active:scale-95 transition-all">確認完成核定</button>
            </div>
          </div>
        </div>
      )}

      {/* 🚀 退回彈窗 */}
      {activeModal === "reject" && currentCase && (
        <div className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6 fade-enter">
           <div className="glass-panel w-full max-w-sm rounded-[2.5rem] p-10 text-center space-y-6 bg-white/95 border-t-[8px] border-t-error">
              <div className="w-16 h-16 bg-red-50 text-error rounded-full flex items-center justify-center mx-auto shadow-inner"><span className="material-symbols-outlined text-3xl">report</span></div>
              <h2 className="text-xl font-black">退回修正申請</h2>
              <div className="text-left">
                 <label className="text-[10px] font-black text-error uppercase ml-1">退回原因 (P)</label>
                 <textarea value={modalForm.reason} onChange={e => setModalForm({...modalForm, reason: e.target.value})} rows={3} className="w-full mt-2 text-xs font-bold" placeholder="請詳細說明退回要求..." />
              </div>
              <div className="flex gap-3">
                 <button onClick={() => setActiveModal("none")} className="flex-1 py-4 bg-slate-100 rounded-2xl font-black text-slate-500 uppercase">取消</button>
                 <button onClick={executeRejection} className="flex-1 py-4 bg-error text-white rounded-2xl font-black uppercase shadow-lg shadow-red-500/20 active:scale-95 transition-all">確認退回</button>
              </div>
           </div>
        </div>
      )}

      {/* 強同步遮罩 */}
      {isLoading && (
        <div className="fixed inset-0 z-[1000] bg-white/80 backdrop-blur-xl flex flex-col items-center justify-center">
           <div className="w-12 h-12 border-2 border-slate-200 border-t-primary rounded-full animate-spin mb-6 shadow-2xl"></div>
           <p className="text-primary font-black tracking-[0.4em] uppercase text-[12px] animate-pulse">{loaderText}</p>
        </div>
      )}

      {/* 通知系統 */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[1100] flex flex-col gap-3 pointer-events-none w-full max-w-[320px] px-5">
        {toasts.map(t => (
          <div key={t.id} className={`px-6 py-4 rounded-3xl shadow-2xl font-black text-[11px] animate-bounce flex items-center gap-3 border border-white/20 ${t.type === "success" ? "bg-slate-900" : "bg-red-600"} text-white`}>
            <span className="material-symbols-outlined text-sm">info</span>
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}