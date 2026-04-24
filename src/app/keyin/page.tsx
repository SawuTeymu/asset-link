"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { submitAssetBatch, getAdminPendingData } from "@/lib/actions/assets";
import { formatFloor, formatMAC } from "@/lib/logic/formatters";

/**
 * ==========================================
 * 檔案：src/app/keyin/page.tsx
 * 狀態：V0.0 旗艦不刪減完全體 (Next.js 整合版)
 * 物理職責：廠商端預約錄入、本地草稿救援、17 欄位對位封裝、進度查詢
 * ==========================================
 */

interface DeviceRow {
  id: string;
  type: "NEW" | "REPLACE";
  ext: string;
  model: string;
  sn: string;
  mac1: string;
  mac2: string;
  oldInfo: string;
}

function KeyinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const vendorName = searchParams.get("v") || "訪客";

  // --- 1. 核心狀態管理 ---
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [vdsId, setVdsId] = useState("");
  const [area, setArea] = useState("A");
  const [areaOther, setAreaOther] = useState("");
  const [floor, setFloor] = useState("");
  const [unit, setUnit] = useState("");
  const [applicant, setApplicant] = useState("");
  const [rows, setRows] = useState<DeviceRow[]>([]);

  // UI 狀態
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProgressOpen, setIsProgressOpen] = useState(false);
  const [progressData, setProgressData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loaderText, setLoaderText] = useState("數據物理封裝中");
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "info" | "error" }[]>([]);

  // --- 2. 物理初始化與草稿對沖 ---

  // 初始化 VDS ID
  useEffect(() => {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const rs = String(Math.floor(Math.random() * 1000)).padStart(3, "0");
    setVdsId(`VDS-${yy}${mm}${dd}-${rs}`);
  }, []);

  // 讀取/儲存 LocalStorage 草稿
  useEffect(() => {
    const draftKey = `AL_KEYIN_V0_${vendorName}`;
    const saved = localStorage.getItem(draftKey);
    if (saved) {
      try {
        const d = JSON.parse(saved);
        setSelectedDate(d.date || selectedDate);
        setArea(d.area || "A");
        setAreaOther(d.areaOther || "");
        setFloor(d.floor || "");
        setUnit(d.unit || "");
        setApplicant(d.applicant || "");
        if (d.rows && d.rows.length > 0) setRows(d.rows);
        else addRow();
      } catch (e) { addRow(); }
    } else {
      addRow();
    }
  }, [vendorName]);

  useEffect(() => {
    if (vendorName !== "訪客") {
      const data = { date: selectedDate, area, areaOther, floor, unit, applicant, rows };
      localStorage.setItem(`AL_KEYIN_V0_${vendorName}`, JSON.stringify(data));
    }
  }, [selectedDate, area, areaOther, floor, unit, applicant, rows, vendorName]);

  // --- 3. 動態行管理 (SaaS 邏輯與屬性繼承) ---
  const addRow = (initialData?: Partial<DeviceRow>) => {
    const lastRow = rows[rows.length - 1];
    const newRow: DeviceRow = {
      id: Math.random().toString(36).substr(2, 9),
      type: initialData?.type || "NEW",
      ext: initialData?.ext || lastRow?.ext || "",
      model: initialData?.model || lastRow?.model || "",
      sn: initialData?.sn || "",
      mac1: initialData?.mac1 || "",
      mac2: initialData?.mac2 || "",
      oldInfo: initialData?.oldInfo || "",
    };
    setRows((prev) => [...prev, newRow]);
  };

  const removeRow = (id: string) => {
    if (rows.length === 1) return showToast("⚠️ 必須保留至少一項設備", "error");
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const updateRow = (id: string, field: keyof DeviceRow, value: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  // --- 4. 核心業務邏輯 ---

  const showToast = (msg: string, type: "info" | "error" = "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const handleLogout = () => {
    if (confirm("確定離開填報系統？未提交資料將保留在您的設備中。")) router.push("/");
  };

  const openProgress = async () => {
    setIsProgressOpen(true);
    setIsLoading(true);
    setLoaderText("調取雲端進度...");
    try {
      const { data, error } = await supabase
        .from("assets")
        .select("form_id, install_date, unit, model, status, reject_reason")
        .eq("vendor", vendorName)
        .order("created_at", { ascending: false });
      if (!error) setProgressData(data || []);
    } finally {
      setIsLoading(false);
    }
  };

  // 17 欄位強同步提交
  const handleSubmit = async () => {
    if (!floor || !unit || !applicant) return showToast("❌ 行政資訊 (樓層/單位/姓名) 為必填", "error");
    if (rows.some(r => !r.mac1 && !r.mac2)) return showToast("❌ 每個設備必須填寫至少一組 MAC", "error");

    setIsLoading(true);
    setLoaderText("物理封裝傳輸中...");

    const finalArea = area === "OTHER" ? areaOther : area;
    const batchData = rows.map((r) => ({
      created_at: new Date().toISOString(),
      form_id: vdsId,
      install_date: selectedDate,
      area: finalArea,
      floor: formatFloor(floor),
      unit: unit,
      applicant: `${applicant}#${r.ext}`,
      device_type: "", // 待核定時由資訊室填寫
      model: r.model,
      sn: r.sn || vdsId.replace("VDS-", "").slice(-5) + Math.floor(1000 + Math.random() * 9000),
      mac1: formatMAC(r.mac1),
      mac2: formatMAC(r.mac2),
      remark: (r.type === "REPLACE" ? "[REPLACE] 舊機汰換。" : "資產新購。") + r.oldInfo,
      name: "",
      ip: "",
      status: "待核定",
      reject_reason: "",
      vendor: vendorName
    }));

    try {
      const { success } = await submitAssetBatch(batchData as any);
      if (success) {
        localStorage.removeItem(`AL_KEYIN_V0_${vendorName}`);
        showToast("✅ 數據對沖提交成功！", "info");
        setTimeout(() => window.location.reload(), 2000);
      }
    } catch (e: any) {
      showToast("傳輸失敗：" + e.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  // 日曆生成邏輯
  const calendarDays = useMemo(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let j = 1; j <= daysInMonth; j++) {
      const d = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(j).padStart(2, "0")}`;
      days.push(d);
    }
    return days;
  }, []);

  return (
    <div className="bg-[#f7f9fb] min-h-screen font-[family-name:-apple-system,BlinkMacSystemFont,'SF_Pro_TC','PingFang_TC',system-ui,sans-serif] text-[10.5px] text-[#191c1e] antialiased tracking-tight">
      <style dangerouslySetInnerHTML={{ __html: `
        .glass-panel { background: rgba(255, 255, 255, 0.45); backdrop-filter: blur(40px); -webkit-backdrop-filter: blur(40px); border: 1px solid rgba(255, 255, 255, 0.6); box-shadow: 0 10px 40px rgba(0, 88, 188, 0.04); }
        .liquid-bg { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: -1; overflow: hidden; background: #f7f9fb; }
        .blob { position: absolute; filter: blur(80px); opacity: 0.25; border-radius: 50%; width: 600px; height: 600px; }
        .calendar-day { height: 2.5rem; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; border-radius: 12px; cursor: pointer; transition: all 0.2s; }
        .calendar-day:hover:not(.active) { background: rgba(0, 88, 188, 0.05); color: #0058bc; }
        .calendar-day.active { background: #0058bc; color: white; box-shadow: 0 4px 12px rgba(0, 88, 188, 0.25); }
        .saas-label { font-size: 9px; font-weight: 900; color: #717786; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; display: block; }
        .type-toggle { display: flex; padding: 4px; background: rgba(241, 245, 249, 0.7); border-radius: 12px; }
        .type-btn { flex: 1; padding: 8px 0; font-size: 10px; font-weight: 800; color: #717786; border-radius: 8px; transition: all 0.3s; }
        .type-btn.active { background: white; color: #0058bc; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
        .compact-input { width: 100%; background: rgba(255,255,255,0.6); border: 1px solid rgba(0,0,0,0.05); border-radius: 12px; padding: 10px 14px; font-size: 11.5px; font-weight: 700; outline: none; transition: all 0.2s; }
        .compact-input:focus { background: white; border-color: #0058bc; box-shadow: 0 0 0 4px rgba(0, 88, 188, 0.1); }
        .material-symbols-outlined { font-family: 'Material Symbols Outlined' !important; font-variation-settings: 'FILL' 1; }
        .fade-enter { animation: fadeIn 0.4s ease-out forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}} />

      {/* 背景裝飾 */}
      <div className="liquid-bg">
        <div className="blob bg-primary-fixed-dim" style={{ top: "-100px", left: "-100px" }}></div>
        <div className="blob bg-secondary-fixed" style={{ bottom: "-200px", right: "-100px", background: "linear-gradient(135deg, rgba(0, 122, 255, 0.1) 0%, rgba(0, 227, 253, 0.1) 100%)" }}></div>
      </div>

      {/* 側邊導覽列 */}
      <aside className={`fixed left-0 top-0 h-screen w-64 bg-white/40 backdrop-blur-3xl border-r border-white/40 p-6 flex flex-col z-[140] transition-transform duration-300 ${isSidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="mb-12">
          <h1 className="text-xl font-black bg-gradient-to-r from-primary to-primary-container bg-clip-text text-transparent tracking-tighter">Asset-Link</h1>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Key-in Hub V0.0</p>
        </div>
        <nav className="flex-1 space-y-2">
          <div className="flex items-center gap-3 px-4 py-3 bg-primary/10 text-primary rounded-xl border-l-4 border-primary font-black"><span className="material-symbols-outlined">event_note</span> 預約填報</div>
          <div onClick={openProgress} className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-white/50 rounded-xl font-bold cursor-pointer transition-all"><span className="material-symbols-outlined">manage_search</span> 進度查詢</div>
        </nav>
        <div className="mt-auto pt-6 border-t border-slate-200">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-error font-black hover:bg-red-50 transition-all"><span className="material-symbols-outlined">logout</span> 安全登出</button>
        </div>
      </aside>

      {/* 主內容區 */}
      <main className="lg:ml-64 min-h-screen flex flex-col p-6 lg:p-10">
        <header className="flex justify-between items-center mb-10">
          <div className="flex items-center gap-4">
            <button onClick={toggleSidebar} className="lg:hidden p-2.5 glass-panel rounded-xl"><span className="material-symbols-outlined text-slate-600">menu</span></button>
            <h2 className="text-2xl font-black tracking-tight text-slate-900">設備預約填報</h2>
          </div>
          <div className="glass-panel px-4 py-2 flex items-center gap-4">
            <div className="text-right"><p className="text-[9px] font-black text-slate-400 uppercase leading-none">{vendorName}</p><div className="font-black text-emerald-600 text-[10px] italic">Verified Partner</div></div>
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-primary shadow-sm"><span className="material-symbols-outlined text-lg">precision_manufacturing</span></div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-7xl mx-auto w-full">
          {/* 左側：行政設定 */}
          <div className="lg:col-span-4 space-y-6">
            <div className="glass-panel p-8 rounded-[2rem] space-y-6">
              <div className="flex justify-between items-center border-b border-white/50 pb-4">
                <h3 className="font-black text-slate-800 flex items-center gap-2"><span className="material-symbols-outlined text-primary">calendar_today</span> 裝機日期 (C)</h3>
                <div className="px-3 py-1 bg-primary/5 text-primary rounded-lg font-mono font-black text-[10px]">{vdsId}</div>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {["日","一","二","三","四","五","六"].map(d => <div key={d} className="text-center text-[9px] font-black text-slate-300 py-2">{d}</div>)}
                {calendarDays.map((d, i) => d ? (
                  <div key={i} onClick={() => setSelectedDate(d)} className={`calendar-day ${selectedDate === d ? "active" : ""}`}>{parseInt(d.split("-")[2])}</div>
                ) : <div key={i} />)}
              </div>
            </div>

            <div className="glass-panel p-8 rounded-[2rem] space-y-5">
              <h3 className="font-black text-slate-800 flex items-center gap-2 mb-2"><span className="material-symbols-outlined text-primary">corporate_fare</span> 行政資訊</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="saas-label">院區棟別 (D)</label>
                  <select value={area} onChange={e => setArea(e.target.value)} className="compact-input">
                    {["A","B","C","D","E","G","H","I","K","T","OTHER"].map(v => <option key={v} value={v}>{v === "OTHER" ? "其他" : v + " 棟"}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="saas-label">樓層 (E)</label>
                  <input type="text" value={floor} onChange={e => setFloor(e.target.value)} onBlur={e => setFloor(formatFloor(e.target.value))} className="compact-input" placeholder="例: 05" />
                </div>
              </div>
              {area === "OTHER" && <input type="text" value={areaOther} onChange={e => setAreaOther(e.target.value)} className="compact-input fade-enter" placeholder="手動輸入地點" />}
              <div className="space-y-1.5">
                <label className="saas-label">使用單位 (F)</label>
                <input type="text" value={unit} onChange={e => setUnit(e.target.value)} className="compact-input" placeholder="單位全銜名稱" />
              </div>
              <div className="space-y-1.5">
                <label className="saas-label text-primary">申請人姓名 (G)</label>
                <input type="text" value={applicant} onChange={e => setApplicant(e.target.value)} className="compact-input bg-primary/5 border-primary/10" placeholder="請輸入姓名" />
                <p className="text-[9px] text-slate-400 font-bold ml-1">※ 分機請於下方設備明細填報</p>
              </div>
            </div>
          </div>

          {/* 右側：設備清單 */}
          <div className="lg:col-span-8 space-y-6">
            <div className="flex justify-between items-end px-4">
              <h3 className="font-black text-slate-800 flex items-center gap-2"><span className="material-symbols-outlined text-primary">devices</span> 設備錄入明細</h3>
              <div className="px-3 py-1 bg-white/60 border border-white rounded-lg font-black text-slate-500 text-[10px]">總計 {rows.length} 節點</div>
            </div>

            <div className="space-y-5">
              {rows.map((row) => (
                <div key={row.id} className="glass-panel p-7 rounded-[2rem] relative fade-enter group hover:shadow-lg transition-all">
                  <button onClick={() => removeRow(row.id)} className="absolute -top-3 -right-3 w-8 h-8 bg-white border border-slate-100 text-slate-400 hover:text-white hover:bg-error rounded-full flex items-center justify-center shadow-md active:scale-90 transition-all opacity-0 group-hover:opacity-100 z-10"><span className="material-symbols-outlined text-sm">close</span></button>
                  <div className="grid grid-cols-12 gap-6">
                    <div className="col-span-12 md:col-span-4 space-y-1.5">
                      <label className="saas-label">業務性質 (觸發封存)</label>
                      <div className="type-toggle">
                        <button onClick={() => updateRow(row.id, "type", "NEW")} className={`type-btn ${row.type === "NEW" ? "active" : ""}`}>🆕 資產新購</button>
                        <button onClick={() => updateRow(row.id, "type", "REPLACE")} className={`type-btn ${row.type === "REPLACE" ? "active" : ""}`}>🔄 舊機汰換</button>
                      </div>
                    </div>
                    <div className="col-span-6 md:col-span-2 space-y-1.5">
                      <label className="saas-label">分機 (G)</label>
                      <input type="text" value={row.ext} onChange={e => updateRow(row.id, "ext", e.target.value)} className="compact-input font-mono" placeholder="4或5碼" />
                    </div>
                    <div className="col-span-6 md:col-span-6 space-y-1.5">
                      <label className="saas-label">品牌型號 (I)</label>
                      <input type="text" value={row.model} onChange={e => updateRow(row.id, "model", e.target.value)} className="compact-input" placeholder="例: DELL OptiPlex" />
                    </div>
                    <div className="col-span-12 space-y-1.5">
                      <label className="saas-label text-error font-bold">設備序號 S/N (J)</label>
                      <input type="text" value={row.sn} onChange={e => updateRow(row.id, "sn", e.target.value.toUpperCase())} className="compact-input font-mono tracking-widest text-error bg-red-50/30" placeholder="12碼大寫序號" maxLength={12} />
                    </div>
                    {row.type === "REPLACE" && (
                      <div className="col-span-12 p-5 bg-amber-50/40 rounded-2xl border border-amber-100/60 shadow-inner fade-enter">
                        <label className="saas-label text-amber-700 italic">原舊機指紋 (對沖 M 欄)</label>
                        <input type="text" value={row.oldInfo} onChange={e => updateRow(row.id, "oldInfo", e.target.value)} className="compact-input border-amber-200 bg-white/80" placeholder="輸入舊機 IP 或電腦名稱" />
                      </div>
                    )}
                    <div className="col-span-12 md:col-span-6 space-y-1.5">
                      <label className="saas-label text-primary font-bold">有線網路 MAC (K)</label>
                      <input type="text" value={row.mac1} onChange={e => updateRow(row.id, "mac1", formatMAC(e.target.value))} className="compact-input font-mono text-primary" placeholder="XX:XX:XX:XX:XX:XX" maxLength={17} />
                    </div>
                    <div className="col-span-12 md:col-span-6 space-y-1.5">
                      <label className="saas-label text-emerald-600 font-bold">無線網路 MAC (L)</label>
                      <input type="text" value={row.mac2} onChange={e => updateRow(row.id, "mac2", formatMAC(e.target.value))} className="compact-input font-mono text-emerald-700" placeholder="若無則留空" maxLength={17} />
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={() => addRow()} className="w-full py-10 border-2 border-dashed border-primary/20 rounded-[2.5rem] bg-white/30 text-primary flex flex-col items-center justify-center hover:bg-primary/5 hover:border-primary/40 transition-all active:scale-[0.98] group">
                <span className="material-symbols-outlined text-4xl mb-2 group-hover:scale-110 transition-transform">add_circle</span>
                <span className="font-black text-sm tracking-widest uppercase">增加設備項目</span>
                <span className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest">支援自動屬性繼承與批次封裝</span>
              </button>
            </div>

            <div className="flex gap-4 pt-6">
              <button onClick={() => { if(confirm("確定清空目前所有輸入？")) setRows([]); addRow(); }} className="flex-1 py-5 glass-panel rounded-2xl font-black text-slate-500 hover:text-error transition-all uppercase tracking-widest active:scale-95 shadow-md">物理清空</button>
              <button onClick={handleSubmit} className="flex-[2] py-5 bg-primary text-white rounded-2xl font-black shadow-xl shadow-primary/20 hover:shadow-primary/40 transition-all active:scale-95 uppercase tracking-[0.3em] text-sm">確認提交雲端</button>
            </div>
          </div>
        </div>
      </main>

      {/* 🚀 進度查詢彈窗 */}
      {isProgressOpen && (
        <div className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-6 fade-enter">
          <div className="glass-panel w-full max-w-3xl max-h-[85vh] flex flex-col rounded-[2.5rem] overflow-hidden shadow-2xl bg-white/95">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-white/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg"><span className="material-symbols-outlined text-3xl">manage_search</span></div>
                <div><h3 className="text-xl font-black text-slate-800 tracking-tight">歷史預約進度</h3><p className="text-[10px] font-bold text-primary uppercase tracking-widest mt-0.5">{vendorName} 控制區</p></div>
              </div>
              <button onClick={() => setIsProgressOpen(false)} className="w-10 h-10 rounded-full hover:bg-red-50 text-slate-400 hover:text-error flex items-center justify-center transition-colors"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-4">
              {progressData.length === 0 ? (
                <div className="py-24 text-center opacity-30 font-black tracking-widest uppercase">目前尚無預約紀錄</div>
              ) : (
                progressData.map((item, idx) => (
                  <div key={idx} className="p-6 rounded-2xl border border-slate-100 bg-white/40 shadow-sm space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-mono font-black text-slate-800 text-sm">{item.form_id}</span>
                      <span className={`px-3 py-1 rounded-full font-black text-[9px] uppercase tracking-widest border ${item.status === '已結案' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : item.status === '退回修正' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-orange-50 text-orange-600 border-orange-100'}`}>{item.status}</span>
                    </div>
                    <div className="text-[11px] font-bold text-slate-500 flex gap-3">
                      <span className="text-primary">{item.install_date}</span> | <span>{item.unit}</span> | <span>{item.model}</span>
                    </div>
                    {item.reject_reason && (
                      <div className="p-3 bg-red-50 rounded-xl border border-red-100 text-red-600 text-[10px] font-black flex items-start gap-2 animate-pulse">
                        <span className="material-symbols-outlined text-base">report</span> <span>退回原因：{item.reject_reason}</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 強同步遮罩 */}
      {isLoading && (
        <div className="fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-white/80 backdrop-blur-xl">
          <div className="w-12 h-12 border-2 border-slate-100 border-t-primary rounded-full animate-spin mb-6"></div>
          <p className="text-primary font-black tracking-[0.4em] uppercase text-[12px]">{loaderText}</p>
        </div>
      )}

      {/* 通知系統 */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[1100] flex flex-col gap-3 pointer-events-none w-full max-w-[320px] px-5">
        {toasts.map(t => (
          <div key={t.id} className={`px-6 py-4 rounded-3xl shadow-2xl font-black text-[11px] animate-bounce flex items-center gap-3 border border-white/20 ${t.type === "info" ? "bg-slate-900" : "bg-red-600"} text-white`}>
            <span className="material-symbols-outlined text-sm">info</span>
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<div className="h-screen w-screen flex items-center justify-center font-black text-primary animate-pulse uppercase tracking-[0.5em]">數據鏈路同步中...</div>}>
      <KeyinContent />
    </Suspense>
  );
}