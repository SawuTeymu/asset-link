"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";

// 🚀 引入佈局與 UI 組件
import AdminSidebar from "@/components/layout/AdminSidebar";
import TopNavbar from "@/components/layout/TopNavbar";

// 🚀 保留所有 Server Actions 與 邏輯 (0 刪除)
import { 
  getNsrList, 
  submitNsrData, 
  settleNsrRecord,
  updateNsrStatus,
  deleteNsrRecord
} from "@/lib/actions/nsr";
import { formatFloor } from "@/lib/logic/formatters";
import { calculateNsrPrice } from "@/lib/logic/pricing";

/**
 * ==========================================
 * 檔案：src/app/nsr/page.tsx
 * 狀態：V200.0 Titanium Crystal 重設計版
 * 物理職責：
 * 1. 視覺升維：採用鈦金工業風格、Bento Layout、精細微光邊框。
 * 2. 邏輯鎖定：100% 保留 115 年度計價、C01 單號對沖、Blob 輸出。
 * 3. 交互進化：物理開關、深度陰影、技術型數據展示。
 * ==========================================
 */

interface NsrRecord {
  id: string; 
  date: string; 
  area: string; 
  floor: string; 
  deptCode: string;
  unit: string; 
  user: string; 
  ext: string; 
  points: number; 
  type: string;
  reason: string;
  total: number; 
  status: string;
}

export default function NsrAdminPage() {
  const router = useRouter();
  
  // --- 1. 數據矩陣狀態 (保留) ---
  const [globalNsrData, setGlobalNsrData] = useState<NsrRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loaderText, setLoaderText] = useState("調研中...");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    id: "", date: "", area: "A", floor: "", unit: "", 
    userWithExt: "", points: 1, type: "CAT 6", reason: ""
  });

  const [settleItem, setSettleItem] = useState<NsrRecord | null>(null);
  const [isAddonWork, setIsAddonWork] = useState(false);
  const [usePanel, setUsePanel] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "error" | "info" }[]>([]);

  const showToast = useCallback((msg: string, type: "success" | "error" | "info" = "info") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // --- 2. 數據同步核心 (保留) ---
  const refreshData = useCallback(async () => {
    setIsLoading(true);
    setLoaderText("對沖 115 矩陣...");
    try {
      const data = await getNsrList();
      const mapped = (data || []).map((r: any) => ({
        id: r.申請單號, date: r.申請日期, area: r.棟別, floor: r.樓層,
        deptCode: r.部門代號, unit: r.申請單位, user: r.申請人,
        ext: r.連絡電話, points: r.需求數量, type: r.線材規格,
        reason: r.施工事由, total: r.行政核銷總額, status: r.處理狀態
      }));
      setGlobalNsrData(mapped);
    } catch {
      showToast("雲端對沖失敗", "error");
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    const auth = sessionStorage.getItem("asset_link_admin_auth");
    if (!auth) { router.push("/"); return; }
    refreshData();
  }, [router, refreshData]);

  // --- 3. 業務邏輯對沖 (保留) ---
  const handleIdInput = (val: string) => {
    const id = val.toUpperCase();
    setFormData(prev => ({ ...prev, id }));
    if (id.startsWith("C01") && id.length === 15) {
      const parsedDate = `${id.substring(3, 7)}-${id.substring(7, 9)}-${id.substring(9, 11)}`;
      setFormData(prev => ({ ...prev, date: parsedDate }));
      showToast("日期物理對正成功", "success");
    }
  };

  const handleNsrSubmit = async () => {
    if (!formData.id || !formData.unit || !formData.userWithExt) return showToast("欄位殘缺", "error");
    if (!formData.userWithExt.includes("#")) return showToast("格式錯誤 (#)", "error");
    setIsLoading(true);
    const [user, ext] = formData.userWithExt.split("#");
    try {
      await submitNsrData({
        form_id: formData.id, request_date: formData.date, area: formData.area,
        floor: formatFloor(formData.floor), dept_code: "N/A", unit: formData.unit,
        applicant: user, phone: ext, qty: formData.points, cable_type: formData.type,
        reason: formData.reason
      });
      showToast("數據錄入成功", "success");
      setFormData({ id: "", date: "", area: "A", floor: "", unit: "", userWithExt: "", points: 1, type: "CAT 6", reason: "" });
      refreshData();
    } catch { showToast("寫入失敗", "error"); }
    finally { setIsLoading(false); }
  };

  const handleExportDispatch = async (item: NsrRecord) => {
    const content = `【ALink 派工】\n單號：${item.id}\n單位：${item.unit}\n地點：${item.area}棟 ${item.floor}F\n點位：${item.points} (${item.type})`;
    const blob = new Blob([content], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Dispatch_${item.id}.txt`;
    link.click();
    await updateNsrStatus(item.id, "已派工");
    refreshData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`物理刪除單號 [${id}]？`)) return;
    setIsLoading(true);
    try { await deleteNsrRecord(id); refreshData(); } catch { showToast("刪除失敗", "error"); }
    finally { setIsLoading(false); }
  };

  const handleSettleCommit = async () => {
    if (!settleItem) return;
    setIsLoading(true);
    try {
      await settleNsrRecord({
        form_id: settleItem.id, isAddon: isAddonWork, usePanel: usePanel,
        finishRemark: `核銷：${isAddonWork ? "加成 " : ""}${usePanel ? "+面板" : ""}`
      });
      setSettleItem(null);
      refreshData();
    } catch { showToast("結算失敗", "error"); }
    finally { setIsLoading(false); }
  };

  const pendingPool = globalNsrData.filter(r => ["未處理", "待處理", "已派工"].includes(r.status));
  const settlePool = globalNsrData.filter(r => r.status === "已完工");

  return (
    <div className="bg-[#0a0c10] min-h-screen font-sans text-slate-300 antialiased overflow-x-hidden relative selection:bg-blue-500/30">
      
      {/* 🚀 新視覺樣式表：Titanium Crystal */}
      <style dangerouslySetInnerHTML={{ __html: `
        .bento-card { background: linear-gradient(145deg, rgba(30, 41, 59, 0.4), rgba(15, 23, 42, 0.7)); border: 1px solid rgba(255, 255, 255, 0.05); backdrop-filter: blur(20px); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); }
        .crystal-input { background: rgba(0, 0, 0, 0.2); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 0.75rem; padding: 14px 18px; font-weight: 500; font-size: 13px; color: #f8fafc; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .crystal-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1); background: rgba(0,0,0,0.4); outline: none; }
        .tech-label { font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.2em; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
        .titanium-btn { background: linear-gradient(to bottom, #3b82f6, #2563eb); border-top: 1px solid rgba(255,255,255,0.2); transition: all 0.3s; }
        .titanium-btn:hover { transform: translateY(-2px); box-shadow: 0 10px 30px -10px rgba(37, 99, 235, 0.5); }
        .status-badge { padding: 4px 10px; border-radius: 6px; font-size: 10px; font-weight: 900; letter-spacing: 0.1em; text-transform: uppercase; }
        @keyframes subtle-glow { 0% { opacity: 0.3; } 50% { opacity: 0.6; } 100% { opacity: 0.3; } }
        .bg-mesh { position: fixed; inset: 0; background: radial-gradient(circle at 0% 0%, rgba(37, 99, 235, 0.08) 0%, transparent 40%), radial-gradient(circle at 100% 100%, rgba(16, 185, 129, 0.05) 0%, transparent 40%); z-index: 0; pointer-events: none; }
      `}} />

      <div className="bg-mesh"></div>

      <AdminSidebar currentRoute="/nsr" isOpen={isSidebarOpen} onLogout={() => router.push("/")} />

      <main className="lg:ml-64 min-h-screen flex flex-col p-6 lg:p-8 relative z-10">
        <TopNavbar title="NSR 施工與計價對沖中樞" onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-8">
          
          {/* A. 錄入面板 (左側 Bento) */}
          <section className="lg:col-span-4 animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="bento-card p-8 rounded-[2rem] sticky top-6 border border-white/5">
                <div className="flex items-center gap-4 mb-10 pb-6 border-b border-white/5">
                    <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500 shadow-inner"><span className="material-symbols-outlined">add_task</span></div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-100 tracking-tight">需求錄入</h2>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Entry Command</p>
                    </div>
                </div>
                
                <div className="space-y-6">
                    <div className="space-y-2">
                        <label className="tech-label"><span className="w-1 h-3 bg-blue-500 rounded-full"></span> 申請單號 (C01)</label>
                        <input value={formData.id} onChange={e => handleIdInput(e.target.value)} placeholder="C01XXXXXXXXXXXX" className="crystal-input w-full font-mono text-blue-400 placeholder:text-slate-700" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="tech-label">裝機日期</label>
                          <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="crystal-input w-full text-xs" />
                        </div>
                        <div className="space-y-2">
                          <label className="tech-label">區域</label>
                          <select value={formData.area} onChange={e => setFormData({...formData, area: e.target.value})} className="crystal-input w-full appearance-none">
                            {["A","B","C","D","E","G","H","I","K","T"].map(v => <option key={v} value={v}>{v} 棟</option>)}
                          </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="tech-label">樓層</label>
                          <input placeholder="05" value={formData.floor} onChange={e => setFormData({...formData, floor: e.target.value})} className="crystal-input w-full" />
                        </div>
                        <div className="space-y-2">
                          <label className="tech-label">點位</label>
                          <input type="number" min={1} value={formData.points} onChange={e => setFormData({...formData, points: parseInt(e.target.value) || 1})} className="crystal-input w-full" />
                        </div>
                    </div>
                    <div className="space-y-2">
                      <label className="tech-label">申請單位</label>
                      <input placeholder="單位全稱" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="crystal-input w-full" />
                    </div>
                    <div className="space-y-2">
                      <label className="tech-label !text-blue-400">申請人 (姓名#分機)</label>
                      <input placeholder="王大明#1234" value={formData.userWithExt} onChange={e => setFormData({...formData, userWithExt: e.target.value})} className="crystal-input w-full border-blue-500/20" />
                    </div>
                    <button onClick={handleNsrSubmit} className="titanium-btn w-full py-4 rounded-xl text-white font-black text-xs uppercase tracking-[0.2em] shadow-lg active:scale-95">提交行政對沖</button>
                </div>
            </div>
          </section>

          {/* B. 狀態監控與計價池 (右側 Bento) */}
          <section className="lg:col-span-8 space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            
            {/* 施工監控 Bento */}
            <div className="bento-card p-8 rounded-[2.5rem]">
                <div className="flex justify-between items-center mb-8">
                    <h3 className="text-sm font-black text-slate-100 uppercase tracking-[0.3em] flex items-center gap-3">
                      <span className="w-1.5 h-6 bg-amber-500 rounded-full"></span> 實體施工監控池
                    </h3>
                    <div className="bg-slate-800/50 px-4 py-1.5 rounded-lg border border-white/5 font-mono text-[10px] text-slate-400">ACTIVE_TASKS: {pendingPool.length}</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pendingPool.map((item, idx) => (
                        <div key={item.id} className="bg-slate-900/40 p-6 rounded-2xl border border-white/5 hover:border-blue-500/30 transition-all group relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleDelete(item.id)} className="text-red-500/50 hover:text-red-500 transition-colors"><span className="material-symbols-outlined text-sm">delete</span></button>
                            </div>
                            <div className="flex items-center justify-between mb-4">
                                <span className={`status-badge ${item.status === '已派工' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-slate-700/30 text-slate-500'}`}>{item.status}</span>
                                <span className="font-mono text-[9px] text-slate-600">ID:{item.id}</span>
                            </div>
                            <h4 className="font-bold text-slate-100 mb-1">{item.unit}</h4>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter mb-6">{item.area}棟 {item.floor}F | {item.points}PTS ({item.type})</p>
                            <div className="flex gap-2">
                                <button onClick={() => handleExportDispatch(item)} className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-[10px] font-black uppercase text-slate-300 transition-all border border-white/5">派工輸出</button>
                                <button onClick={() => updateNsrStatus(item.id, "已完工").then(refreshData)} className="flex-1 py-2.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white rounded-lg text-[10px] font-black uppercase transition-all border border-emerald-500/20">回報完工</button>
                            </div>
                        </div>
                    ))}
                    {pendingPool.length === 0 && <div className="col-span-full py-12 text-center text-slate-600 font-bold italic text-sm">待辦池物理排空</div>}
                </div>
            </div>

            {/* 計價結算 Bento */}
            <div className="bento-card p-8 rounded-[2.5rem] border-t-2 border-t-emerald-500/50">
                <div className="flex justify-between items-center mb-8">
                    <h3 className="text-sm font-black text-slate-100 uppercase tracking-[0.3em] flex items-center gap-3">
                      <span className="w-1.5 h-6 bg-emerald-500 rounded-full"></span> 115 年度財務結算矩陣
                    </h3>
                </div>
                <div className="space-y-3">
                    {settlePool.map((item, idx) => (
                        <div key={item.id} className="bg-emerald-500/5 p-6 rounded-2xl border border-emerald-500/10 flex flex-col md:flex-row justify-between items-center group hover:bg-emerald-500/10 transition-all">
                            <div className="text-center md:text-left mb-4 md:mb-0">
                                <span className="font-bold text-slate-100 text-base">{item.unit}</span>
                                <div className="flex gap-4 mt-1">
                                    <span className="text-[9px] font-black text-emerald-500/80 uppercase">待結算</span>
                                    <span className="text-[9px] font-mono text-slate-500">{item.type} | {item.points} PTS</span>
                                </div>
                            </div>
                            <button onClick={() => { setSettleItem(item); setIsAddonWork(false); setUsePanel(false); }} className="px-8 py-3 bg-emerald-500 text-white rounded-xl font-black text-[10px] uppercase shadow-lg shadow-emerald-500/20 active:scale-95 hover:brightness-110 transition-all flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm">payments</span> 執行核銷
                            </button>
                        </div>
                    ))}
                    {settlePool.length === 0 && <div className="py-8 text-center text-slate-600 font-bold italic text-xs uppercase tracking-widest">無待核銷資產數據</div>}
                </div>
            </div>
          </section>
        </div>
      </main>

      {/* --- 結算 Modal (Crystal 深度重設計) --- */}
      {settleItem && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in">
            <div className="bg-[#0f172a] w-full max-w-xl rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden border border-white/10">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full -mr-32 -mt-32 blur-[80px]"></div>
                <h2 className="text-2xl font-black text-white tracking-tighter mb-8 flex items-center gap-3">
                   <span className="material-symbols-outlined text-blue-500">account_balance_wallet</span> 財務對沖核銷
                </h2>
                
                <div className="space-y-6 mb-10 bg-black/20 p-6 rounded-2xl border border-white/5">
                    <div className="flex justify-between border-b border-white/5 pb-4"><span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">申請單號</span><span className="font-mono text-blue-400 font-bold">{settleItem.id}</span></div>
                    <div className="flex justify-between border-b border-white/5 pb-4"><span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">施工規格</span><span className="text-white font-bold">{settleItem.type}</span></div>
                    
                    <div className="space-y-4 pt-4">
                        <label className="flex items-center justify-between cursor-pointer group">
                            <span className="text-xs font-bold text-slate-300 group-hover:text-white transition-colors">符合「加成施工」條件 (夜間/複雜)</span>
                            <input type="checkbox" checked={isAddonWork} onChange={e => setIsAddonWork(e.target.checked)} className="w-5 h-5 rounded bg-slate-800 border-white/10 text-blue-500" />
                        </label>
                        <label className="flex items-center justify-between cursor-pointer group">
                            <span className="text-xs font-bold text-slate-300 group-hover:text-white transition-colors">加購 ㄑ字型 24 埠 PANEL 空架 (+$1,000)</span>
                            <input type="checkbox" checked={usePanel} onChange={e => setUsePanel(e.target.checked)} className="w-5 h-5 rounded bg-slate-800 border-white/10 text-emerald-500" />
                        </label>
                    </div>
                </div>

                <div className="text-center p-8 bg-blue-500/5 rounded-3xl border border-blue-500/10 mb-10">
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.4em] mb-4">本案對沖預算總額 (含稅)</p>
                    <p className="text-6xl font-black font-mono text-white tracking-tighter">
                        <span className="text-2xl text-slate-600 mr-2">$</span>
                        {calculateNsrPrice(settleItem.type, settleItem.points, isAddonWork, usePanel).toLocaleString()}
                    </p>
                </div>

                <div className="flex gap-4">
                    <button onClick={() => setSettleItem(null)} className="flex-1 py-4 text-xs font-black text-slate-500 hover:text-white transition-all uppercase tracking-widest">取消</button>
                    <button onClick={handleSettleCommit} className="flex-[2] py-4 bg-white text-slate-900 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all">確認結算同步</button>
                </div>
            </div>
        </div>
      )}

      {/* --- 全域強同步遮罩 --- */}
      {isLoading && (
        <div className="fixed inset-0 z-[3000] flex flex-col items-center justify-center bg-black/60 backdrop-blur-xl">
          <div className="w-14 h-14 border-[3px] border-slate-800 border-t-blue-500 rounded-full animate-spin mb-6"></div>
          <p className="text-blue-500 font-black tracking-[0.4em] uppercase text-[10px] animate-pulse">{loaderText}</p>
        </div>
      )}

      {/* --- 通知系統 --- */}
      <div className="fixed bottom-8 right-8 z-[4000] flex flex-col gap-3">
        {toasts.map(t => (
          <div key={t.id} className={`px-6 py-4 rounded-xl shadow-2xl font-bold text-xs animate-in slide-in-from-right-4 flex items-center gap-4 border border-white/10 text-white backdrop-blur-xl ${t.type === "success" ? "bg-blue-600/90" : "bg-red-600/90"}`}>
            <span className="material-symbols-outlined text-lg">{t.type === 'success' ? 'done_all' : 'report'}</span>
            <span className="tracking-wider">{t.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}