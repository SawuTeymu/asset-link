"use client";

import React, { useState, useEffect, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { submitAssetBatch, getAdminPendingData } from "@/lib/actions/assets";
import { formatFloor, formatMAC } from "@/lib/logic/formatters";

/**
 * ==========================================
 * 檔案：src/app/keyin/page.tsx
 * 狀態：V4.3 終極效能優化版 (無障礙 a11y + 消除 native confirm 阻塞)
 * 物理職責：
 * 1. 提供廠商端 17 欄位設備預約填報介面。
 * 2. 【效能】徹底拔除 window.confirm 與 window.alert，替換為 Liquid UI 彈窗。
 * ==========================================
 */

interface AssetRow {
  id: number;
  model: string;
  sn: string;
  mac1: string;
  mac2: string;
  ext: string;
  oldInfo: string;
  type: "NEW" | "REPLACE";
}

interface ProgressRecord {
  formId?: string;
  form_id?: string;
  status: string;
  date?: string;
  installDate?: string;
  unit: string;
  model: string;
  remark?: string;
  rejectReason?: string;
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

  // 🚀 1. 效能優化：自訂非阻塞確認彈窗
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false, title: "", message: "", type: "info" as "danger" | "info", onConfirm: () => {}
  });

  const showToast = useCallback((msg: string, type: "success" | "error" | "info" = "info") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  useEffect(() => {
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
      
      const rnd = Math.floor(Math.random() * 900 + 100);
      const initVdsId = `VDS-${String(y).slice(-2)}${mStr}${dStr}-${rnd}`;
      setVdsId(initVdsId);

      let draftLoaded = false;
      if (currentVendor !== "訪客" && currentVendor !== "未知廠商") {
        try {
          const draftRaw = localStorage.getItem(`AL_KEYIN_V0_${currentVendor}`);
          if (draftRaw) {
            const draft = JSON.parse(draftRaw);
            if (draft.date) setSelectedDate(draft.date);
            else setSelectedDate(todayStr);
            if (draft.area) setArea(draft.area);
            if (draft.areaOther) setAreaOther(draft.areaOther);
            if (draft.floor) setFloor(draft.floor);
            if (draft.unit) setUnit(draft.unit);
            if (draft.applicant) setApplicant(draft.applicant);
            if (draft.rows && draft.rows.length > 0) {
              setRows(draft.rows);
              draftLoaded = true;
              showToast("✅ 已載入上次未提交之草稿", "info");
            }
          }
        } catch (err: unknown) {
          console.warn("草稿讀取失敗", err);
        }
      }

      if (!draftLoaded) {
        setSelectedDate(todayStr);
        setRows([{ id: Date.now(), model: "", sn: "", mac1: "", mac2: "", ext: "", oldInfo: "", type: "NEW" }]);
      }
    }, 0);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (vendorName && vendorName !== "身分對沖中..." && vendorName !== "訪客") {
      const draft = { date: selectedDate, area, areaOther, floor, unit, applicant, rows };
      try {
        localStorage.setItem(`AL_KEYIN_V0_${vendorName}`, JSON.stringify(draft));
      } catch (err: unknown) {
        console.warn("LocalStorage 無法寫入", err);
      }
    }
  }, [selectedDate, area, areaOther, floor, unit, applicant, rows, vendorName]);

  const renderCalendarDays = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const elements = [];
    for (let i = 0; i < firstDay; i++) {
      elements.push(<div key={`empty-${i}`} className="h-10"></div>);
    }
    for (let j = 1; j <= daysInMonth; j++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(j).padStart(2, '0')}`;
      const isActive = dateStr === selectedDate;
      elements.push(
        <div 
          key={`day-${j}`} 
          onClick={() => { setSelectedDate(dateStr); }}
          className={`h-10 flex items-center justify-center text-sm rounded-xl transition-all cursor-pointer font-bold ${isActive ? 'bg-[#2563eb] text-white shadow-md shadow-blue-500/30' : 'text-slate-500 hover:bg-blue-50 hover:text-blue-600'}`}
        >
          {j}
        </div>
      );
    }
    return elements;
  };

  const handleOpenProgress = async () => {
    setIsSidebarOpen(false);
    setIsProgressOpen(true);
    setIsProgressLoading(true);
    
    try {
      const allPending = await getAdminPendingData();
      const vendorHistory = allPending.filter((r: Record<string, unknown>) => String(r.vendor) === vendorName);
      const typedHistory = vendorHistory.map((r: Record<string, unknown>) => ({
        formId: String(r.formId || r.form_id || ""),
        status: String(r.status || "未知"),
        date: String(r.date || r.installDate || ""),
        unit: String(r.unit || ""),
        model: String(r.model || ""),
        remark: String(r.remark || ""),
        rejectReason: String(r.rejectReason || "")
      }));
      setProgressData(typedHistory);
    } catch (err: unknown) {
      console.error("無法讀取雲端紀錄", err);
      showToast("無法讀取雲端紀錄", "error");
    } finally {
      setIsProgressLoading(false);
    }
  };

  // 🚀 2. 取代 window.confirm 的清空表單
  const clearAll = () => {
    setConfirmDialog({
      isOpen: true,
      title: "清空表單確認",
      message: "確定物理清空目前填報的所有設備？草稿與畫面資料將無法復原。",
      type: "danger",
      onConfirm: () => {
        try { localStorage.removeItem(`AL_KEYIN_V0_${vendorName}`); } catch(err: unknown) { console.warn("清理失敗", err); }
        setUnit(""); setApplicant(""); setFloor(""); setArea("A"); setAreaOther("");
        setRows([{ id: Date.now(), model: "", sn: "", mac1: "", mac2: "", ext: "", oldInfo: "", type: "NEW" }]);
        showToast("✅ 已清空表單", "info");
      }
    });
  };

  // 🚀 取代 window.confirm 的安全登出
  const handleLogout = () => {
    setConfirmDialog({
      isOpen: true,
      title: "安全登出系統",
      message: "確定離開填報系統？未提交的草稿已自動保存在您的設備中。",
      type: "info",
      onConfirm: () => router.push("/")
    });
  };

  const handleSubmit = async () => {
    if (!unit.trim() || !applicant.trim() || !floor.trim()) {
      showToast("❌ 行政偏差：請完整填寫 使用單位、申請人姓名 及 樓層。", "error");
      return;
    }
    if (rows.length === 0) {
      showToast("❌ 請至少新增一筆設備資料", "error");
      return;
    }
    
    const macRegex = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/;
    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (!r.mac1 && !r.mac2) {
          showToast(`❌ 第 ${i + 1} 項設備必須填寫至少一組 MAC`, "error");
          return;
        }
        if (r.mac1 && !macRegex.test(r.mac1)) {
          showToast(`❌ 第 ${i + 1} 項設備的主要 MAC 格式異常！`, "error");
          return;
        }
        if (r.mac2 && !macRegex.test(r.mac2)) {
          showToast(`❌ 第 ${i + 1} 項設備的無線 MAC 格式異常！`, "error");
          return;
        }
    }

    setIsLoading(true);
    setLoaderText("數據物理封裝與傳輸中...");

    const baseApplicantName = applicant.split('#')[0].trim();
    const finalArea = area === 'OTHER' ? areaOther.trim() : area;

    const batchData = rows.map((r) => {
      const snFinal = r.sn ? r.sn.toUpperCase().trim() : (`SN-${vdsId.slice(-5)}${Math.floor(Math.random() * 900000)}`).slice(0, 12);
      const finalAppInfo = r.ext.trim() ? `${baseApplicantName}#${r.ext.trim()}` : baseApplicantName;
      const remarkBase = r.oldInfo ? r.oldInfo.trim() : "";
      const finalRemark = (r.type === "REPLACE" ? "[REPLACE] 舊機汰換。" : "資產新購。") + remarkBase;

      return {
        form_id: vdsId,
        install_date: selectedDate,
        area: finalArea,
        floor: formatFloor(floor), 
        unit: unit.trim(),
        applicant: finalAppInfo, 
        model: r.model.trim(),
        sn: snFinal,
        mac1: r.mac1 ? formatMAC(r.mac1) : "",
        mac2: r.mac2 ? formatMAC(r.mac2) : "",
        remark: finalRemark,
        vendor: vendorName,
        status: "待核定"
      };
    });

    try {
      const res = await submitAssetBatch(batchData);
      if (res.success) {
        try { localStorage.removeItem(`AL_KEYIN_V0_${vendorName}`); } catch(err: unknown) { console.warn("清理失敗", err); }
        showToast("✅ 預約提交成功，即將重置畫面...", "success");
        setTimeout(() => { window.location.reload(); }, 2000);
      }
    } catch (err: unknown) { 
      const errorMsg = err instanceof Error ? err.message : String(err);
      showToast("❌ 傳輸中斷: " + errorMsg, "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#f7f9fb] min-h-screen text-[#191c1e] font-[family-name:-apple-system,BlinkMacSystemFont,'SF_Pro_TC','PingFang_TC',system-ui,sans-serif] text-[10.5px] antialiased tracking-tight overflow-x-hidden">
      <style dangerouslySetInnerHTML={{ __html: `
        .glass-card { background: rgba(255, 255, 255, 0.65); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.6); box-shadow: 0 10px 30px rgba(0, 88, 188, 0.05); }
        .saas-label { font-size: 10.5px; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; display: block; }
        .compact-input { width: 100%; background: rgba(255, 255, 255, 0.6); border: 1px solid rgba(226, 232, 240, 0.8); border-radius: 12px; padding: 10px 14px; font-size: 12px; font-weight: 700; color: #334155; transition: all 0.3s ease; }
        .compact-input:focus { background: #ffffff; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15); outline: none; }
        .type-toggle { display: flex; padding: 4px; background: rgba(241, 245, 249, 0.6); border-radius: 12px; border: 1px solid rgba(226, 232, 240, 0.8); }
        .type-btn { flex: 1; padding: 8px 0; font-size: 11px; font-weight: 800; color: #94a3b8; border-radius: 8px; transition: all 0.3s ease; }
        .type-btn.active { background: #ffffff; color: #2563eb; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05); border: 1px solid rgba(226, 232, 240, 0.8); }
      `}} />

      <div className="fixed z-[-1] blur-[80px] opacity-25 rounded-full pointer-events-none bg-blue-600 w-[500px] h-[500px] -top-48 -left-48 animate-pulse"></div>
      <div className="fixed z-[-1] blur-[80px] opacity-25 rounded-full pointer-events-none bg-cyan-400 w-[400px] h-[400px] top-1/2 -right-32 animate-pulse [animation-delay:2s]"></div>

      <button onClick={() => { setIsSidebarOpen(!isSidebarOpen); }} className="lg:hidden fixed top-4 left-4 z-[110] p-2.5 bg-white/70 backdrop-blur-md rounded-xl border border-white/60 shadow-sm active:scale-90 transition-transform">
          <span className="material-symbols-outlined text-primary">menu</span>
      </button>

      <nav className={`fixed left-0 top-0 bottom-0 w-64 border-r border-white/40 bg-white/70 backdrop-blur-[30px] flex flex-col h-full py-6 px-4 z-[100] shadow-xl shadow-blue-900/5 transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
          <div className="mb-10 px-4 mt-8 lg:mt-0">
              <span className="text-2xl font-black bg-gradient-to-r from-blue-700 to-blue-500 bg-clip-text text-transparent tracking-tight">Asset-Link</span>
              <p className="text-xs font-bold text-slate-400 tracking-widest mt-1 uppercase">基礎設施填報 V0.0</p>
          </div>
          <div className="flex flex-col gap-1 flex-1">
              <button onClick={() => { setIsSidebarOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 bg-blue-600/10 text-blue-700 rounded-xl border-l-4 border-blue-600 font-bold shadow-sm">
                  <span className="material-symbols-outlined">event_note</span>預約填報
              </button>
              <button onClick={handleOpenProgress} className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-100/60 hover:translate-x-1 transition-all rounded-xl font-bold group">
                  <span className="material-symbols-outlined group-hover:text-blue-500 transition-colors">history_edu</span>進度查詢
              </button>
          </div>
          <div className="mt-auto flex flex-col gap-1 border-t border-slate-200/50 pt-4">
              <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-red-50 hover:text-red-500 transition-all rounded-xl font-bold">
                  <span className="material-symbols-outlined text-[#ba1a1a]">logout</span>安全登出
              </button>
          </div>
      </nav>

      <header className="fixed top-0 right-0 lg:left-64 left-0 z-40 flex items-center justify-between px-6 lg:px-8 bg-white/60 backdrop-blur-xl h-16 border-b border-white/50 shadow-sm">
          <div className="flex items-center gap-4 pl-12 lg:pl-0">
              <div className="tracking-tight text-lg lg:text-xl font-black text-blue-700">物流與調度中樞</div>
              <div className="h-4 w-px bg-slate-300 hidden sm:block"></div>
              <div className="text-sm font-bold text-slate-500 hidden sm:block">設備預約管理系統</div>
          </div>
          <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 ml-2 lg:border-l lg:pl-4 border-slate-200">
                  <div className="text-right hidden sm:block">
                      <p className="text-xs font-black uppercase tracking-wider">{vendorName}</p>
                      <p className="text-[10px] text-emerald-600 font-bold">已通過物理驗證</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-blue-50 border-2 border-blue-200 shadow-sm flex items-center justify-center text-blue-600">
                      <span className="material-symbols-outlined">precision_manufacturing</span>
                  </div>
              </div>
          </div>
      </header>

      <main className="lg:ml-64 pt-24 px-4 sm:px-8 lg:px-10 pb-12">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <div>
                  <h1 className="text-3xl font-black text-blue-900 tracking-tight">設備預約填報</h1>
                  <p className="text-sm font-bold text-slate-500 mt-1">請輸入裝機資訊與設備詳細參數，系統將自動進行對沖校驗。</p>
              </div>
              <div className="flex gap-3 w-full sm:w-auto">
                  <button onClick={clearAll} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-slate-300 bg-white/50 text-slate-600 font-bold hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-all active:scale-95 shadow-sm">
                      <span className="material-symbols-outlined text-lg">delete_sweep</span>清空
                  </button>
                  <button onClick={handleSubmit} disabled={isLoading} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white font-black shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all active:scale-95 text-sm uppercase tracking-widest disabled:opacity-50">
                      <span className="material-symbols-outlined text-lg">cloud_upload</span>確認提交
                  </button>
              </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              <div className="col-span-1 md:col-span-4 space-y-6">
                  <div className="glass-card p-6 sm:p-8 rounded-[2rem]">
                      <div className="flex justify-between items-center mb-6">
                          <h3 className="font-black text-slate-800 flex items-center gap-2 text-base">
                              <span className="material-symbols-outlined text-blue-600">calendar_month</span>裝機日期 (C)
                          </h3>
                          <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                            {new Date().getFullYear()}年 {new Date().getMonth() + 1}月
                          </span>
                      </div>

                      <div className="grid grid-cols-7 gap-1 text-center mb-4 text-xs font-bold text-slate-400">
                          <div className="py-2">日</div><div className="py-2">一</div><div className="py-2">二</div>
                          <div className="py-2">三</div><div className="py-2">四</div><div className="py-2">五</div><div className="py-2">六</div>
                      </div>
                      <div className="grid grid-cols-7 gap-1 text-center mb-4">
                          {renderCalendarDays()}
                      </div>

                      <div className="mt-6 pt-6 border-t border-slate-200/50">
                          <div>
                              <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2 block">VDS 派工單號 (自動)</span>
                              <div className="compact-input font-mono text-sm shadow-inner text-center tracking-wider bg-slate-50/50">{vdsId}</div>
                          </div>
                      </div>
                  </div>

                  <div className="glass-card p-6 sm:p-8 rounded-[2rem]">
                      <h3 className="font-black text-slate-800 flex items-center gap-2 mb-6 text-base">
                          <span className="material-symbols-outlined text-blue-600">apartment</span>行政資訊對沖
                      </h3>
                      <div className="space-y-5">
                          <div className="grid grid-cols-2 gap-5">
                              <div>
                                  <label className="saas-label" htmlFor="d-area">院區棟別 (D)</label>
                                  <select id="d-area" title="院區棟別" aria-label="院區棟別" value={area} onChange={(e) => { setArea(e.target.value); }} className="compact-input cursor-pointer">
                                      {["A","B","C","D","E","G","H","I","K","T"].map((v) => (
                                        <option key={v} value={v}>{v} 棟</option>
                                      ))}
                                      <option value="OTHER">其他</option>
                                  </select>
                                  {area === "OTHER" && (
                                    <input 
                                      id="d-area-other"
                                      name="areaOther"
                                      value={areaOther} 
                                      title="手動輸入棟別"
                                      aria-label="手動輸入棟別"
                                      onChange={(e) => { setAreaOther(e.target.value); }} 
                                      placeholder="手動輸入" 
                                      className="compact-input mt-2 animate-in slide-in-from-top-2" 
                                    />
                                  )}
                              </div>
                              <div>
                                  <label className="saas-label" htmlFor="d-floor">樓層 (E)</label>
                                  <input 
                                    id="d-floor"
                                    title="樓層"
                                    aria-label="樓層"
                                    value={floor} 
                                    onBlur={(e) => { setFloor(formatFloor(e.target.value)); }} 
                                    onChange={(e) => { setFloor(e.target.value); }} 
                                    className="compact-input" 
                                    placeholder="例如: 05" 
                                  />
                              </div>
                          </div>
                          <div>
                              <label className="saas-label" htmlFor="d-unit">使用單位 (F)</label>
                              <input id="d-unit" title="使用單位" aria-label="使用單位" value={unit} onChange={(e) => { setUnit(e.target.value); }} className="compact-input" placeholder="請輸入單位全銜" />
                          </div>
                          <div>
                              <label className="saas-label !text-blue-600" htmlFor="d-app">申請人姓名 (G)</label>
                              <input id="d-app" title="申請人姓名" aria-label="申請人姓名" value={applicant} onChange={(e) => { setApplicant(e.target.value); }} className="compact-input text-blue-800 bg-blue-50/30" placeholder="請填寫申請人姓名" />
                              <p className="text-[9px] text-slate-400 mt-1 font-bold">※ 分機號碼請於右側個別設備明細中填寫</p>
                          </div>
                      </div>
                  </div>
              </div>

              <div className="col-span-1 md:col-span-8">
                  <div className="flex justify-between items-end mb-4 px-2">
                      <h3 className="font-black text-slate-800 flex items-center gap-2 text-base">
                          <span className="material-symbols-outlined text-blue-600">developer_board</span>設備錄入清單
                      </h3>
                      <div className="text-xs font-black text-slate-500 bg-white/50 px-3 py-1 rounded-lg shadow-sm border border-slate-200">
                          總計 <span className="text-blue-600 text-sm mx-1">{rows.length}</span> 筆
                      </div>
                  </div>

                  <div className="space-y-5">
                      {rows.map((r, i) => (
                        <div key={r.id} className="glass-card p-6 md:p-7 border-l-[8px] border-l-primary relative animate-in slide-in-from-left-4 duration-300 rounded-[1.8rem] hover:shadow-md transition-shadow">
                            
                            {rows.length > 1 && (
                              <button onClick={() => { setRows(rows.filter(row => row.id !== r.id)); }} className="absolute -top-3 -right-3 w-8 h-8 bg-white text-slate-400 hover:text-white hover:bg-red-500 rounded-full flex items-center justify-center shadow-md border border-slate-100 transition-all active:scale-90 z-10">
                                <span className="material-symbols-outlined text-sm">close</span>
                              </button>
                            )}

                            <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-5">
                                <span className="font-black text-slate-400 text-[10px] uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-lg">項目 {i + 1}</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 md:gap-6">
                                <div className="col-span-1 md:col-span-4">
                                    <span className="saas-label block">業務性質 (觸發封存)</span>
                                    <div className="type-toggle">
                                        <button onClick={() => { const n = [...rows]; n[i].type = "NEW"; setRows(n); }} className={`type-btn ${r.type === 'NEW' ? 'active' : ''}`}>🆕 資產新購</button>
                                        <button onClick={() => { const n = [...rows]; n[i].type = "REPLACE"; setRows(n); }} className={`type-btn ${r.type === 'REPLACE' ? 'active !text-orange-600' : ''}`}>🔄 舊機汰換</button>
                                    </div>
                                </div>
                                <div className="col-span-1 md:col-span-2">
                                    <label className="saas-label" htmlFor={`ext-${r.id}`}>分機 (G後綴)</label>
                                    <input id={`ext-${r.id}`} title="分機號碼" aria-label="分機號碼" value={r.ext} onChange={(e) => { const n = [...rows]; n[i].ext = e.target.value; setRows(n); }} className="compact-input font-mono" placeholder="4或5碼" />
                                </div>
                                <div className="col-span-1 md:col-span-6">
                                    <label className="saas-label" htmlFor={`model-${r.id}`}>品牌型號 (I 欄)</label>
                                    <input id={`model-${r.id}`} title="品牌型號" aria-label="品牌型號" value={r.model} onChange={(e) => { const n = [...rows]; n[i].model = e.target.value; setRows(n); }} className="compact-input" placeholder="例: DELL OptiPlex 7000" />
                                </div>
                                <div className="col-span-1 md:col-span-12">
                                    <label className="saas-label !text-red-500" htmlFor={`sn-${r.id}`}>設備序號 S/N (J 欄)</label>
                                    <input id={`sn-${r.id}`} title="設備序號" aria-label="設備序號" value={r.sn} onChange={(e) => { const n = [...rows]; n[i].sn = e.target.value.toUpperCase(); setRows(n); }} className="compact-input font-mono uppercase bg-white/90 tracking-widest text-red-600" placeholder="留空將物理簽發 VDS 序號" maxLength={12} />
                                </div>
                                
                                {r.type === "REPLACE" && (
                                  <div className="col-span-1 md:col-span-12 animate-in slide-in-from-top-2">
                                      <div className="p-4 md:p-5 bg-amber-50/40 rounded-2xl border border-amber-200/50 shadow-inner">
                                          <label className="saas-label !text-amber-700 italic" htmlFor={`old-${r.id}`}>原舊機指紋 (用於行政汰換對沖 M 欄)</label>
                                          <input id={`old-${r.id}`} title="原舊機指紋" aria-label="原舊機指紋" value={r.oldInfo} onChange={(e) => { const n = [...rows]; n[i].oldInfo = e.target.value; setRows(n); }} className="compact-input border-amber-200 bg-white/80" placeholder="請輸入舊機 IP、MAC 或標籤名稱" />
                                      </div>
                                  </div>
                                )}

                                <div className="col-span-1 md:col-span-6">
                                    <label className="saas-label !text-blue-500" htmlFor={`mac1-${r.id}`}>主要網路位址 MAC (K 欄)</label>
                                    <input 
                                      id={`mac1-${r.id}`}
                                      title="主要 MAC" aria-label="主要 MAC"
                                      value={r.mac1} 
                                      onChange={(e) => { const n = [...rows]; n[i].mac1 = e.target.value.toUpperCase().replace(/[^0-9A-F:-]/g, ''); setRows(n); }} 
                                      onBlur={(e) => { const n = [...rows]; n[i].mac1 = formatMAC(e.target.value); setRows(n); }}
                                      className="compact-input font-mono uppercase bg-white/90 text-blue-800" 
                                      maxLength={17} 
                                      placeholder="00:00:00:00:00:00" 
                                    />
                                </div>
                                <div className="col-span-1 md:col-span-6">
                                    <label className="saas-label !text-emerald-500" htmlFor={`mac2-${r.id}`}>無線網路 MAC (L 欄)</label>
                                    <input 
                                      id={`mac2-${r.id}`}
                                      title="無線 MAC" aria-label="無線 MAC"
                                      value={r.mac2} 
                                      onChange={(e) => { const n = [...rows]; n[i].mac2 = e.target.value.toUpperCase().replace(/[^0-9A-F:-]/g, ''); setRows(n); }} 
                                      onBlur={(e) => { const n = [...rows]; n[i].mac2 = formatMAC(e.target.value); setRows(n); }}
                                      className="compact-input font-mono uppercase bg-white/90 text-emerald-800" 
                                      maxLength={17} 
                                      placeholder="若無則留空" 
                                    />
                                </div>
                            </div>
                        </div>
                      ))}
                  </div>

                  <button onClick={() => { setRows([...rows, { id: Date.now(), model: "", sn: "", mac1: "", mac2: "", ext: "", oldInfo: "", type: "NEW" }]); }} className="mt-5 w-full py-8 border-2 border-dashed border-blue-300 rounded-[2rem] flex flex-col items-center justify-center text-blue-600 bg-blue-50/40 hover:bg-blue-100 hover:border-blue-400 transition-all group shadow-sm active:scale-[0.98]">
                      <span className="material-symbols-outlined text-4xl mb-2 group-hover:scale-110 transition-transform">add_circle</span>
                      <span className="font-black text-sm tracking-widest">增加設備項目</span>
                      <span className="text-[10px] opacity-70 mt-1 uppercase tracking-tight font-bold">支援多節點批次對沖與自動繼承</span>
                  </button>

                  <button onClick={handleSubmit} disabled={isLoading} className="mt-6 w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black shadow-2xl shadow-slate-900/30 active:scale-[0.98] transition-all text-sm uppercase tracking-[0.3em] flex items-center justify-center gap-3 disabled:opacity-50">
                      {isLoading ? (
                        <><span className="material-symbols-outlined animate-spin">refresh</span> 數據封裝對沖中...</>
                      ) : (
                        <><span className="material-symbols-outlined">cloud_upload</span> 確認提交預約</>
                      )}
                  </button>
              </div>
          </div>
      </main>

      {/* 🚀 進度查詢彈窗 (Progress Modal) */}
      {isProgressOpen && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 sm:p-6 fade-enter">
            <div className="glass-card w-full max-w-4xl rounded-[2.5rem] p-6 sm:p-8 shadow-2xl flex flex-col max-h-[90vh] bg-white/95">
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200/50">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                            <span className="material-symbols-outlined text-[26px]">manage_search</span>
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800 tracking-tight font-manrope">申請進度查詢</h2>
                            <p className="text-[10px] font-bold text-blue-600 tracking-widest uppercase mt-0.5">{vendorName} 的歷史預約紀錄</p>
                        </div>
                    </div>
                    <button onClick={() => { setIsProgressOpen(false); }} className="w-10 h-10 rounded-full bg-white hover:bg-red-50 text-slate-500 hover:text-red-500 flex items-center justify-center transition-colors shadow-sm border border-slate-200">
                        <span className="material-symbols-outlined text-xl">close</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                    {isProgressLoading ? (
                        <div className="py-24 text-center flex flex-col items-center justify-center opacity-60">
                            <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                            <p className="text-[11px] font-black uppercase tracking-widest text-slate-600">正在調取雲端紀錄...</p>
                        </div>
                    ) : progressData.length === 0 ? (
                        <div className="py-24 text-center flex flex-col items-center opacity-50">
                            <span className="material-symbols-outlined text-5xl text-slate-400 mb-3">inbox</span>
                            <p className="text-xs font-black uppercase tracking-widest text-slate-500">目前尚無預約紀錄</p>
                        </div>
                    ) : (
                        progressData.map((item, idx) => (
                            <div key={idx} className="bg-white/60 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:shadow-md border border-white/80 mb-3">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="text-sm font-black text-slate-800 tracking-tight font-mono">{item.formId || item.form_id}</span>
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest border ${item.status === '待核定' ? 'bg-orange-50 text-orange-600 border-orange-200' : String(item.status).includes('結案') ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                                            {item.status}
                                        </span>
                                    </div>
                                    <div className="text-[11px] font-bold text-slate-500 tracking-wide">
                                        <span className="text-blue-600 mr-2">{item.date || item.installDate}</span> | <span className="mx-2">{item.unit}</span> | <span className="ml-2">{item.model}</span>
                                    </div>
                                    {item.remark && String(item.status).includes('退回') && (
                                        <div className="mt-3 text-[10px] font-bold text-red-600 bg-red-100/50 p-3 rounded-xl border border-red-100 flex gap-2 items-start">
                                            <span className="material-symbols-outlined text-base">error</span>
                                            <span>退回原因：{item.rejectReason || item.remark}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
      )}

      {/* 🚀 自訂非阻塞確認彈窗 (Custom Confirm Modal) */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[2000] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 fade-enter">
           <div className={`glass-card w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl bg-white/95 border-t-[8px] ${confirmDialog.type === 'danger' ? 'border-t-error' : 'border-t-blue-500'}`}>
              <div className="p-8 text-center space-y-6">
                 <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-inner border ${confirmDialog.type === 'danger' ? 'bg-red-50 text-error border-red-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                   <span className="material-symbols-outlined text-3xl font-black">{confirmDialog.type === 'danger' ? 'warning' : 'help'}</span>
                 </div>
                 <h2 className="text-xl font-black text-slate-800 tracking-tight">{confirmDialog.title}</h2>
                 <p className="text-xs font-bold text-slate-500">{confirmDialog.message}</p>
                 <div className="flex gap-3 pt-2">
                    <button onClick={() => setConfirmDialog(prev => ({...prev, isOpen: false}))} className="flex-1 py-3.5 bg-slate-100 rounded-xl font-black text-slate-600 uppercase hover:bg-slate-200 active:scale-95 transition-all text-xs tracking-wider">取消</button>
                    <button onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(prev => ({...prev, isOpen: false})); }} className={`flex-1 py-3.5 text-white rounded-xl font-black uppercase shadow-lg active:scale-95 transition-all text-xs tracking-wider ${confirmDialog.type === 'danger' ? 'bg-error shadow-red-500/30 hover:bg-red-600' : 'bg-blue-600 shadow-blue-500/30 hover:bg-blue-700'}`}>確認執行</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {isLoading && (
        <div className="fixed inset-0 bg-white/80 z-[600] flex flex-col items-center justify-center backdrop-blur-md">
            <div className="w-12 h-12 border-4 border-primary-fixed border-t-primary rounded-full animate-spin mb-4 shadow-lg"></div>
            <p className="text-primary font-black text-[14px] tracking-widest uppercase">{loaderText}</p>
            <p className="text-xs text-slate-500 mt-2 font-bold tracking-widest">請勿關閉應用程式或切換視窗</p>
        </div>
      )}

      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[700] flex flex-col gap-2 pointer-events-none w-full max-w-[340px] px-4">
        {toasts.map(t => (
            <div key={t.id} className={`px-6 py-4 rounded-2xl text-xs font-black text-white shadow-2xl animate-bounce flex items-center gap-3 border border-white/20 ${t.type === 'error' ? 'bg-red-600' : 'bg-slate-900'}`}>
                <span className="material-symbols-outlined text-base">{t.type === 'error' ? 'error' : 'info'}</span>
                <span>{t.msg}</span>
            </div>
        ))}
      </div>

    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8fafc] gap-6">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin shadow-xl"></div>
        <p className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] animate-pulse">初始化環境...</p>
      </div>
    }>
      <KeyinContent />
    </Suspense>
  );
}