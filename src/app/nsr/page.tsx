"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";

// 🚀 引入佈局與 UI 組件
import AdminSidebar from "@/components/layout/AdminSidebar";
import TopNavbar from "@/components/layout/TopNavbar";

// 🚀 引入後端 Server Actions
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
 * 狀態：V7.1 型別對沖修正版 (修復 setUnit 報錯)
 * 物理職責：
 * 1. 視覺中樞：還原呼吸背景、毛玻璃、超大圓角設計。
 * 2. 計價引擎：實作 115 年度階梯式合約計價。
 * 3. 數據管理：15 位單號自動對沖、姓名#分機自動化、物理刪除。
 * 4. 🚨 Bug 修復：修正申請單位欄位 onChange 導致的 setUnit 未定義錯誤。
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
  
  // --- 1. 數據矩陣狀態 ---
  const [globalNsrData, setGlobalNsrData] = useState<NsrRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loaderText, setLoaderText] = useState("對沖中...");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // --- 2. 錄入表單狀態 ---
  const [formData, setFormData] = useState({
    id: "", date: "", area: "A", floor: "", unit: "", 
    userWithExt: "", points: 1, type: "CAT 6", reason: ""
  });

  // --- 3. 業務操作狀態 ---
  const [settleItem, setSettleItem] = useState<NsrRecord | null>(null);
  const [isAddonWork, setIsAddonWork] = useState(false); // 加成施工
  const [usePanel, setUsePanel] = useState(false);      // 使用面板
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "error" | "info" }[]>([]);

  const showToast = useCallback((msg: string, type: "success" | "error" | "info" = "info") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // --- 4. 數據同步核心 ---
  const refreshData = useCallback(async () => {
    setIsLoading(true);
    setLoaderText("調研 115 數據矩陣...");
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
      showToast("雲端連線對沖失敗", "error");
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    const auth = sessionStorage.getItem("asset_link_admin_auth");
    if (!auth) { router.push("/"); return; }
    refreshData();
  }, [router, refreshData]);

  // --- 5. 業務邏輯對沖 ---
  const handleIdInput = (val: string) => {
    const id = val.toUpperCase();
    setFormData(prev => ({ ...prev, id }));
    if (id.startsWith("C01") && id.length === 15) {
      const parsedDate = `${id.substring(3, 7)}-${id.substring(7, 9)}-${id.substring(9, 11)}`;
      setFormData(prev => ({ ...prev, date: parsedDate }));
      showToast("單號對沖成功：已解析申請日期", "success");
    }
  };

  const handleNsrSubmit = async () => {
    if (!formData.id || !formData.unit || !formData.userWithExt) {
      return showToast("請完整填寫 15 位單號、單位與人員", "error");
    }
    if (!formData.userWithExt.includes("#")) {
      return showToast("格式偏差：人員欄位需包含 # (姓名#分機)", "error");
    }

    setIsLoading(true);
    setLoaderText("施工需求入庫中...");
    const [user, ext] = formData.userWithExt.split("#");
    
    try {
      await submitNsrData({
        form_id: formData.id, request_date: formData.date, area: formData.area,
        floor: formatFloor(formData.floor), dept_code: "N/A", unit: formData.unit,
        applicant: user, phone: ext, qty: formData.points, cable_type: formData.type,
        reason: formData.reason
      });
      showToast("✅ 錄入成功", "success");
      setFormData({ id: "", date: "", area: "A", floor: "", unit: "", userWithExt: "", points: 1, type: "CAT 6", reason: "" });
      refreshData();
    } catch {
      showToast("單號重複或連線異常", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportDispatch = async (item: NsrRecord) => {
    const content = `【ALink NSR 派工單】\n單號：${item.id}\n日期：${item.date}\n單位：${item.unit}\n地點：${item.area}棟 ${item.floor}F\n人員：${item.user} (#${item.ext})\n需求：${item.points} 點 (${item.type})\n事由：${item.reason}`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `ALink_Dispatch_${item.id}.txt`;
    link.click();
    
    await updateNsrStatus(item.id, "已派工");
    refreshData();
    showToast("派工單已輸出，狀態變更為已派工", "info");
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`⚠️ 警告：即將執行物理抹除單號 [${id}]\n此動作將使核銷紀錄永久消失，確定執行？`)) return;
    setIsLoading(true);
    try {
      await deleteNsrRecord(id);
      showToast("已從雲端數據庫物理刪除", "success");
      refreshData();
    } catch { showToast("刪除失敗", "error"); }
    finally { setIsLoading(false); }
  };

  const handleSettleCommit = async () => {
    if (!settleItem) return;
    setIsLoading(true);
    setLoaderText("執行 115 合約計價核銷...");
    try {
      await settleNsrRecord({
        form_id: settleItem.id,
        isAddon: isAddonWork,
        usePanel: usePanel,
        finishRemark: `核銷完成：${isAddonWork ? "加成施工 " : ""}${usePanel ? "+面板" : ""}`
      });
      showToast("✅ 核銷結算完成", "success");
      setSettleItem(null);
      refreshData();
    } catch { showToast("結算入庫失敗", "error"); }
    finally {
      setIsLoading(false);
    }
  };

  const pendingPool = globalNsrData.filter(r => ["未處理", "待處理", "已派工"].includes(r.status));
  const settlePool = globalNsrData.filter(r => r.status === "已完工");

  return (
    <div className="bg-[#f8fafc] min-h-screen font-sans text-slate-900 antialiased overflow-x-hidden relative">
      <style dangerouslySetInnerHTML={{ __html: `
        .glass-panel { background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(25px); border: 1px solid rgba(255, 255, 255, 0.8); box-shadow: 0 10px 40px -10px rgba(0,0,0,0.04); }
        .nsr-input { width: 100%; background: rgba(241, 245, 249, 0.6); border: none; border-radius: 1.25rem; padding: 16px 20px; font-weight: 700; font-size: 14px; transition: all 0.3s; }
        .nsr-input:focus { background: white; box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1); outline: none; }
        .saas-label { font-size: 11px; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px; display: block; margin-left: 6px; }
        .black-card { background: #0f172a; color: white; border-radius: 3rem; }
        .neon-text { text-shadow: 0 0 10px rgba(37, 99, 235, 0.2); }
      `}} />

      <div className="fixed z-0 blur-[120px] opacity-15 rounded-full pointer-events-none bg-blue-600 w-[700px] h-[700px] -top-64 -left-64 animate-pulse"></div>
      <div className="fixed z-0 blur-[120px] opacity-10 rounded-full pointer-events-none bg-emerald-400 w-[600px] h-[600px] bottom-0 right-0 animate-pulse delay-700"></div>

      <AdminSidebar currentRoute="/nsr" isOpen={isSidebarOpen} onLogout={() => router.push("/")} />

      <main className="lg:ml-64 min-h-screen flex flex-col p-6 lg:p-10 relative z-10">
        <TopNavbar title="NSR 網點需求與計價核銷中樞" onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 mt-10">
          <section className="lg:col-span-4 animate-in fade-in slide-in-from-left-6 duration-700">
            <div className="glass-panel p-10 rounded-[3rem] sticky top-10 border border-white">
                <h2 className="text-2xl font-black text-slate-800 mb-8 flex items-center gap-3">
                    <span className="material-symbols-outlined text-blue-600 text-3xl">edit_square</span> 錄入施工需求
                </h2>
                <div className="space-y-6">
                    <div>
                        <label className="saas-label" htmlFor="nsr-id-in">申請單號 (15位物理單號)</label>
                        <input id="nsr-id-in" title="申請單號" value={formData.id} onChange={e => handleIdInput(e.target.value)} placeholder="C01YYYYMMDDSSSS" className="nsr-input font-mono text-blue-600" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="saas-label" htmlFor="nsr-date-in">申請日期</label>
                            <input id="nsr-date-in" title="申請日期" type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="nsr-input text-xs" />
                        </div>
                        <div>
                            <label className="saas-label" htmlFor="nsr-area-sel">棟別</label>
                            <select id="nsr-area-sel" title="棟別選擇" value={formData.area} onChange={e => setFormData({...formData, area: e.target.value})} className="nsr-input">
                                {["A","B","C","D","E","G","H","I","K","T"].map(v => <option key={v} value={v}>{v} 棟</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="saas-label" htmlFor="nsr-floor-in">樓層</label>
                            <input id="nsr-floor-in" title="樓層" placeholder="05" value={formData.floor} onChange={e => setFormData({...formData, floor: e.target.value})} className="nsr-input" />
                        </div>
                        <div>
                            <label className="saas-label" htmlFor="nsr-unit-in">申請單位</label>
                            {/* 🚀 物理修復：將 setUnit 改為 setFormData 連動 */}
                            <input id="nsr-unit-in" title="申請單位" placeholder="請輸入單位名稱" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="nsr-input" />
                        </div>
                    </div>
                    <div>
                        <label className="saas-label !text-blue-600" htmlFor="nsr-user-in">申請人 (姓名#分機)</label>
                        <input id="nsr-user-in" title="申請人姓名與分機" placeholder="王大明#1234" value={formData.userWithExt} onChange={e => setFormData({...formData, userWithExt: e.target.value})} className="nsr-input" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="saas-label" htmlFor="nsr-points-in">需求點位</label>
                            <input id="nsr-points-in" title="需求點位" type="number" min={1} value={formData.points} onChange={e => setFormData({...formData, points: parseInt(e.target.value) || 1})} className="nsr-input" />
                        </div>
                        <div>
                            <label className="saas-label" htmlFor="nsr-type-sel">規格</label>
                            <select id="nsr-type-sel" title="規格選擇" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} className="nsr-input">
                                <option>CAT 6</option><option>CAT 6A</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="saas-label" htmlFor="nsr-reason-in">施工具體事由</label>
                        <textarea id="nsr-reason-in" title="施工事由" placeholder="請描述施工內容..." value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})} className="nsr-input min-h-[100px] resize-none py-4" />
                    </div>
                    <button onClick={handleNsrSubmit} className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black shadow-2xl hover:bg-blue-600 transition-all active:scale-95 uppercase tracking-widest text-sm">
                      存入 115 年度數據庫
                    </button>
                </div>
            </div>
          </section>

          <section className="lg:col-span-8 space-y-10 animate-in fade-in slide-in-from-right-6 duration-700">
            <div className="glass-panel p-10 rounded-[3rem]">
                <div className="flex justify-between items-center mb-8">
                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-3"><span className="material-symbols-outlined text-orange-500">pending_actions</span> 施工監控池</h3>
                    <span className="bg-slate-100 text-slate-500 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">目前待辦：{pendingPool.length} 案件</span>
                </div>
                {pendingPool.length === 0 ? (
                    <div className="py-20 text-center text-slate-300 italic font-bold">目前無施工中案件</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {pendingPool.map(item => (
                            <div key={item.id} className="bg-white/50 p-6 rounded-[2.5rem] border border-slate-100 hover:bg-white hover:shadow-xl transition-all relative group">
                                <button onClick={() => handleDelete(item.id)} title="物理刪除" className="absolute top-4 right-4 w-8 h-8 rounded-full bg-red-50 text-red-300 opacity-0 group-hover:opacity-100 hover:text-red-600 transition-all flex items-center justify-center"><span className="material-symbols-outlined text-sm">delete</span></button>
                                <div className="flex justify-between items-center mb-4">
                                    <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase ${item.status === '已派工' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>{item.status}</span>
                                    <span className="font-mono text-[10px] text-slate-300">#{item.id}</span>
                                </div>
                                <h4 className="font-black text-lg text-slate-800">{item.unit}</h4>
                                <p className="text-[11px] font-bold text-slate-400 mt-2 mb-6">{item.area}棟 {item.floor}F | {item.points}點 ({item.type})</p>
                                <div className="flex gap-2">
                                    <button onClick={() => handleExportDispatch(item)} title="匯出派工單" className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-black text-[10px] uppercase hover:bg-blue-50 hover:text-blue-600 transition-all flex items-center justify-center gap-2 shadow-sm">
                                        <span className="material-symbols-outlined text-sm">output</span> 派工
                                    </button>
                                    <button onClick={() => updateNsrStatus(item.id, "已完工").then(refreshData)} title="回報完工" className="flex-1 py-3 bg-slate-800 text-white rounded-xl font-black text-[10px] uppercase hover:bg-emerald-600 transition-all shadow-md">完工</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="glass-panel p-10 rounded-[3rem] border-t-[12px] border-t-emerald-500">
                <div className="flex justify-between items-center mb-8">
                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-3"><span className="material-symbols-outlined text-emerald-500">payments</span> 115 年度計價結算池</h3>
                </div>
                {settlePool.length === 0 ? (
                    <div className="py-12 text-center text-slate-300 italic font-bold">無待核銷案件</div>
                ) : (
                    <div className="space-y-4">
                        {settlePool.map(item => (
                            <div key={item.id} className="bg-emerald-50/40 p-8 rounded-[2.5rem] border border-emerald-100 flex justify-between items-center group hover:bg-white transition-all shadow-sm">
                                <div>
                                    <span className="font-black text-slate-800 text-xl tracking-tight">{item.unit}</span>
                                    <p className="text-[11px] font-bold text-emerald-600 mt-2">完工待結算 | {item.type} | {item.points} 點位</p>
                                </div>
                                <button onClick={() => { setSettleItem(item); setIsAddonWork(false); setUsePanel(false); }} title="執行計價核銷" className="px-10 py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-xs shadow-xl active:scale-95 hover:brightness-110 transition-all flex items-center gap-3">
                                    <span className="material-symbols-outlined">calculate</span> 執行算帳
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
          </section>
        </div>
      </main>

      {settleItem && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-950/85 backdrop-blur-xl animate-in zoom-in-95">
            <div className="bg-slate-900 w-full max-w-2xl rounded-[4rem] p-12 shadow-2xl relative overflow-hidden text-white border border-white/10">
                <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full -mr-40 -mt-40 animate-pulse"></div>
                <h2 className="text-4xl font-black tracking-tighter mb-4 neon-text">115 年度財務對沖</h2>
                <p className="text-slate-500 text-xs font-black uppercase tracking-[0.4em] mb-10 border-b border-slate-800 pb-8">核銷對象：{settleItem.id} / {settleItem.unit}</p>
                
                <div className="space-y-10 mb-12">
                    <div className="grid grid-cols-2 gap-10">
                        <div className="space-y-2">
                            <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest">合約基準規格</span>
                            <p className="text-2xl font-black text-blue-400">{settleItem.type}</p>
                        </div>
                        <div className="space-y-2 text-right">
                            <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest">物理點位總數</span>
                            <p className="text-2xl font-black text-white">{settleItem.points} 點</p>
                        </div>
                    </div>

                    <div className="space-y-6 bg-white/5 p-8 rounded-[2.5rem] border border-white/5">
                        <label className="flex items-center justify-between cursor-pointer group">
                            <div className="flex items-center gap-4">
                                <input id="addon-check" title="加成施工" type="checkbox" checked={isAddonWork} onChange={e => setIsAddonWork(e.target.checked)} className="w-6 h-6 rounded-lg border-slate-700 bg-slate-800 text-blue-500 focus:ring-blue-600" />
                                <span className="text-sm font-black text-slate-300 group-hover:text-white transition-colors">是否符合「加成施工」條件？</span>
                            </div>
                            <span className="text-[10px] font-black text-slate-500 uppercase">夜間/複雜</span>
                        </label>
                        <label className="flex items-center justify-between cursor-pointer group">
                            <div className="flex items-center gap-4">
                                <input id="panel-check" title="加購面板" type="checkbox" checked={usePanel} onChange={e => setUsePanel(e.target.checked)} className="w-6 h-6 rounded-lg border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-600" />
                                <span className="text-sm font-black text-slate-300 group-hover:text-white transition-colors">是否加購 ㄑ字型 24 埠 PANEL 空架？</span>
                            </div>
                            <span className="text-[10px] font-black text-emerald-500 uppercase">+$1,000</span>
                        </label>
                    </div>
                </div>

                <div className="text-center bg-white/5 p-12 rounded-[3rem] mb-12 border border-white/5 shadow-inner">
                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.6em] mb-4">本案對沖預算總額 (含稅)</p>
                    <p className="text-8xl font-black font-mono tracking-tighter text-white neon-text">
                        <span className="text-4xl mr-2 text-slate-500">$</span>
                        {calculateNsrPrice(settleItem.type, settleItem.points, isAddonWork, usePanel).toLocaleString()}
                    </p>
                </div>

                <div className="flex gap-6">
                    <button onClick={() => setSettleItem(null)} className="flex-1 py-6 rounded-[2rem] font-black text-slate-500 hover:text-white transition-all uppercase tracking-widest text-xs">取消核銷</button>
                    <button onClick={handleSettleCommit} className="flex-[2] py-6 bg-emerald-600 text-white rounded-[2.5rem] font-black shadow-2xl shadow-emerald-500/20 uppercase tracking-widest text-xs flex items-center justify-center gap-4 active:scale-95 hover:brightness-110 transition-all">
                        <span className="material-symbols-outlined font-black">fact_check</span> 確認結算並提交會計
                    </button>
                </div>
            </div>
        </div>
      )}

      {isLoading && (
        <div className="fixed inset-0 z-[3000] flex flex-col items-center justify-center bg-white/80 backdrop-blur-2xl">
          <div className="w-20 h-20 border-[8px] border-slate-100 border-t-blue-600 rounded-full animate-spin mb-8 shadow-2xl"></div>
          <p className="text-blue-600 font-black tracking-[0.5em] uppercase text-xs animate-pulse">{loaderText}</p>
        </div>
      )}

      <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[4000] flex flex-col gap-4 pointer-events-none w-full max-w-sm px-6">
        {toasts.map(t => (
          <div key={t.id} className={`px-10 py-6 rounded-[2.5rem] shadow-2xl font-black text-xs animate-in slide-in-from-bottom-4 flex items-center gap-5 border border-white/10 text-white backdrop-blur-xl ${t.type === "success" ? "bg-emerald-600/90" : t.type === "error" ? "bg-red-600/90" : "bg-slate-900/90"}`}>
            <span className="material-symbols-outlined text-2xl">{t.type === 'success' ? 'verified' : t.type === 'error' ? 'report' : 'info'}</span>
            <span className="tracking-[0.2em]">{t.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}