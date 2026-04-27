"use client";

import React, { useState, useEffect, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { submitAssetBatch, getVendorProgress, vendorConfirmAsset } from "@/lib/actions/assets";
import { formatFloor } from "@/lib/logic/formatters";

/**
 * ==========================================
 * 檔案：src/app/keyin/page.tsx
 * 狀態：V6.3 旗艦終極完全體 (顯示設備名稱與 IP)
 * 物理職責：
 * 1. 識別優化：進度清單標題改為顯示「設備名稱 (IP)」，落實單筆案件全資料。
 * 2. 物理還原：完整寫回 V5.1 原始 UI、發光球、玻璃卡片與草稿機制。
 * 3. MAC 強化：2碼自動補冒號、強制大寫十六進位。
 * 4. 錯誤修復：TS18047 安全守衛、axe/forms 物理 ID 關聯。
 * ==========================================
 */

interface AssetRow {
  id: number;
  model: string;
  sn: string;
  originalSn?: string; 
  mac1: string;
  mac2: string;
  ext: string;
  oldInfo: string;
  type: "NEW" | "REPLACE";
}

interface ProgressRecord {
  formId: string;
  status: string;
  date: string;
  unit: string;
  model: string;
  sn: string;
  mac1: string;
  mac2: string;
  area: string;
  floor: string;
  applicantFull: string;
  remark: string;
  rejectReason: string;
  assignedIp: string;
  assignedName: string;
}

function KeyinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [vendorName, setVendorName] = useState("身分對沖中...");

  const [vdsId, setVdsId] = useState("加載中...");
  const [selectedDate, setSelectedDate] = useState("");
  const [applicant, setApplicant] = useState("");
  const [unit, setUnit] = useState("");
  const [floor, setFloor] = useState("");
  const [area, setArea] = useState("A");
  const [areaOther, setAreaOther] = useState("");
  const [rows, setRows] = useState<AssetRow[]>([]);
    
  const [isLoading, setIsLoading] = useState(false);
  const [loaderText, setLoaderText] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "error" | "info" }[]>([]);
    
  const [isProgressOpen, setIsProgressOpen] = useState(false);
  const [progressData, setProgressData] = useState<ProgressRecord[]>([]);
  const [isProgressLoading, setIsProgressLoading] = useState(false);
  
  // 🚀 狀態控制：控制目前展開哪一筆案件的全資料
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [confirmDialog, setConfirmDialog] = useState({ 
    isOpen: false, title: "", message: "", type: "info" as "danger" | "info", onConfirm: () => {} 
  });

  const showToast = useCallback((msg: string, type: "success" | "error" | "info" = "info") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  /**
   * 🚀 MAC 物理格式化準則：
   * 1. 全英文大寫、全數字 (十六進位)。
   * 2. 輸入 2 碼自動帶入 ":"。
   */
  const handleMacInput = (val: string) => {
    // 1. 強制轉大寫並過濾非 16 進位字元 (0-9, A-F)
    const cleaned = val.toUpperCase().replace(/[^0-9A-F]/g, '');
    // 2. 物理插入冒號
    let formatted = "";
    for (let i = 0; i < cleaned.length && i < 12; i++) {
        if (i > 0 && i % 2 === 0) formatted += ":";
        formatted += cleaned[i];
    }
    return formatted.slice(0, 17);
  };

  // ----------------------------------------------------------------
  // 初始化與參數讀取 (保留 V5.1 草稿邏輯 + TS18047 物理修復)
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!searchParams) return; 
    let mounted = true;
    const timer = setTimeout(() => {
      if (!mounted) return;
      const sessionVendor = sessionStorage.getItem("asset_link_vendor");
      const urlVendor = searchParams.get("v");
      const currentVendor = sessionVendor || urlVendor || "訪客";
      setVendorName(currentVendor);

      const now = new Date();
      const y = now.getFullYear();
      const mStr = String(now.getMonth() + 1).padStart(2, '0');
      const dStr = String(now.getDate()).padStart(2, '0');
      const todayStr = `${y}-${mStr}-${dStr}`;
      setVdsId(`VDS-${String(y).slice(-2)}${mStr}${dStr}-${Math.floor(Math.random() * 900 + 100)}`);

      let draftLoaded = false;
      if (currentVendor !== "訪客") {
        try {
          const draftRaw = localStorage.getItem(`AL_KEYIN_V0_${currentVendor}`);
          if (draftRaw) {
            const draft = JSON.parse(draftRaw);
            setSelectedDate(draft.date || todayStr);
            setArea(draft.area || "A"); setAreaOther(draft.areaOther || "");
            setFloor(draft.floor || ""); setUnit(draft.unit || ""); setApplicant(draft.applicant || "");
            if (draft.rows && draft.rows.length > 0) { setRows(draft.rows); draftLoaded = true; showToast("已還原歷史填報草稿", "info"); }
          }
        } catch (err: unknown) { console.warn("草稿對沖異常", err); }
      }
      if (!draftLoaded) {
        setSelectedDate(todayStr);
        setRows([{ id: Date.now(), model: "", sn: "", mac1: "", mac2: "", ext: "", oldInfo: "", type: "NEW" }]);
      }
    }, 0);
    return () => { mounted = false; clearTimeout(timer); };
  }, [searchParams, showToast]);

  // 物理儲存草稿
  useEffect(() => {
    if (vendorName && vendorName !== "身分對沖中..." && vendorName !== "訪客") {
      try { localStorage.setItem(`AL_KEYIN_V0_${vendorName}`, JSON.stringify({ date: selectedDate, area, areaOther, floor, unit, applicant, rows })); } catch (err: unknown) { console.warn(err); }
    }
  }, [selectedDate, area, areaOther, floor, unit, applicant, rows, vendorName]);

  const renderCalendarDays = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const elements = [];
    for (let i = 0; i < firstDay; i++) elements.push(<div key={`empty-${i}`} className="h-10"></div>);
    for (let j = 1; j <= daysInMonth; j++) {
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(j).padStart(2, '0')}`;
      elements.push(
        <div key={`day-${j}`} 
             onClick={() => setSelectedDate(dateStr)} 
             className={`h-10 flex items-center justify-center text-sm rounded-xl cursor-pointer font-bold transition-all ${dateStr === selectedDate ? 'bg-[#2563eb] text-white shadow-md shadow-blue-500/30 scale-110' : 'text-slate-500 hover:bg-blue-50'}`}>
          {j}
        </div>
      );
    }
    return elements;
  };

  const handleOpenProgress = async () => {
    setIsSidebarOpen(false); setIsProgressOpen(true); setIsProgressLoading(true);
    try {
      const vendorHistory = await getVendorProgress(vendorName);
      setProgressData(vendorHistory as ProgressRecord[]);
    } catch (err: unknown) { showToast("無法讀取全紀錄", "error"); } finally { setIsProgressLoading(false); }
  };

  const handleLoadRejected = (item: ProgressRecord) => {
    setConfirmDialog({
      isOpen: true, title: "載入案件修正", message: "確定載入此退回案件？目前的填報內容將被覆蓋。", type: "danger",
      onConfirm: () => {
        setVdsId(item.formId); setSelectedDate(item.date);
        if (["A","B","C","D","E","G","H","I","K","T"].includes(item.area)) { setArea(item.area); setAreaOther(""); } else { setArea("OTHER"); setAreaOther(item.area); }
        setFloor(item.floor); setUnit(item.unit);
        const parts = item.applicantFull.split('#'); setApplicant(parts[0] || "");
        const isReplace = item.remark.includes("[REPLACE]");
        setRows([{ id: Date.now(), model: item.model, sn: item.sn, originalSn: item.sn, mac1: item.mac1, mac2: item.mac2, ext: parts[1] || "", oldInfo: isReplace ? item.remark.replace("[REPLACE] 舊機汰換。", "").trim() : "", type: isReplace ? "REPLACE" : "NEW" }]);
        setIsProgressOpen(false); showToast("已還原資料，請修正後重新提交", "success");
      }
    });
  };

  const handleConfirmAsset = async (sn: string) => {
    setConfirmDialog({
      isOpen: true, title: "結案入庫確認", message: "確認配發結果正確？確認後將正式遷移至歷史庫歸檔。", type: "info",
      onConfirm: async () => {
        setIsLoading(true); setLoaderText("執行數據物理遷移...");
        try { await vendorConfirmAsset(sn); showToast("✅ 已成功結案存檔", "success"); handleOpenProgress(); } catch (err: unknown) { showToast("結案處理中斷", "error"); } finally { setIsLoading(false); }
      }
    });
  };

  const clearAll = () => {
    setConfirmDialog({
      isOpen: true, title: "清空填報單", message: "確定清空目前填寫的內容？", type: "danger",
      onConfirm: () => {
        try { localStorage.removeItem(`AL_KEYIN_V0_${vendorName}`); } catch(err: unknown) { console.warn(err); }
        setUnit(""); setApplicant(""); setFloor(""); setArea("A"); setAreaOther("");
        setRows([{ id: Date.now(), model: "", sn: "", mac1: "", mac2: "", ext: "", oldInfo: "", type: "NEW" }]);
      }
    });
  };

  const handleSubmit = async () => {
    if (!unit.trim() || !applicant.trim() || !floor.trim()) return showToast("請完整填報基本資訊", "error");
    const batchData = rows.map((r) => ({
      form_id: vdsId, install_date: selectedDate, area: area === 'OTHER' ? areaOther : area, floor: formatFloor(floor), unit: unit.trim(),
      applicant: r.ext ? `${applicant}#${r.ext}` : applicant, model: r.model, sn: r.sn.toUpperCase(),
      mac1: r.mac1, mac2: r.mac2, remark: (r.type === "REPLACE" ? "[REPLACE] 舊機汰換。" : "新購填報。") + r.oldInfo,
      vendor: vendorName, status: "待核定"
    }));
    try {
      setIsLoading(true); setLoaderText("上傳封裝數據...");
      const res = await submitAssetBatch(batchData);
      if (res.success) { localStorage.removeItem(`AL_KEYIN_V0_${vendorName}`); showToast("✅ 提交成功", "success"); setTimeout(() => window.location.reload(), 1500); }
    } catch (e) { showToast("傳輸異常", "error"); } finally { setIsLoading(false); }
  };

  return (
    <div className="bg-[#f7f9fb] min-h-screen text-[#191c1e] font-[family-name:-apple-system,BlinkMacSystemFont,system-ui] text-[10.5px] antialiased tracking-tight overflow-x-hidden">
      <style dangerouslySetInnerHTML={{ __html: `
        .glass-card { background: rgba(255, 255, 255, 0.65); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.6); box-shadow: 0 10px 30px rgba(0, 88, 188, 0.05); }
        .saas-label { font-size: 10.5px; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; display: block; }
        .compact-input { width: 100%; background: rgba(255, 255, 255, 0.6); border: 1px solid rgba(226, 232, 240, 0.8); border-radius: 12px; padding: 10px 14px; font-size: 12px; font-weight: 700; color: #334155; transition: all 0.3s ease; }
        .compact-input:focus { background: #ffffff; border-color: #3b82f6; outline: none; }
        .type-btn { flex: 1; padding: 10px 0; font-size: 11px; font-weight: 900; border-radius: 10px; transition: all 0.3s ease; }
        .type-btn.active { background: #ffffff; color: #2563eb; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        .detail-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #f1f5f9; }
        .detail-key { color: #94a3b8; font-weight: 800; }
        .detail-val { color: #334155; font-weight: 900; }
      `}} />

      {/* V5.1 原始發光背景 */}
      <div className="fixed z-[-1] blur-[80px] opacity-25 rounded-full pointer-events-none bg-blue-600 w-[500px] h-[500px] -top-48 -left-48 animate-pulse"></div>
      <div className="fixed z-[-1] blur-[80px] opacity-25 rounded-full pointer-events-none bg-cyan-400 w-[400px] h-[400px] top-1/2 -right-32 animate-pulse"></div>

      <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden fixed top-4 left-4 z-[110] p-2.5 bg-white/70 backdrop-blur-md rounded-xl border border-white/60 shadow-sm active:scale-90 transition-transform">
          <span className="material-symbols-outlined text-blue-600">menu</span>
      </button>

      {/* V5.1 原始側邊欄 */}
      <nav className={`fixed left-0 top-0 bottom-0 w-64 border-r border-white/40 bg-white/70 backdrop-blur-[30px] flex flex-col py-8 px-6 z-[100] transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
          <div className="mb-10 px-4">
              <span className="text-2xl font-black bg-gradient-to-r from-blue-700 to-blue-500 bg-clip-text text-transparent tracking-tight">Asset-Link</span>
              <p className="text-xs font-bold text-slate-400 tracking-widest mt-1 uppercase">物流與調度系統 V6.3</p>
          </div>
          <div className="flex flex-col gap-1 flex-1">
              <button onClick={() => setIsSidebarOpen(false)} className="w-full flex items-center gap-3 px-4 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-md"><span className="material-symbols-outlined">event_note</span>預約填報</button>
              <button onClick={handleOpenProgress} className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-white rounded-xl font-bold transition-all"><span className="material-symbols-outlined">manage_search</span>全資料進度</button>
          </div>
          <button onClick={() => router.push("/")} className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-red-50 hover:text-red-500 transition-all rounded-xl font-bold border-t border-slate-200/50 pt-4 mt-auto"><span className="material-symbols-outlined text-[#ba1a1a]">logout</span>安全登出</button>
      </nav>

      <header className="fixed top-0 right-0 lg:left-64 left-0 h-16 bg-white/60 backdrop-blur-xl border-b border-white/50 flex items-center justify-between px-8 z-40">
          <div className="flex items-center gap-4 pl-12 lg:pl-0">
              <div className="tracking-tight text-lg lg:text-xl font-black text-blue-700 uppercase">調度與錄入中樞</div>
          </div>
          <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                  <p className="text-xs font-black uppercase tracking-wider">{vendorName}</p>
                  <p className="text-[10px] text-emerald-600 font-bold">驗證通過</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-50 border-2 border-blue-200 flex items-center justify-center text-blue-600 shadow-sm"><span className="material-symbols-outlined">precision_manufacturing</span></div>
          </div>
      </header>

      <main className="lg:ml-64 pt-24 px-8 max-w-6xl mx-auto pb-12">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <div>
                  <h1 className="text-3xl font-black text-blue-900 tracking-tight">設備預約填報</h1>
                  <p className="text-sm font-bold text-slate-500 mt-1">請錄入裝機資訊與設備詳細參數，系統將進行 16 進位對沖校驗。</p>
              </div>
              <div className="flex gap-3 w-full sm:w-auto">
                  <button onClick={clearAll} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-slate-300 bg-white/50 text-slate-600 font-bold hover:bg-red-50 hover:text-red-500 transition-all shadow-sm"><span className="material-symbols-outlined text-base">delete_sweep</span>清空</button>
                  <button onClick={handleSubmit} disabled={isLoading} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white font-black shadow-lg hover:shadow-blue-500/40 transition-all text-sm uppercase disabled:opacity-50"><span className="material-symbols-outlined text-base">cloud_upload</span>確認提交</button>
              </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              <div className="col-span-1 md:col-span-4 space-y-6">
                  <div className="glass-card p-6 sm:p-8 rounded-[2rem]">
                      <h3 className="font-black text-slate-800 flex items-center gap-2 text-base mb-6"><span className="material-symbols-outlined text-blue-600">calendar_month</span>裝機日期</h3>
                      <div className="grid grid-cols-7 gap-1 text-center mb-4 text-xs font-bold text-slate-400">
                          <div>日</div><div>一</div><div>二</div><div>三</div><div>四</div><div>五</div><div>六</div>
                      </div>
                      <div className="grid grid-cols-7 gap-1 text-center mb-4">
                          {renderCalendarDays()}
                      </div>
                      <div className="mt-6 pt-6 border-t border-slate-200/50">
                          <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2 block text-center">VDS 派工單號</span>
                          <div className="compact-input font-mono text-sm text-center bg-slate-50/50 border-none">{vdsId}</div>
                      </div>
                  </div>

                  <div className="glass-card p-6 sm:p-8 rounded-[2rem] space-y-5">
                      <h3 className="font-black text-slate-800 flex items-center gap-2 text-base mb-2"><span className="material-symbols-outlined text-blue-600">apartment</span>行政資訊對沖</h3>
                      <div className="grid grid-cols-2 gap-5">
                          <div>
                              <label className="saas-label" htmlFor="area-sel">棟別</label>
                              <select id="area-sel" title="棟別選擇" value={area} onChange={(e) => setArea(e.target.value)} className="compact-input">
                                  {["A","B","C","D","E","G","H","I","K","T"].map((v) => <option key={v} value={v}>{v} 棟</option>)}
                                  <option value="OTHER">其他</option>
                              </select>
                          </div>
                          <div>
                              <label className="saas-label" htmlFor="floor-in">樓層</label>
                              <input id="floor-in" value={floor} onBlur={(e) => setFloor(formatFloor(e.target.value))} onChange={(e) => setFloor(e.target.value)} className="compact-input" placeholder="05" />
                          </div>
                      </div>
                      <div>
                          <label className="saas-label" htmlFor="unit-in">單位 (F)</label>
                          <input id="unit-in" value={unit} onChange={(e) => setUnit(e.target.value)} className="compact-input" placeholder="單位名稱" />
                      </div>
                      <div>
                          <label className="saas-label !text-blue-600" htmlFor="app-in">姓名 (G)</label>
                          <input id="app-in" value={applicant} onChange={(e) => setApplicant(e.target.value)} className="compact-input bg-blue-50/30" placeholder="填報人員" />
                      </div>
                  </div>
              </div>

              <div className="col-span-1 md:col-span-8 space-y-5">
                  {rows.map((r, i) => (
                    <div key={r.id} className="glass-card p-6 md:p-7 border-l-[8px] border-l-blue-600 relative animate-in slide-in-from-left-4 duration-300 rounded-[1.8rem]">
                        {rows.length > 1 && (
                            <button onClick={() => setRows(rows.filter(row => row.id !== r.id))} className="absolute -top-3 -right-3 w-8 h-8 bg-white text-slate-400 hover:text-white hover:bg-red-500 rounded-full flex items-center justify-center shadow-md border border-slate-100 transition-all">
                                <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                        )}
                        {r.originalSn && (
                            <div className="mb-4 inline-flex items-center gap-2 bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg border border-amber-200 text-[10px] font-black uppercase tracking-widest">
                                <span className="material-symbols-outlined text-sm">history</span> 修正模式: 物理覆蓋紀錄 {r.originalSn}
                            </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 md:gap-6">
                            <div className="col-span-1 md:col-span-4">
                                <span className="saas-label">業務性質</span>
                                <div className="flex bg-slate-100/50 p-1 rounded-xl border border-slate-200/50">
                                    <button onClick={() => { const n = [...rows]; n[i].type = "NEW"; setRows(n); }} className={`flex-1 py-2 text-[11px] font-black rounded-lg transition-all ${r.type === 'NEW' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>🆕 新購配發</button>
                                    <button onClick={() => { const n = [...rows]; n[i].type = "REPLACE"; setRows(n); }} className={`flex-1 py-2 text-[11px] font-black rounded-lg transition-all ${r.type === 'REPLACE' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400'}`}>🔄 舊機汰換</button>
                                </div>
                            </div>
                            <div className="col-span-1 md:col-span-2">
                                <label className="saas-label" htmlFor={`ext-${r.id}`}>分機</label>
                                <input id={`ext-${r.id}`} value={r.ext} onChange={(e) => { const n = [...rows]; n[i].ext = e.target.value; setRows(n); }} className="compact-input font-mono" />
                            </div>
                            <div className="col-span-1 md:col-span-6">
                                <label className="saas-label" htmlFor={`mod-${r.id}`}>品牌型號 (I)</label>
                                <input id={`mod-${r.id}`} value={r.model} onChange={(e) => { const n = [...rows]; n[i].model = e.target.value; setRows(n); }} className="compact-input" placeholder="ASUS D700" />
                            </div>
                            <div className="col-span-1 md:col-span-12">
                                <label className="saas-label !text-red-500" htmlFor={`sn-${r.id}`}>序號 S/N (J)</label>
                                <input id={`sn-${r.id}`} value={r.sn} onChange={(e) => { const n = [...rows]; n[i].sn = e.target.value.toUpperCase(); setRows(n); }} className="compact-input font-mono uppercase bg-white/90 text-red-600" maxLength={12} placeholder="點擊掃描或手動輸入序號" />
                            </div>
                            <div className="col-span-1 md:col-span-6">
                                <label className="saas-label !text-blue-500" htmlFor={`m1-${r.id}`}>主要有線 MAC</label>
                                <input id={`m1-${r.id}`} value={r.mac1} onChange={(e) => { const n = [...rows]; n[i].mac1 = handleMacInput(e.target.value); setRows(n); }} className="compact-input font-mono uppercase" maxLength={17} placeholder="XX:XX:XX:XX:XX:XX" />
                            </div>
                            <div className="col-span-1 md:col-span-6">
                                <label className="saas-label !text-emerald-500" htmlFor={`m2-${r.id}`}>無線網卡 MAC</label>
                                <input id={`m2-${r.id}`} value={r.mac2} onChange={(e) => { const n = [...rows]; n[i].mac2 = handleMacInput(e.target.value); setRows(n); }} className="compact-input font-mono uppercase" maxLength={17} placeholder="選填項目" />
                            </div>
                        </div>
                    </div>
                  ))}
                  <button onClick={() => setRows([...rows, { id: Date.now(), model: "", sn: "", mac1: "", mac2: "", ext: "", oldInfo: "", type: "NEW" }])} className="w-full py-8 border-2 border-dashed border-blue-300 rounded-[2rem] flex flex-col items-center justify-center text-blue-600 bg-blue-50/40 hover:bg-blue-100 transition-all font-black text-sm group">
                      <span className="material-symbols-outlined text-4xl mb-2 group-hover:scale-110 transition-transform">add_circle</span> 增加填報項目
                  </button>
              </div>
          </div>
      </main>

      {/* 🚀 進度與全資料查詢彈窗 (優化標題：顯示設備名稱與 IP) */}
      {isProgressOpen && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 fade-enter">
            <div className="glass-card w-full max-w-4xl rounded-[2.5rem] p-6 shadow-2xl flex flex-col max-h-[90vh] bg-white/95">
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-lg"><span className="material-symbols-outlined text-[26px]">manage_search</span></div>
                        <div><h2 className="text-xl font-black text-slate-800 tracking-tighter">進度查詢與單筆全資料</h2><p className="text-[10px] font-bold text-blue-600 uppercase">{vendorName} 的全紀錄軌跡</p></div>
                    </div>
                    <button onClick={() => setIsProgressOpen(false)} aria-label="關閉" className="w-10 h-10 rounded-full bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-500 flex items-center justify-center transition-colors"><span className="material-symbols-outlined text-xl">close</span></button>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                    {isProgressLoading ? (
                        <div className="py-24 text-center opacity-60"><div className="w-10 h-10 border-4 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div><p className="text-[11px] font-black uppercase text-slate-600">載入單筆全資料中...</p></div>
                    ) : progressData.length === 0 ? (
                        <div className="py-24 text-center opacity-50"><span className="material-symbols-outlined text-5xl mb-3">inbox</span><p className="text-xs font-black uppercase text-slate-500">目前查無紀錄</p></div>
                    ) : (
                        progressData.map((item, idx) => (
                            <div key={idx} className={`p-5 rounded-2xl flex flex-col transition-all border mb-3 group ${expandedId === item.sn ? 'bg-white shadow-xl border-blue-200' : 'bg-slate-50/50 border-slate-200 hover:shadow-md'}`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        {/* 🚀 改良標題：主標題顯示設備名稱，副標題顯示 IP (若無則Fallback至序號) */}
                                        <div className="flex flex-col">
                                            <span className="text-sm font-black text-slate-800 tracking-tighter">
                                                {item.assignedName ? item.assignedName : `案件 SN: ${item.sn}`}
                                            </span>
                                            {item.assignedIp ? (
                                                <span className="text-[11px] font-bold text-blue-600 font-mono tracking-widest bg-blue-50 px-2 py-0.5 rounded-md mt-1 w-fit border border-blue-100">
                                                    {item.assignedIp}
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">等待資訊組核發 IP...</span>
                                            )}
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black border uppercase tracking-widest ${
                                            item.status === '待核定' ? 'bg-slate-200 text-slate-600 border-slate-300' : 
                                            item.status === '退回修正' ? 'bg-red-50 text-red-600 border-red-200' : 
                                            item.status === '已結案' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                            'bg-blue-50 text-blue-600 border-blue-200 animate-pulse'
                                        }`}>
                                            {item.status}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4 text-[11px] font-bold text-slate-500">
                                        <span className="hidden sm:inline">{item.date} | {item.unit}</span>
                                        <button onClick={() => setExpandedId(expandedId === item.sn ? null : item.sn)} className="flex items-center gap-1 text-blue-600 font-black hover:underline transition-all">
                                            {expandedId === item.sn ? '收起詳情' : '查看全資料'}
                                            <span className="material-symbols-outlined text-sm">{expandedId === item.sn ? 'expand_less' : 'expand_more'}</span>
                                        </button>
                                    </div>
                                </div>
                                  
                                {/* 🚀 單筆案件全資料展示區塊 (展開後呈現所有物理欄位) */}
                                {expandedId === item.sn && (
                                    <div className="mt-4 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-2">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
                                            <div className="detail-row"><span className="detail-key">案件單號：</span><span className="detail-val">{item.formId}</span></div>
                                            <div className="detail-row"><span className="detail-key">裝機日期：</span><span className="detail-val">{item.date}</span></div>
                                            <div className="detail-row"><span className="detail-key">產品序號：</span><span className="detail-val font-mono uppercase">{item.sn}</span></div>
                                            <div className="detail-row"><span className="detail-key">棟別樓層：</span><span className="detail-val">{item.area} 棟 / {item.floor}</span></div>
                                            <div className="detail-row"><span className="detail-key">使用單位：</span><span className="detail-val">{item.unit}</span></div>
                                            <div className="detail-row"><span className="detail-key">填報人員：</span><span className="detail-val">{item.applicantFull}</span></div>
                                            <div className="detail-row"><span className="detail-key">品牌型號：</span><span className="detail-val">{item.model}</span></div>
                                            <div className="detail-row"><span className="detail-key">主要 MAC：</span><span className="detail-val font-mono">{item.mac1}</span></div>
                                            <div className="detail-row"><span className="detail-key">無線 MAC：</span><span className="detail-val font-mono">{item.mac2 || '無'}</span></div>
                                            <div className="detail-row col-span-1 sm:col-span-2"><span className="detail-key">填報備註：</span><span className="detail-val">{item.remark}</span></div>
                                        </div>

                                        {item.status === '退回修正' && (
                                            <div className="mt-4 bg-red-50 p-4 rounded-xl border border-red-100">
                                                <div className="flex items-center gap-2 text-xs font-black text-red-600 mb-3"><span className="material-symbols-outlined text-base">error</span>退回原因：{item.rejectReason}</div>
                                                <button onClick={() => handleLoadRejected(item)} className="w-full py-2.5 bg-red-600 text-white rounded-lg font-black text-xs uppercase hover:bg-red-700 shadow-md transition-all active:scale-95">載入資料並進行物理修正</button>
                                            </div>
                                        )}

                                        {(item.status === '已核定(待確認)' || item.status === '已結案') && (
                                            <div className="mt-4 bg-blue-50 p-4 rounded-xl border border-blue-100">
                                                <p className="text-[10px] font-black text-blue-600 mb-2 uppercase tracking-widest">資訊室核發數據</p>
                                                <div className="flex flex-col sm:flex-row gap-4 mb-4">
                                                    <div className="flex-1 bg-white p-3 rounded-lg border border-blue-100 shadow-sm">
                                                        <span className="detail-key block text-[9px]">物理設備名稱</span>
                                                        <span className="detail-val text-sm font-black text-blue-800">{item.assignedName}</span>
                                                    </div>
                                                    <div className="flex-1 bg-white p-3 rounded-lg border border-blue-100 shadow-sm">
                                                        <span className="detail-key block text-[9px]">核定固定 IP</span>
                                                        <span className="detail-val text-sm font-black text-blue-800">{item.assignedIp}</span>
                                                    </div>
                                                </div>
                                                {item.status === '已核定(待確認)' && (
                                                    <button onClick={() => handleConfirmAsset(item.sn)} className="w-full py-3 bg-blue-600 text-white rounded-lg font-black text-xs uppercase hover:bg-blue-700 shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95">
                                                       <span className="material-symbols-outlined text-[18px]">task_alt</span>確認結果並結案遷移
                                                    </button>
                                                )}
                                                {item.status === '已結案' && <p className="text-[10px] text-emerald-600 font-black italic text-right">※ 資料已成功入庫存檔至歷史大數據庫</p>}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
      )}

      {/* 確認彈窗 */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[2000] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 fade-enter">
           <div className={`glass-card w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl bg-white/95 border-t-[8px] ${confirmDialog.type === 'danger' ? 'border-t-[#ba1a1a]' : 'border-t-blue-500'}`}>
              <div className="p-8 text-center space-y-6">
                 <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto border ${confirmDialog.type === 'danger' ? 'bg-red-50 text-[#ba1a1a] border-red-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                   <span className="material-symbols-outlined text-3xl font-black">{confirmDialog.type === 'danger' ? 'warning' : 'help'}</span>
                 </div>
                 <h2 className="text-xl font-black text-slate-800 tracking-tighter">{confirmDialog.title}</h2>
                 <p className="text-xs font-bold text-slate-500 leading-relaxed">{confirmDialog.message}</p>
                 <div className="flex gap-3 pt-2">
                    <button onClick={() => setConfirmDialog(prev => ({...prev, isOpen: false}))} className="flex-1 py-3.5 bg-slate-100 rounded-xl font-black text-slate-600 uppercase hover:bg-slate-200 transition-colors">取消</button>
                    <button onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(prev => ({...prev, isOpen: false})); }} className={`flex-1 py-3.5 text-white rounded-xl font-black uppercase transition-transform active:scale-95 ${confirmDialog.type === 'danger' ? 'bg-[#ba1a1a]' : 'bg-blue-600'}`}>確認執行</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {isLoading && (
        <div className="fixed inset-0 bg-white/80 z-[600] flex flex-col items-center justify-center backdrop-blur-md">
            <div className="w-12 h-12 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin mb-4 shadow-lg"></div>
            <p className="text-blue-600 font-black tracking-widest uppercase animate-pulse">{loaderText}</p>
        </div>
      )}

      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[700] flex flex-col gap-2 pointer-events-none w-full max-w-[340px] px-4">
        {toasts.map(t => (
            <div key={t.id} className={`px-6 py-4 rounded-2xl text-xs font-black text-white shadow-2xl animate-in slide-in-from-bottom flex items-center gap-3 ${t.type === 'error' ? 'bg-red-600' : t.type === 'info' ? 'bg-slate-900/90' : 'bg-emerald-600/90'}`}>
                <span className="material-symbols-outlined text-base">info</span>
                <span>{t.msg}</span>
            </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#f8fafc]"><div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div></div>}>
      <KeyinContent />
    </Suspense>
  );
}