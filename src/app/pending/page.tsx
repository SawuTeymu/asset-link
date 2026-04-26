"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getAdminPendingData, approveAsset, rejectAsset, checkIpConflict, getNextSequence } from "@/lib/actions/assets";
import AdminSidebar from "@/components/layout/AdminSidebar";
import TopNavbar from "@/components/layout/TopNavbar";

/**
 * ==========================================
 * 檔案：src/app/pending/page.tsx
 * 狀態：V4.3 終極效能優化版 (修復 ESLint 嚴格規範與 A11y 標籤)
 * 物理職責：
 * 1. 修復 prefer-const、no-unused-expressions 語法報警。
 * 2. 修復彈窗表單 Axe/forms 無障礙缺漏 (id, htmlFor, title)。
 * 3. 維持 React.memo 效能阻斷與 Liquid UI 設計。
 * ==========================================
 */

interface PendingCardProps {
  r: Record<string, unknown>;
  isChecked: boolean;
  onToggle: (sn: string) => void;
  onOpenApprove: (item: Record<string, unknown>) => void;
  onOpenReject: (item: Record<string, unknown>) => void;
}

const PendingCard = React.memo(({ r, isChecked, onToggle, onOpenApprove, onOpenReject }: PendingCardProps) => {
  const borderClass = isChecked ? 'border-primary/60 shadow-lg shadow-primary/10 bg-blue-50/20' : 'border-white/50 hover:border-primary/40 bg-white/40';
  const checkBgClass = isChecked ? 'bg-primary border-primary' : 'bg-white border-slate-300 group-hover:border-blue-400';

  const safeUnit = String(r.unit || '未提供單位'); const safeArea = String(r.area || '-'); const safeFloor = String(r.floor || '-');
  const safeExt = String(r.ext || '無分機'); const safeVendor = String(r.vendor || '未知廠商'); const safeModel = String(r.model || '未提供型號');
  const safeSn = String(r.sn || 'UNKNOWN'); const safeMac1 = String(r.mac1 || 'N/A'); const safeMac2 = String(r.mac2 || 'N/A');
  const safeStatus = String(r.status || '待核定'); const safeFormId = String(r.formId || '');

  return (
    <div className={`glass-card group p-6 rounded-[1.8rem] flex flex-col gap-4 ${borderClass} border-2 transition-all duration-300 relative cursor-pointer`} onClick={() => onToggle(safeSn)}>
      <div className="flex justify-between items-start">
          <div className="flex gap-3">
              <div className="mt-1"><div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${checkBgClass}`}>{isChecked && <span className="material-symbols-outlined text-white text-[14px] font-black">check</span>}</div></div>
              <div className="overflow-hidden"><h3 className="text-lg font-black text-slate-800 leading-tight truncate max-w-[150px]">{safeUnit}</h3><p className="text-[9px] font-bold text-slate-400 mt-1 truncate">{safeArea}棟 {safeFloor} | 分機: {safeExt}</p></div>
          </div>
          <span className={`px-3 py-1 rounded-full font-black text-[9px] uppercase tracking-widest border shrink-0 bg-orange-50 text-orange-600 border-orange-100 shadow-sm`}>{safeStatus}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 py-4 border-y border-white/40">
          <div className="overflow-hidden"><span className="text-[9px] uppercase font-black text-slate-400 mb-1 tracking-widest block">廠牌與型號</span><span className="font-black text-slate-700 truncate block text-xs">{safeVendor}</span><span className="text-[10px] text-slate-500 font-bold truncate block">{safeModel}</span></div>
          <div className="overflow-hidden"><span className="text-[9px] uppercase font-black text-slate-400 mb-1 tracking-widest block">設備序號 (S/N)</span><span className="font-mono font-black text-error text-xs truncate block">{safeSn}</span><span className="text-[8.5px] font-bold text-slate-400 truncate block mt-1">案: {safeFormId}</span></div>
          <div className="col-span-2 flex gap-2 mt-1">
              <div className="flex-1 bg-slate-50/60 p-2.5 rounded-xl border border-slate-200/60 shadow-inner overflow-hidden"><p className="text-[9px] font-black text-blue-500 uppercase mb-0.5 tracking-widest flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">lan</span> Primary MAC</p><p className="font-mono font-black text-xs text-slate-700 truncate">{safeMac1}</p></div>
              <div className="flex-1 bg-slate-50/60 p-2.5 rounded-xl border border-slate-200/60 shadow-inner overflow-hidden"><p className="text-[9px] font-black text-emerald-600 uppercase mb-0.5 tracking-widest flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">wifi</span> WLAN MAC</p><p className="font-mono font-black text-xs text-slate-700 truncate">{safeMac2}</p></div>
          </div>
      </div>

      <div className="flex gap-3 mt-auto pt-2">
          <button onClick={(e) => { e.stopPropagation(); onOpenApprove(r); }} className="flex-[2] py-3.5 rounded-xl bg-primary text-white font-black uppercase text-[11px] tracking-widest shadow-md hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-1.5"><span className="material-symbols-outlined text-[16px]">verified</span>執行核發</button>
          <button onClick={(e) => { e.stopPropagation(); onOpenReject(r); }} className="flex-1 py-3.5 rounded-xl border border-error/30 text-error font-black uppercase text-[11px] tracking-widest hover:bg-error/10 active:scale-95 transition-all flex items-center justify-center gap-1.5"><span className="material-symbols-outlined text-[16px]">undo</span>退回</button>
      </div>
    </div>
  );
});
PendingCard.displayName = "PendingCard";

export default function PendingPage() {
  const router = useRouter();
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSns, setSelectedSns] = useState<Set<string>>(new Set());

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loaderText, setLoaderText] = useState("資料庫同步對沖中");
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "error" | "warning" }[]>([]);

  const [activeModal, setActiveModal] = useState<"none" | "approve" | "reject">("none");
  const [currentCase, setCurrentCase] = useState<Record<string, unknown> | null>(null);
  const [modalForm, setModalForm] = useState({ ip: "", name: "", type: "桌上型電腦", reason: "", area: "A", areaOther: "", floor: "" });
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: "", message: "", type: "info" as "danger" | "info", onConfirm: () => {} });

  const showToast = useCallback((msg: string, type: "success" | "error" | "warning" = "success") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const refreshData = useCallback(async () => {
    const isAuth = sessionStorage.getItem("asset_link_admin_auth");
    if (!isAuth) { router.push("/"); return; }
    setIsLoading(true);
    try {
      const res = await getAdminPendingData();
      setData(res || []);
      setSelectedSns(new Set());
    } catch (err: unknown) { 
      showToast("讀取失敗：" + String(err), "error"); 
      console.warn("讀取失敗", err);
    } finally { 
      setIsLoading(false); 
    }
  }, [router, showToast]);

  useEffect(() => {
    let mounted = true; const timer = setTimeout(() => { if (mounted) refreshData(); }, 0);
    return () => { mounted = false; clearTimeout(timer); };
  }, [refreshData]);

  useEffect(() => {
    let isCancelled = false;
    if (!currentCase || activeModal !== "approve") return;
    const runNaming = async () => {
      const targetArea = modalForm.area === "OTHER" ? modalForm.areaOther : modalForm.area;
      if (!targetArea) return;
      const fUpper = (modalForm.floor || String(currentCase.floor || "")).toUpperCase().trim();
      
      // 🚀 物理修復：將 let 變更為 const 解決 prefer-const 警告
      const floorPart = fUpper.startsWith('B') ? (fUpper.match(/B[1-3]/)?.[0] || fUpper) : fUpper.replace(/[^0-9]/g, '').padStart(2, '0'); 
      
      const extNum = String(currentCase.ext || "").includes('#') ? String(currentCase.ext).split('#')[1] : String(currentCase.ext);
      let extPart = String(extNum || "").replace(/\D/g, '');
      if (extPart.length === 4) extPart = '1' + extPart; else if (extPart === "") extPart = "00000";
      extPart = extPart.padStart(5, '0');
      
      const ipParts = modalForm.ip.split(".");
      const suffix = (ipParts.length === 4 && ipParts[3] !== "") ? ipParts[3].padStart(3, "0") : "---";
      const prefix = `${targetArea}${floorPart}-${extPart}-`;
      if (suffix === "---") {
        try { const seq = await getNextSequence(prefix); if (!isCancelled) setModalForm(p => ({ ...p, name: prefix + seq })); } catch { if (!isCancelled) setModalForm(p => ({ ...p, name: prefix + "ERR" })); }
      } else {
        if (!isCancelled) setModalForm(p => ({ ...p, name: (prefix + suffix).toUpperCase() }));
      }
    };
    runNaming();
    return () => { isCancelled = true; };
  }, [modalForm.area, modalForm.areaOther, modalForm.ip, modalForm.floor, currentCase, activeModal]);

  const handleOpenApprove = useCallback((item: Record<string, unknown>) => {
    setCurrentCase(item);
    setModalForm({ ip: String(item.ip || ""), name: "演算中...", type: "桌上型電腦", reason: "", area: String(item.area || "A"), areaOther: "", floor: String(item.floor || "") });
    setActiveModal("approve");
  }, []);

  const handleOpenReject = useCallback((item: Record<string, unknown>) => {
    setCurrentCase(item); setModalForm(prev => ({ ...prev, reason: "" })); setActiveModal("reject");
  }, []);

  const executeApproval = async () => {
    if (!modalForm.ip || !modalForm.name || modalForm.name.includes("演算中")) return showToast("IP 與設備名稱不可為空", "error");
    setIsLoading(true); setLoaderText("IP 衝突防禦掃描中...");
    try {
      const isReplace = String(currentCase?.remark || "").includes("[REPLACE]");
      const { conflict, source } = await checkIpConflict(modalForm.ip, isReplace);
      if (conflict) { setIsLoading(false); return showToast(`⚠️ IP 衝突！已存於 ${source} 庫。`, "error"); }

      setLoaderText("分發網段並通知廠商...");
      await approveAsset(String(currentCase?.sn), modalForm.ip, modalForm.name, modalForm.type);
      
      showToast("✅ 已成功核定配發，請等待廠商端確認入庫", "success");
      setActiveModal("none"); refreshData();
    } catch (err: unknown) { 
      // 🚀 物理修復：將 err 實體化傳遞至日誌
      console.warn("核定失敗:", err);
      showToast("核定失敗", "error"); 
      setIsLoading(false); 
    }
  };

  const executeRejection = async () => {
    if (!modalForm.reason.trim()) return showToast("請填寫退回原因", "error");
    setIsLoading(true); setLoaderText("退回修正同步中...");
    try {
      await rejectAsset(String(currentCase?.sn), modalForm.reason);
      showToast("✅ 案件已物理退回至廠商修改", "success");
      setActiveModal("none"); refreshData();
    } catch (err: unknown) { 
      // 🚀 物理修復：將 err 實體化傳遞至日誌
      console.warn("退回失敗:", err);
      showToast("退回失敗", "error"); 
      setIsLoading(false); 
    }
  };

  const filteredData = useMemo(() => {
    const q = searchQuery.toUpperCase().trim();
    if (!q) return data;
    return data.filter(r => (String(r.sn)).toUpperCase().includes(q) || (String(r.unit)).toUpperCase().includes(q) || (String(r.vendor)).toUpperCase().includes(q));
  }, [searchQuery, data]);

  // 🚀 物理修復：將三元運算子改為標準 if...else，消滅 no-unused-expressions 警告
  const toggleSelection = useCallback((sn: string) => { 
    setSelectedSns(prev => { 
      const next = new Set(prev); 
      if (next.has(sn)) {
        next.delete(sn);
      } else {
        next.add(sn);
      }
      return next; 
    }); 
  }, []);

  const selectAll = () => { 
    if (selectedSns.size === filteredData.length && filteredData.length > 0) {
      setSelectedSns(new Set());
    } else {
      setSelectedSns(new Set(filteredData.map(r => String(r.sn))));
    }
  };

  const exportMd = () => {
    if (!filteredData.length) return showToast("無數據可匯出", "error");
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
    if (selectedSns.size === 0) return showToast("請先選取案件", "warning");
    setConfirmDialog({
      isOpen: true,
      title: "批量退回確認",
      message: `確定要物理退回已選取的 ${selectedSns.size} 筆案件嗎？這將通知廠商重新填報。`,
      type: "danger",
      onConfirm: () => {
        showToast(`[預留位] 已觸發批量退回模組。`, "success");
        setSelectedSns(new Set()); 
      }
    });
  };

  const handleBatchApprove = () => {
    if (selectedSns.size === 0) return showToast("請先選取案件", "warning");
    setConfirmDialog({
      isOpen: true,
      title: "批量核發模組就緒",
      message: `您已選取 ${selectedSns.size} 筆案件。批量分配 IP 網段與命名模組已就緒，等待後端 API 端點擴充後即可啟用連續派發功能。`,
      type: "info",
      onConfirm: () => {}
    });
  };

  return (
    <div className="bg-[#f7f9fb] min-h-screen font-[family-name:-apple-system,BlinkMacSystemFont,system-ui,sans-serif] text-[10.5px] text-[#191c1e] antialiased tracking-tight">
      <style dangerouslySetInnerHTML={{ __html: `
        .glass-panel { background: rgba(255, 255, 255, 0.45); backdrop-filter: blur(40px); -webkit-backdrop-filter: blur(40px); border: 1px solid rgba(255, 255, 255, 0.6); box-shadow: 0 10px 40px rgba(0, 88, 188, 0.04); }
        .batch-bar { transform: translateY(150%); transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        .batch-bar.active { transform: translateY(0); }
      `}} />

      <AdminSidebar currentRoute="/pending" isOpen={isSidebarOpen} onLogout={() => setConfirmDialog({ isOpen: true, title: "安全登出系統", message: "確定結束管理工作並安全登出？未保存的草稿將遺失。", type: "danger", onConfirm: () => { sessionStorage.removeItem("asset_link_admin_auth"); router.push("/"); }})} />

      <main className="lg:ml-64 min-h-screen flex flex-col p-6 lg:p-10">
        <TopNavbar title="待核定案件管理中樞" subtitle="Queue Management" searchQuery={searchQuery} onSearchChange={setSearchQuery} onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)} showSearch={true} />

        <div className="flex gap-2 w-full sm:w-auto mb-6">
           <button onClick={selectAll} className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-blue-50 transition-all shadow-sm">全選本頁</button>
           <button onClick={exportMd} className="px-4 py-2.5 bg-slate-900 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-1"><span className="material-symbols-outlined text-sm">download</span>匯出 MD</button>
           <span className="ml-auto text-sm font-black text-slate-800 self-center">共 {filteredData.length} 件</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-24">
          {filteredData.map((r) => <PendingCard key={String(r.sn)} r={r} isChecked={selectedSns.has(String(r.sn))} onToggle={toggleSelection} onOpenApprove={handleOpenApprove} onOpenReject={handleOpenReject} />)}
          {filteredData.length === 0 && (
             <div className="col-span-full flex flex-col items-center justify-center py-32 text-slate-400 opacity-60 bg-white/40 rounded-3xl border-2 border-dashed border-slate-300">
                <span className="material-symbols-outlined text-5xl mb-4">fact_check</span>
                <p className="text-xs font-black uppercase tracking-[0.2em]">目前無待核定案件</p>
             </div>
          )}
        </div>
      </main>

      {/* 批量操作控制條 */}
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
             <button onClick={handleBatchReject} className="flex-1 sm:flex-none px-6 py-3 rounded-xl border border-white/20 text-slate-300 font-bold text-[11px] uppercase tracking-wider hover:bg-red-500/20 hover:text-red-400 transition-all">批量退回</button>
             <button onClick={handleBatchApprove} className="flex-1 sm:flex-none px-8 py-3 rounded-xl bg-primary text-white font-black text-[11px] uppercase tracking-wider shadow-lg shadow-primary/30 active:scale-95 transition-all">啟動批量核發</button>
          </div>
        </div>
      </div>

      {/* 🚀 核發彈窗 (A11y 無障礙修復版) */}
      {activeModal === "approve" && currentCase && (
        <div className="fixed inset-0 z-[200] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 fade-enter">
          <div className="glass-panel w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl bg-white/95 border-t-[8px] border-t-primary">
            <div className="p-8 space-y-6">
              <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                <h2 className="text-xl font-black flex items-center gap-3 text-slate-800"><span className="material-symbols-outlined text-white bg-primary w-10 h-10 rounded-xl flex items-center justify-center">verified_user</span>核定配發作業</h2>
                <button onClick={() => setActiveModal("none")} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center transition-all"><span className="material-symbols-outlined text-slate-400">close</span></button>
              </div>

              <div className="grid grid-cols-2 gap-5">
                 <div className="col-span-2 md:col-span-1">
                    <label htmlFor="modal-area" className="text-[10px] font-black text-slate-500 uppercase block mb-1.5 ml-1">院區棟別</label>
                    <select id="modal-area" title="院區棟別" aria-label="院區棟別" value={modalForm.area} onChange={e => setModalForm({...modalForm, area: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none">
                      {["A","B","C","D","E","G","H","I","K","T"].map(v => <option key={v} value={v}>{v} 棟</option>)}
                      <option value="OTHER">其他...</option>
                    </select>
                 </div>
                 <div className="col-span-2 md:col-span-1">
                    <label htmlFor="modal-floor" className="text-[10px] font-black text-slate-500 uppercase block mb-1.5 ml-1">樓層區域</label>
                    <input id="modal-floor" title="樓層區域" aria-label="樓層區域" value={modalForm.floor} onChange={e => setModalForm({...modalForm, floor: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none" placeholder="例如: 05 或 B1" />
                 </div>
                 {modalForm.area === "OTHER" && (
                    <div className="col-span-2 animate-in slide-in-from-top-2">
                       <label htmlFor="modal-area-other" className="text-[10px] font-black text-blue-600 uppercase block mb-1.5 ml-1">請手動輸入自定義棟別</label>
                       <input id="modal-area-other" title="手動輸入棟別" aria-label="手動輸入棟別" value={modalForm.areaOther} onChange={e => setModalForm({...modalForm, areaOther: e.target.value.toUpperCase()})} className="w-full px-4 py-3 bg-blue-50/50 border border-blue-200 rounded-xl font-black text-blue-800 outline-none" placeholder="手動輸入" />
                    </div>
                 )}
                 <div className="col-span-2">
                    <label htmlFor="modal-ip" className="text-[10px] font-black text-slate-500 uppercase block mb-1.5 ml-1">核定 IP</label>
                    <input id="modal-ip" title="核定 IP" aria-label="核定 IP" value={modalForm.ip} onChange={e => setModalForm({...modalForm, ip: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm font-black text-blue-700 outline-none" placeholder="10.x.x.x" />
                 </div>
                 <div className="col-span-2">
                    <label htmlFor="modal-name" className="text-[10px] font-black text-emerald-600 uppercase block mb-1.5 ml-1">設備名稱</label>
                    <input id="modal-name" title="設備名稱" aria-label="設備名稱" value={modalForm.name} onChange={e => setModalForm({...modalForm, name: e.target.value.toUpperCase()})} className="w-full px-4 py-3 bg-white border border-emerald-100 rounded-xl font-mono text-xs font-black text-emerald-700 outline-none" />
                 </div>
              </div>

              <div className="flex gap-4 pt-4 border-t border-slate-100">
                 <button onClick={() => setActiveModal("none")} className="flex-1 py-4 font-black text-slate-400 uppercase hover:bg-slate-50 rounded-2xl">取消</button>
                 <button onClick={executeApproval} className="flex-[2] py-4 bg-slate-900 text-white font-black uppercase rounded-2xl flex items-center justify-center gap-2"><span className="material-symbols-outlined">send</span>分發至廠商確認</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🚀 退回彈窗 (A11y 無障礙修復版) */}
      {activeModal === "reject" && currentCase && (
        <div className="fixed inset-0 z-[200] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 fade-enter">
           <div className="glass-panel w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl bg-white/95 border-t-[8px] border-t-error">
              <div className="p-8 text-center space-y-6">
                 <div className="w-16 h-16 bg-red-50 text-error rounded-2xl flex items-center justify-center mx-auto shadow-inner border border-red-100"><span className="material-symbols-outlined text-3xl font-black">report</span></div>
                 <h2 className="text-xl font-black text-slate-800">退回修正申請</h2>
                 <div className="text-left">
                    <label htmlFor="modal-reason" className="block text-[11px] font-black text-error uppercase mb-2 ml-1">退回原因</label>
                    <textarea id="modal-reason" title="退回原因" aria-label="退回原因" value={modalForm.reason} onChange={e => setModalForm({...modalForm, reason: e.target.value})} rows={3} className="w-full px-4 py-3 bg-red-50/30 border border-red-200 rounded-xl text-xs font-bold text-slate-700 outline-none" placeholder="將回傳至廠商進度查詢面板..." />
                 </div>
                 <div className="flex gap-3 pt-2">
                    <button onClick={() => setActiveModal("none")} className="flex-1 py-3.5 bg-slate-100 rounded-xl font-black text-slate-600 uppercase hover:bg-slate-200 active:scale-95 transition-all text-xs">取消</button>
                    <button onClick={executeRejection} className="flex-1 py-3.5 bg-error text-white rounded-xl font-black shadow-lg shadow-red-500/30 active:scale-95 transition-all text-xs tracking-wider">確認退回</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* 🚀 自訂非阻塞確認彈窗 (Custom Confirm Modal) */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[2000] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 fade-enter">
           <div className={`glass-panel w-full max-w-sm rounded-[2rem] overflow-hidden bg-white/95 border-t-[8px] ${confirmDialog.type === 'danger' ? 'border-t-error' : 'border-t-blue-500'}`}>
              <div className="p-8 text-center space-y-6">
                 <h2 className="text-xl font-black text-slate-800">{confirmDialog.title}</h2><p className="text-xs font-bold text-slate-500">{confirmDialog.message}</p>
                 <div className="flex gap-3 pt-2">
                    <button onClick={() => setConfirmDialog(prev => ({...prev, isOpen: false}))} className="flex-1 py-3.5 bg-slate-100 rounded-xl font-black text-slate-600">取消</button>
                    <button onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(prev => ({...prev, isOpen: false})); }} className={`flex-1 py-3.5 text-white rounded-xl font-black ${confirmDialog.type === 'danger' ? 'bg-error' : 'bg-blue-600'}`}>確認執行</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {isLoading && (
        <div className="fixed inset-0 z-[1000] bg-white/80 backdrop-blur-xl flex flex-col items-center justify-center"><div className="w-12 h-12 border-4 border-t-primary rounded-full animate-spin mb-4"></div><p className="text-primary font-black tracking-widest uppercase text-[12px]">{loaderText}</p></div>
      )}

      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[1100] flex flex-col gap-3 pointer-events-none w-full max-w-[340px] px-5">
        {toasts.map(t => <div key={t.id} className={`px-6 py-4 rounded-3xl font-black text-xs animate-bounce flex items-center gap-3 pointer-events-auto ${t.type === "error" ? "bg-error" : t.type === "warning" ? "bg-amber-500" : "bg-slate-900"} text-white`}><span className="material-symbols-outlined text-base">info</span><span>{t.msg}</span></div>)}
      </div>
    </div>
  );
}