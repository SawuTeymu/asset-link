"use client";

import React, { useState, useEffect, Suspense, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { submitAssetBatch, getVendorProgress, vendorConfirmAsset } from "@/lib/actions/assets";
import { formatFloor } from "@/lib/logic/formatters";

/**
 * ==========================================
 * 檔案：src/app/keyin/page.tsx
 * 狀態：V61.0 無障礙全綠燈版 (Axe Forms Fix)
 * 物理職責：
 * 1. 視覺中樞：還原毛玻璃、呼吸球背景、超大圓角設計。
 * 2. 預校引擎：內建 VANS CSV 解析，支援提交前衝突自檢。
 * 3. 🚨 無障礙：修復所有表單元素標籤與描述 (axe/forms)。
 * ==========================================
 */

interface AssetRow {
  id: number; model: string; sn: string; originalSn?: string; 
  mac1: string; mac2: string; ext: string; oldInfo: string; type: "NEW" | "REPLACE";
  ipPrecheck?: string;
}

interface ProgressRecord {
  formId: string; status: string; date: string; unit: string; model: string;
  sn: string; mac1: string; mac2: string; area: string; floor: string;
  applicantFull: string; remark: string; rejectReason: string; assignedIp: string; assignedName: string;
}

function KeyinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const vansCheckRef = useRef<HTMLInputElement>(null);

  // --- 1. 基礎狀態 ---
  const [vendorName, setVendorName] = useState("身分對稱中...");
  const [vdsId, setVdsId] = useState("VDS-LOADING");
  const [selectedDate, setSelectedDate] = useState("");
  const [unit, setUnit] = useState("");
  const [applicant, setApplicant] = useState("");
  const [area, setArea] = useState("A");
  const [floor, setFloor] = useState("");
  const [rows, setRows] = useState<AssetRow[]>([]);
  
  // --- 2. 交互狀態 ---
  const [isLoading, setIsLoading] = useState(false);
  const [loaderText, setLoaderText] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProgressOpen, setIsProgressOpen] = useState(false);
  const [progressData, setProgressData] = useState<ProgressRecord[]>([]);
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "error" | "info" }[]>([]);

  const showToast = useCallback((msg: string, type: "success" | "error" | "info" = "info") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // --- 3. 初始化與身分校驗 ---
  useEffect(() => {
    const currentVendor = sessionStorage.getItem("asset_link_vendor") || searchParams?.get("v") || "訪客";
    setVendorName(currentVendor);
    
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    setSelectedDate(today);
    setVdsId(`VDS-${String(now.getFullYear()).slice(-2)}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${Math.floor(Math.random()*900+100)}`);
    
    const draft = localStorage.getItem(`ALink_Draft_${currentVendor}`);
    if (draft) {
        try { setRows(JSON.parse(draft)); showToast("已自動恢復填報草稿", "info"); } 
        catch { setRows([{ id: Date.now(), model: "", sn: "", mac1: "", mac2: "", ext: "", oldInfo: "", type: "NEW" }]); }
    } else {
        setRows([{ id: Date.now(), model: "", sn: "", mac1: "", mac2: "", ext: "", oldInfo: "", type: "NEW" }]);
    }
  }, [searchParams, showToast]);

  useEffect(() => {
    if (rows.length > 0 && vendorName !== "訪客") {
        localStorage.setItem(`ALink_Draft_${vendorName}`, JSON.stringify(rows));
    }
  }, [rows, vendorName]);

  // --- 4. 業務邏輯對沖 ---
  const handleMacInput = (val: string) => {
    const cleaned = val.toUpperCase().replace(/[^0-9A-F]/g, '');
    let formatted = "";
    for (let i = 0; i < cleaned.length && i < 12; i++) {
        if (i > 0 && i % 2 === 0) formatted += ":";
        formatted += cleaned[i];
    }
    return formatted.slice(0, 17);
  };

  const addRow = () => {
    setRows([...rows, { id: Date.now(), model: "", sn: "", mac1: "", mac2: "", ext: "", oldInfo: "", type: "NEW" }]);
  };

  const removeRow = (id: number) => {
    if (rows.length > 1) setRows(rows.filter(r => r.id !== id));
  };

  const fetchProgress = async () => {
    setIsProgressOpen(true);
    setIsLoading(true);
    setLoaderText("調閱雲端進度清單...");
    try {
      const data = await getVendorProgress(vendorName);
      setProgressData(data as ProgressRecord[]);
    } catch { showToast("無法獲取進度清單", "error"); }
    finally { setIsLoading(false); }
  };

  const handleConfirmAsset = async (sn: string) => {
    if (!confirm("確認該設備已核定 IP 且設定完畢？執行後將移入歷史庫。")) return;
    setIsLoading(true);
    setLoaderText("執行物理結案遷移...");
    try {
      await vendorConfirmAsset(sn);
      showToast("設備結案成功，已歸檔至大數據庫", "success");
      fetchProgress();
    } catch { showToast("結案失敗", "error"); }
    finally { setIsLoading(false); }
  };

  const handleSubmit = async () => {
    if (!unit || !applicant || !floor) return showToast("行政基本資訊不可為空", "error");
    setIsLoading(true);
    setLoaderText("數據物理上鏈中...");
    const payload = rows.map(r => ({
      form_id: vdsId, install_date: selectedDate, area, floor: formatFloor(floor), unit,
      applicant: r.ext ? `${applicant}#${r.ext}` : applicant,
      model: r.model, sn: r.sn.toUpperCase(), mac1: r.mac1, mac2: r.mac2,
      remark: r.type === "REPLACE" ? `[REPLACE] 舊機: ${r.oldInfo}` : "新購填報",
      vendor: vendorName, status: "待核定", original_sn: r.originalSn
    }));

    try {
      await submitAssetBatch(payload);
      localStorage.removeItem(`ALink_Draft_${vendorName}`);
      showToast("✅ 批次填報成功，等待行政核定", "success");
      setTimeout(() => window.location.reload(), 2000);
    } catch { showToast("提交異常，請檢查網路或單號重複", "error"); }
    finally { setIsLoading(false); }
  };

  const handleVansCheck = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    setLoaderText("VANS 本地防撞檢查中...");
    const reader = new FileReader();
    reader.onload = (event) => {
        const text = event.target?.result as string;
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().replace(/^\uFEFF/, ''));
        const vansRecords = lines.slice(1).filter(l => l.trim() !== "").map(line => {
            const values = line.split(',');
            const entry: Record<string, string> = {};
            headers.forEach((h, i) => { entry[h] = values[i]?.trim() || ""; });
            return entry;
        });

        const newRows = rows.map(row => {
            const conflict = vansRecords.find(v => 
                (v['MAC 地址']?.toUpperCase().replace(/-/g, ':') === row.mac1) ||
                (v['設備序號']?.toUpperCase() === row.sn.toUpperCase())
            );
            return conflict ? { ...row, ipPrecheck: `⚠️ 與 VANS 衝突: ${conflict['內網 IP 位址']} (${conflict['名稱']})` } : { ...row, ipPrecheck: "✅ 物理校驗通過" };
        });

        setRows(newRows);
        showToast("VANS 預校對沖完成", "info");
        setIsLoading(false);
    };
    reader.readAsText(file);
  };

  return (
    <div className="bg-[#f8fafc] min-h-screen font-sans text-slate-900 antialiased overflow-x-hidden relative">
      <style dangerouslySetInnerHTML={{ __html: `
        .glass-panel { background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(25px); border: 1px solid rgba(255, 255, 255, 0.8); box-shadow: 0 10px 40px -10px rgba(0,0,0,0.04); }
        .saas-input { width: 100%; background: rgba(241, 245, 249, 0.5); border: 1px solid transparent; border-radius: 1.25rem; padding: 14px 18px; font-size: 14px; font-weight: 700; transition: all 0.3s; }
        .saas-input:focus { background: white; border-color: #2563eb; outline: none; box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1); }
        .saas-label { font-size: 11px; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px; display: block; margin-left: 6px; }
        .neon-text { text-shadow: 0 0 10px rgba(37, 99, 235, 0.2); }
      `}} />

      {/* 🚀 背景球還原 */}
      <div className="fixed z-0 blur-[120px] opacity-15 rounded-full pointer-events-none bg-blue-600 w-[700px] h-[700px] -top-64 -left-64 animate-pulse"></div>
      <div className="fixed z-0 blur-[120px] opacity-10 rounded-full pointer-events-none bg-emerald-400 w-[600px] h-[600px] bottom-0 right-0 animate-pulse delay-700"></div>
      <div className="fixed z-0 blur-[100px] opacity-10 rounded-full pointer-events-none bg-indigo-500 w-[400px] h-[400px] top-1/2 left-1/2 -translate-x-1/2 animate-bounce duration-[10s]"></div>

      <header className="fixed top-0 left-0 right-0 h-20 bg-white/60 backdrop-blur-xl border-b border-white/50 flex items-center justify-between px-10 z-[100]">
          <div className="flex items-center gap-4">
              <span className="text-2xl font-black bg-gradient-to-r from-blue-700 to-blue-500 bg-clip-text text-transparent tracking-tighter">ALink</span>
              <div className="h-6 w-[1px] bg-slate-200"></div>
              <span className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">調度填報中樞</span>
          </div>
          <div className="flex items-center gap-6">
              <div className="text-right hidden sm:block">
                  <p className="text-xs font-black text-slate-800 uppercase">{vendorName}</p>
                  <p className="text-[10px] text-emerald-500 font-bold tracking-widest">身分已物理對稱</p>
              </div>
              <button onClick={fetchProgress} className="px-6 py-2.5 bg-blue-50 text-blue-600 rounded-2xl font-black text-xs uppercase hover:bg-blue-600 hover:text-white transition-all shadow-sm">
                  進度查詢
              </button>
              <button onClick={() => setIsSidebarOpen(true)} className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-xl active:scale-95 transition-all">
                  <span className="material-symbols-outlined">menu</span>
              </button>
          </div>
      </header>

      <main className="pt-32 px-6 lg:px-10 max-w-7xl mx-auto pb-24 relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div>
                  <h1 className="text-4xl font-black text-slate-800 tracking-tighter neon-text">資產預約填報</h1>
                  <p className="text-sm font-bold text-slate-400 mt-2 flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></span>
                    物理參數校驗模式已開啟：支援 16 進位 MAC 自動對沖
                  </p>
              </div>
              <div className="flex gap-4">
                  {/* 🚀 Axe Fix: 隱藏上傳元件補齊 title, id 與描述 */}
                  <input id="vans-check-input-file" title="VANS 預校對沖 CSV 檔案選取" aria-label="VANS 預校對沖 CSV 檔案選取" type="file" accept=".csv" ref={vansCheckRef} onChange={handleVansCheck} className="hidden" />
                  <button onClick={() => vansCheckRef.current?.click()} className="px-8 py-5 bg-white border-2 border-blue-100 text-blue-600 rounded-[2rem] font-black text-xs uppercase tracking-widest hover:bg-blue-50 transition-all shadow-sm flex items-center gap-2">
                      <span className="material-symbols-outlined text-lg">security</span> VANS 預校自檢
                  </button>
                  <button onClick={handleSubmit} className="px-10 py-5 bg-slate-900 text-white rounded-[2rem] font-black shadow-2xl shadow-slate-900/20 hover:bg-blue-600 transition-all active:scale-95 flex items-center gap-3">
                      <span className="material-symbols-outlined">cloud_upload</span> 批次提交雲端
                  </button>
              </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              {/* --- 左側：行政基礎參數 --- */}
              <div className="lg:col-span-4 space-y-8 animate-in fade-in slide-in-from-left-6 duration-700">
                  <section className="glass-panel p-10 rounded-[3rem] space-y-8">
                      <h3 className="font-black text-slate-800 flex items-center gap-3 text-lg mb-4">
                        <span className="material-symbols-outlined text-blue-600">apartment</span> 行政安裝資訊
                      </h3>
                      <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-2">
                              <label className="saas-label" htmlFor="area-select-field">棟別</label>
                              <select id="area-select-field" title="選擇院區棟別" aria-label="選擇院區棟別" value={area} onChange={e => setArea(e.target.value)} className="saas-input">
                                  {["A","B","C","D","E","G","H","I","K","T"].map(v => <option key={v} value={v}>{v} 棟</option>)}
                              </select>
                          </div>
                          <div className="space-y-2">
                              <label className="saas-label" htmlFor="floor-input-field">樓層</label>
                              <input id="floor-input-field" title="輸入安裝樓層" aria-label="輸入安裝樓層" value={floor} onChange={e => setFloor(e.target.value)} className="saas-input" placeholder="例如：05" />
                          </div>
                      </div>
                      <div className="space-y-2">
                          <label className="saas-label !text-blue-600" htmlFor="unit-input-field">使用單位 (F 欄位)</label>
                          <input id="unit-input-field" title="輸入使用單位名稱" aria-label="輸入使用單位名稱" value={unit} onChange={e => setUnit(e.target.value)} className="saas-input" placeholder="例如：呼吸治療科" />
                      </div>
                      <div className="space-y-2">
                          <label className="saas-label" htmlFor="applicant-input-field">人員姓名 (G 欄位)</label>
                          <input id="applicant-input-field" title="輸入人員姓名" aria-label="輸入人員姓名" value={applicant} onChange={e => setApplicant(e.target.value)} className="saas-input" placeholder="王大明" />
                      </div>
                  </section>
              </div>

              {/* --- 右側：動態設備矩陣 --- */}
              <div className="lg:col-span-8 space-y-8 animate-in fade-in slide-in-from-right-6 duration-700">
                  {rows.map((r, i) => (
                    <div key={r.id} className={`glass-panel p-10 rounded-[3rem] border-l-[12px] relative group hover:shadow-2xl transition-all ${r.ipPrecheck?.includes('⚠️') ? 'border-l-red-500' : 'border-l-blue-600'}`}>
                        {rows.length > 1 && (
                            <button onClick={() => removeRow(r.id)} title="刪除此項設備" aria-label="刪除此項設備" className="absolute top-6 right-6 w-10 h-10 rounded-full bg-slate-50 text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all flex items-center justify-center shadow-inner">
                                <span className="material-symbols-outlined text-lg">delete</span>
                            </button>
                        )}
                        
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                            <div className="col-span-12 md:col-span-6 space-y-2">
                                <label className="saas-label" htmlFor={`mod-${r.id}`}>品牌型號 (I)</label>
                                <input id={`mod-${r.id}`} title="設備型號" aria-label="設備型號" placeholder="例如：HP ProDesk 400" value={r.model} onChange={e => { const n = [...rows]; n[i].model = e.target.value; setRows(n); }} className="saas-input" />
                            </div>
                            <div className="col-span-12 md:col-span-6 space-y-2">
                                <label className="saas-label !text-red-500" htmlFor={`sn-${r.id}`}>產品序號 S/N (J)</label>
                                <input id={`sn-${r.id}`} title="產品序號" aria-label="產品序號" placeholder="強制大寫序號" value={r.sn} onChange={e => { const n = [...rows]; n[i].sn = e.target.value.toUpperCase(); setRows(n); }} className="saas-input font-mono text-red-600 font-black" />
                            </div>
                            <div className="col-span-12 md:col-span-6 space-y-2">
                                <label className="saas-label !text-blue-500" htmlFor={`m1-${r.id}`}>有線 MAC 地址 (K)</label>
                                <input id={`m1-${r.id}`} title="有線主要 MAC" aria-label="有線主要 MAC" placeholder="XX:XX:XX:XX:XX:XX" value={r.mac1} onChange={e => { const n = [...rows]; n[i].mac1 = handleMacInput(e.target.value); setRows(n); }} className="saas-input font-mono" />
                            </div>
                            <div className="col-span-12 md:col-span-6 space-y-2">
                                <label className="saas-label" htmlFor={`m2-${r.id}`}>無線 MAC (L - 選填)</label>
                                {/* 🚀 Axe Fix: 補齊 placeholder 與描述 */}
                                <input id={`m2-${r.id}`} title="無線網卡 MAC" aria-label="無線網卡 MAC" placeholder="XX:XX:XX:XX:XX:XX" value={r.mac2} onChange={e => { const n = [...rows]; n[i].mac2 = handleMacInput(e.target.value); setRows(n); }} className="saas-input font-mono" />
                            </div>
                            <div className="col-span-12 space-y-2">
                                <label className="saas-label" htmlFor={`ext-${r.id}`}>汰換備註 / 擴充分機</label>
                                <div className="flex gap-4">
                                    <input id={`ext-${r.id}`} title="人員分機號碼" aria-label="人員分機號碼" placeholder="#1234" value={r.ext} onChange={e => { const n = [...rows]; n[i].ext = e.target.value; setRows(n); }} className="w-32 saas-input" />
                                    {/* 🚀 Axe Fix: 為汰換備註補齊標籤關聯 */}
                                    <label htmlFor={`old-${r.id}`} className="sr-only">舊機汰換資訊</label>
                                    <input id={`old-${r.id}`} title="舊機汰換資訊" aria-label="舊機汰換資訊" placeholder="若為汰換請填寫舊機序號或資訊..." value={r.oldInfo} onChange={e => { const n = [...rows]; n[i].oldInfo = e.target.value; setRows(n); }} className="flex-1 saas-input" />
                                </div>
                            </div>
                            {r.ipPrecheck && (
                                <div className="col-span-12 mt-2">
                                    <div className={`px-5 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest ${r.ipPrecheck.includes('⚠️') ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                        {r.ipPrecheck}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                  ))}
                  <button onClick={addRow} className="w-full py-12 border-2 border-dashed border-blue-300 rounded-[3rem] flex flex-col items-center justify-center text-blue-600 bg-blue-50/10 hover:bg-blue-50 transition-all font-black group">
                      <span className="material-symbols-outlined text-5xl mb-3 group-hover:scale-110 transition-transform">add_circle</span>
                      增加填報設備
                  </button>
              </div>
          </div>
      </main>

      {/* 進度查詢側板 */}
      {isProgressOpen && (
        <div className="fixed inset-0 z-[500] flex justify-end">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsProgressOpen(false)} />
            <div className="w-full max-w-md bg-white h-full shadow-2xl relative z-10 animate-in slide-in-from-right duration-500 flex flex-col">
                <div className="p-8 border-b bg-slate-50 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-black text-slate-800">廠商填報進度</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Live Status Matrix</p>
                    </div>
                    <button onClick={() => setIsProgressOpen(false)} title="關閉進度清單" aria-label="關閉進度清單" className="w-10 h-10 rounded-full bg-white border flex items-center justify-center shadow-sm"><span className="material-symbols-outlined">close</span></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {progressData.length === 0 ? (
                        <div className="py-20 text-center text-slate-300 italic font-bold">目前無近一個月填報紀錄</div>
                    ) : (
                        progressData.map(p => (
                            <div key={p.sn} className="glass-panel p-6 rounded-[2rem] border border-slate-100 space-y-4">
                                <div className="flex justify-between items-start">
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${p.status === '待核定' ? 'bg-amber-100 text-amber-600' : p.status === '已結案' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-600 text-white'}`}>{p.status}</span>
                                    <span className="font-mono text-[10px] text-slate-300">#{p.sn.slice(-6)}</span>
                                </div>
                                <h4 className="font-black text-slate-800 text-sm">{p.assignedName || p.unit} {p.assignedIp && <span className="text-blue-600 font-mono">({p.assignedIp})</span>}</h4>
                                <div className="text-[11px] font-bold text-slate-400 flex flex-col gap-1">
                                    <span>日期：{p.date}</span>
                                    <span>型號：{p.model}</span>
                                    <span>人員：{p.applicantFull}</span>
                                </div>
                                {p.status === '已核定(待確認)' && (
                                    <button onClick={() => handleConfirmAsset(p.sn)} className="w-full py-3 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase shadow-lg shadow-blue-200 hover:brightness-110 active:scale-95 transition-all">
                                        設定完畢 | 執行結案
                                    </button>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
      )}

      {/* 全域讀取遮罩 */}
      {isLoading && (
        <div className="fixed inset-0 z-[3000] flex flex-col items-center justify-center bg-white/80 backdrop-blur-2xl">
          <div className="w-24 h-24 border-[8px] border-slate-100 border-t-blue-600 rounded-full animate-spin mb-10 shadow-2xl"></div>
          <p className="text-blue-600 font-black tracking-[0.8em] uppercase text-xs animate-pulse neon-text">{loaderText || "物理數據對沖同步中..."}</p>
        </div>
      )}

      {/* 通知氣泡 */}
      <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[4000] flex flex-col gap-4 pointer-events-none w-full max-w-sm px-6">
        {toasts.map(t => (
          <div key={t.id} className={`px-10 py-6 rounded-[2.5rem] shadow-2xl font-black text-xs animate-in slide-in-from-bottom-4 flex items-center gap-5 border border-white/10 text-white backdrop-blur-2xl ${t.type === "success" ? "bg-emerald-600/90" : t.type === "error" ? "bg-red-600/90" : "bg-slate-900/90"}`}>
            <span className="material-symbols-outlined text-2xl">{t.type === 'success' ? 'verified' : 'info'}</span>
            <span className="tracking-[0.15em]">{t.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() { return <Suspense fallback={null}><KeyinContent /></Suspense>; }