"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";

// 🚀 引入共用 UI 模組
import AdminSidebar from "@/components/layout/AdminSidebar";
import TopNavbar from "@/components/layout/TopNavbar";

// 🚀 引入後端 Server Actions 與邏輯引擎
import { getNsrList, submitNsrData, settleNsrRecord } from "@/lib/actions/nsr";
import { formatFloor } from "@/lib/logic/formatters";
import { calculateNsrPrice } from "@/lib/logic/pricing";

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
  desc: string; 
  total: number; 
  status: string; 
  source: string;
}

/**
 * ==========================================
 * 檔案：src/app/nsr/page.tsx
 * 狀態：V2.3 嚴格型別修復版 (解決 JSX 括號解析錯誤)
 * 物理職責：網點需求申請、115年度合約計價結算、派工單匯出
 * ==========================================
 */

export default function NsrAdminPage() {
  const router = useRouter();

  // --- 1. 核心數據狀態 ---
  const [globalNsrData, setGlobalNsrData] = useState<NsrRecord[]>([]);
  const [formData, setFormData] = useState<Partial<NsrRecord>>({
    id: "", date: "", area: "A", floor: "", deptCode: "", unit: "", user: "", ext: "", points: 1, type: "CAT 6A", desc: ""
  });

  // --- 2. UI 與交互狀態 ---
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loaderText, setLoaderText] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" | "info" } | null>(null);

  // 結算彈窗狀態
  const [isSettleOpen, setIsSettleOpen] = useState(false);
  const [settleItem, setSettleItem] = useState<NsrRecord | null>(null);
  const [settleConfig, setSettleConfig] = useState({ type: "normal", panel: "no", remark: "" });

  // --- 3. 物理工具函式 ---
  const showToast = useCallback((msg: string, type: "success" | "error" | "info" = "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const handleLogout = useCallback(() => {
    if (confirm("確定結束管理工作並安全登出？")) {
      sessionStorage.removeItem("asset_link_admin_auth");
      router.push("/");
    }
  }, [router]);

  // --- 4. 初始化與資料對沖 ---
  const initNsrHub = useCallback(async () => {
    setIsLoading(true);
    setLoaderText("同步 115 合約數據庫...");
    
    try {
      const data = await getNsrList();
      // 🚀 消除 no-explicit-any：以 Record<string, unknown> 接收，並直接對位後端的 UI 鍵值
      const mapped: NsrRecord[] = data.map((r: Record<string, unknown>) => ({
        id: String(r.id || ""), 
        date: String(r.date || ""), 
        area: String(r.area || ""), 
        floor: String(r.floor || ""), 
        deptCode: String(r.deptCode || ""),
        unit: String(r.unit || ""), 
        user: String(r.user || ""), 
        ext: String(r.ext || ""), 
        points: Number(r.points || 1), 
        type: String(r.type || "CAT 6"),
        desc: String(r.desc || ""), 
        total: Number(r.total || 0), 
        status: String(r.status || "未處理"), 
        source: String(r.source || "")
      }));
      setGlobalNsrData(mapped);
    } catch (err: unknown) {
      showToast("同步失敗：" + (err instanceof Error ? err.message : String(err)), "error");
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    const isAuth = sessionStorage.getItem("asset_link_admin_auth");
    if (!isAuth) { router.push("/"); return; }
    
    // 🚀 消除 set-state-in-effect：利用 Macrotask 佇列將同步渲染推遲，防止 React 級聯渲染
    let mounted = true;
    const timer = setTimeout(() => {
      if (mounted) initNsrHub();
    }, 0);
    
    return () => { 
      mounted = false; 
      clearTimeout(timer); 
    };
  }, [initNsrHub, router]);

  // --- 5. 業務動作邏輯 ---
  const handleIdInput = (val: string) => {
    const id = val.trim().toUpperCase();
    setFormData({ ...formData, id });
    if (id.startsWith("C01") && id.length >= 11) {
      const y = id.substring(3, 7);
      const m = id.substring(7, 9);
      const d = id.substring(9, 11);
      if (!isNaN(Number(y)) && !isNaN(Number(m)) && !isNaN(Number(d))) {
        setFormData(prev => ({ ...prev, date: `${y}-${m}-${d}` }));
      }
    }
  };

  const viewDetail = (id: string) => {
    const item = globalNsrData.find(r => r.id === id);
    if (item) {
      setFormData(item);
      showToast(`已載入案件：${id}`, "info");
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const submitNSR = async () => {
    if (!formData.id || !formData.unit || !String(formData.user || "").includes('#')) {
      return showToast("❌ 行政偏差：單號、單位為必填，申請人須為 姓名#分機 格式。", "error");
    }
    
    setIsLoading(true);
    setLoaderText("雲端數據落地中...");

    try {
      await submitNsrData({
        form_id: formData.id || "",
        request_date: formData.date || "",
        area: formData.area || "A",
        floor: formData.floor || "",
        dept_code: formData.deptCode || "",
        unit: formData.unit || "",
        applicant: formData.user || "",
        phone: formData.ext || "",
        qty: formData.points || 1,
        cable_type: formData.type || "CAT 6A",
        reason: formData.desc || "",
        source: "系統管理端錄入"
      });
      
      showToast("✅ 需求單提交成功", "success");
      setFormData({ id: "", date: "", area: "A", floor: "", deptCode: "", unit: "", user: "", ext: "", points: 1, type: "CAT 6A", desc: "" });
      initNsrHub();
    } catch (err: unknown) {
      showToast("提交失敗：" + (err instanceof Error ? err.message : String(err)), "error");
    } finally {
      setIsLoading(false);
    }
  };

  // --- 6. 結算與計價對沖引擎 ---
  const calculatedPrices = useMemo(() => {
    if (!settleItem) return { unit: 0, total: 0, tier: "---" };
    
    const qty = settleItem.points || 0;
    const isAddon = settleConfig.type === "addon";
    const usePanel = settleConfig.panel === "yes";
    const cable = (settleItem.type === "CAT 6A" || settleItem.type === "CAT 6") ? settleItem.type : "CAT 6";

    // 呼叫 src/lib/logic/pricing.ts 的核心演算法
    const total = calculateNsrPrice(cable, qty, isAddon, usePanel);
    
    let tier = '1-4';
    if (qty >= 9) tier = '9+'; else if (qty >= 5) tier = '5-8';

    // 反推單價 (僅供顯示用)
    const unitPrice = usePanel ? (total - 1000) / qty : total / qty;

    return { unit: unitPrice, total, tier };
  }, [settleItem, settleConfig]);

  const confirmSettle = async () => {
    if (!settleItem) return;
    setIsLoading(true);
    setLoaderText("執行物理結案遷移...");

    try {
      await settleNsrRecord({
        form_id: settleItem.id,
        isAddon: settleConfig.type === "addon",
        usePanel: settleConfig.panel === "yes",
        finishRemark: settleConfig.remark
      });

      showToast("✅ 結案核銷成功！", "success");
      setIsSettleOpen(false);
      initNsrHub();
    } catch (err: unknown) {
      showToast("結案失敗：" + (err instanceof Error ? err.message : String(err)), "error");
    } finally {
      setIsLoading(false);
    }
  };

  const exportAssignment = () => {
    const pending = globalNsrData.filter(r => ["未處理","退回修正",""].includes(r.status));
    if (!pending.length) return showToast("目前無待處理案件", "error");
    let txt = `===== 網點施工派工單 (V0.0) =====\n生成時間：${new Date().toLocaleString()}\n\n`;
    pending.forEach((r, i) => {
        txt += `[${i+1}] 申請單號：${r.id}\n位置：${r.area}棟 ${r.floor}\n單位：${r.unit}\n申請人：${r.user}\n規格：${r.points}點 (${r.type})\n事由：${r.desc}\n----------------------------------\n\n`;
    });
    const blob = new Blob([txt], { type: 'text/plain' });
    const a = document.createElement('a'); 
    a.href = URL.createObjectURL(blob); 
    a.download = `NSR_DISPATCH_ORDER_${Date.now()}.txt`; 
    a.click();
  };

  return (
    <div className="bg-[#f8fafc] text-[#1d1d1f] font-[family-name:-apple-system,BlinkMacSystemFont,system-ui,sans-serif] text-[10.5px] antialiased tracking-[-0.015em] min-h-screen">
      <style dangerouslySetInnerHTML={{ __html: `
        .glass-card { background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(25px) saturate(200%); -webkit-backdrop-filter: blur(25px) saturate(200%); border: 1px solid rgba(255, 255, 255, 0.5); border-radius: 24px; box-shadow: 0 4px 25px rgba(0, 0, 0, 0.02); }
        .nsr-input { background: rgba(255, 255, 255, 0.5); border: 0.5px solid rgba(0, 0, 0, 0.1); border-radius: 14px; padding: 12px 16px; width: 100%; font-weight: 600; outline: none; transition: all 0.2s; }
        .nsr-input:focus { background: white; border-color: #007aff; box-shadow: 0 0 0 4px rgba(0, 122, 255, 0.1); }
      `}} />

      {/* 🚀 模組化側邊欄 */}
      <AdminSidebar currentRoute="/nsr" isOpen={isSidebarOpen} onLogout={handleLogout} />

      <main className="lg:ml-64 flex flex-col p-6 lg:p-10 min-h-screen">
        
        {/* 🚀 模組化頂部導覽列 */}
        <TopNavbar 
          title="網點需求管理中樞" 
          subtitle="115年度網點施工排程與計價"
          onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          showSearch={false}
        />

        <div className="flex flex-col lg:flex-row gap-8 w-full max-w-[1440px] mx-auto fade-enter">
          {/* 🧱 軌道 1：施工需求錄入 */}
          <div className="w-full lg:w-5/12 shrink-0">
            <section className="glass-card p-6 sm:p-8 space-y-6 border-l-[8px] border-l-slate-900">
              <h2 className="font-black text-slate-800 text-sm flex items-center gap-2 uppercase tracking-widest border-b pb-4"><span className="material-symbols-outlined text-blue-600">assignment_add</span> 需求申請錄入</h2>
              <form onSubmit={e => { e.preventDefault(); submitNSR(); }} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5 relative col-span-2 sm:col-span-1">
                        <label htmlFor="nsr-id" className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">申請單號 (A)</label>
                        <input id="nsr-id" title="申請單號" value={formData.id} onChange={e => handleIdInput(e.target.value)} className="nsr-input font-mono font-black uppercase tracking-wider shadow-inner" placeholder="C01-2026-0001" maxLength={15} type="text"/>
                    </div>
                    <div className="space-y-1.5 relative col-span-2 sm:col-span-1">
                        <label htmlFor="nsr-date" className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">申請日期 (B)</label>
                        <input id="nsr-date" title="申請日期" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="nsr-input font-bold text-slate-700" type="date"/>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5 relative">
                        <label htmlFor="nsr-area" className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">區域 (C)</label>
                        <select id="nsr-area" title="區域" value={formData.area} onChange={e => setFormData({...formData, area: e.target.value})} className="nsr-input font-bold text-slate-700">
                            {["A","B","C","D","E","G","H","I","K","T"].map(v => <option key={v} value={v}>{v} 棟</option>)}
                        </select>
                    </div>
                    <div className="space-y-1.5 relative">
                        <label htmlFor="nsr-floor" className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">樓層 (D)</label>
                        <input id="nsr-floor" title="樓層" value={formData.floor} onChange={e => setFormData({...formData, floor: e.target.value})} onBlur={e => setFormData({...formData, floor: formatFloor(e.target.value)})} className="nsr-input font-bold text-slate-700" placeholder="例如: 05" type="text"/>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5 relative col-span-2 sm:col-span-1">
                        <label htmlFor="nsr-dept" className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">部門代碼 (E)</label>
                        <input id="nsr-dept" title="部門代碼" value={formData.deptCode} onChange={e => setFormData({...formData, deptCode: e.target.value})} className="nsr-input font-bold text-slate-700" placeholder="例如: 7020" type="text"/>
                    </div>
                    <div className="space-y-1.5 relative col-span-2 sm:col-span-1">
                        <label htmlFor="nsr-unit" className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">申請單位 (F)</label>
                        <input id="nsr-unit" title="申請單位" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="nsr-input font-bold text-slate-800" placeholder="請輸入完整行政單位" type="text"/>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5 relative col-span-2 sm:col-span-1">
                        <label htmlFor="nsr-user" className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">申請人#分機 (G)</label>
                        <input id="nsr-user" title="申請人與分機" value={formData.user} onChange={e => setFormData({...formData, user: e.target.value})} className="nsr-input font-bold text-blue-800" placeholder="姓名#分機" type="text"/>
                    </div>
                    <div className="space-y-1.5 relative col-span-2 sm:col-span-1">
                        <label htmlFor="nsr-phone" className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">連絡電話 (H)</label>
                        <input id="nsr-phone" title="連絡電話" value={formData.ext} onChange={e => setFormData({...formData, ext: e.target.value})} className="nsr-input font-bold text-slate-700" placeholder="行動電話或市話" type="text"/>
                    </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50/60 rounded-2xl border border-slate-200 shadow-inner">
                    <div className="space-y-1.5 relative">
                        <label htmlFor="nsr-qty" className="text-[11px] font-bold text-blue-600 uppercase tracking-wider ml-1">需求數量 (I)</label>
                        <input id="nsr-qty" title="需求數量" value={formData.points} onChange={e => setFormData({...formData, points: Number(e.target.value)})} className="nsr-input text-base font-black text-center shadow-sm" placeholder="點位數" type="number" min="1"/>
                    </div>
                    <div className="space-y-1.5 relative">
                        <label htmlFor="nsr-cable" className="text-[11px] font-bold text-blue-600 uppercase tracking-wider ml-1">線材規格 (J)</label>
                        <select id="nsr-cable" title="線材規格" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} className="nsr-input text-sm font-black shadow-sm text-slate-700">
                            <option value="CAT 6A">CAT 6A</option>
                            <option value="CAT 6">CAT 6</option>
                        </select>
                    </div>
                </div>

                <div className="space-y-1.5 relative">
                    <label htmlFor="nsr-reason" className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">事由說明 (K)</label>
                    <textarea id="nsr-reason" title="事由說明" value={formData.desc} onChange={e => setFormData({...formData, desc: e.target.value})} className="nsr-input font-bold text-slate-700" placeholder="請詳述施工需求與原因..." rows={3}></textarea>
                </div>
                
                <button type="submit" className="w-full py-4 bg-gradient-to-r from-primary to-blue-500 text-white rounded-xl font-bold shadow-lg shadow-blue-200 hover:shadow-xl active:scale-95 transition-all">
                    提交雲端存檔
                </button>
              </form>
            </section>
          </div>

          {/* 🧱 軌道 2：行政處理池 */}
          <div className="w-full lg:w-7/12 flex flex-col gap-8">
            {/* 待辦施工案件池 */}
            <div className="glass-card rounded-[24px] p-6 shadow-lg overflow-hidden border-l-4 border-l-secondary-fixed">
                <div className="flex justify-between items-end mb-6">
                    <div>
                        <div className="flex items-center gap-2 text-secondary font-bold text-xs uppercase tracking-widest mb-1">
                            <span className="material-symbols-outlined text-sm">pending_actions</span>
                            待辦施工案件池
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight">未處理與施工中</h3>
                    </div>
                    <div className="flex gap-2 items-center">
                        <button onClick={exportAssignment} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-full text-xs font-bold hover:bg-blue-50 hover:text-blue-600 transition-colors shadow-sm flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">download</span> 派工單
                        </button>
                        <span className="px-3 py-1.5 bg-secondary/10 text-secondary rounded-full text-xs font-bold">{globalNsrData.filter(r => ["未處理", "待處理", "", "退回修正"].includes(r.status)).length} 待處理</span>
                    </div>
                </div>
                
                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2">
                    {globalNsrData.filter(r => ["未處理", "待處理", "", "退回修正"].includes(r.status)).map(r => (
                        <div key={r.id} onClick={() => viewDetail(r.id)} className="group bg-white/60 hover:bg-white/90 p-4 rounded-2xl border border-white/80 transition-all cursor-pointer flex items-center justify-between shadow-sm">
                            <div className="flex items-center gap-4 overflow-hidden">
                                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex flex-col items-center justify-center shrink-0">
                                    <span className="material-symbols-outlined">assignment</span>
                                </div>
                                <div className="overflow-hidden">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="text-sm font-black text-slate-900 font-mono">{r.id}</span>
                                        <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-widest ${r.status.includes('退回') ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>{r.status || '新申請'}</span>
                                    </div>
                                    <p className="text-[11px] font-bold text-slate-500 truncate">{r.area}棟 {r.floor} - {r.unit} <span className="font-black text-blue-600 ml-1">({r.points} 點位)</span></p>
                                </div>
                            </div>
                            <button className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shrink-0">
                                <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                            </button>
                        </div>
                    ))}
                    {globalNsrData.filter(r => ["未處理", "待處理", "", "退回修正"].includes(r.status)).length === 0 && (
                        <div className="text-center py-10 opacity-50 font-black tracking-widest uppercase">目前無待辦案件</div>
                    )}
                </div>
                <p className="text-[10px] font-bold text-slate-400 mt-4 text-center tracking-widest uppercase">※ 點擊卡片將自動回填至左側表單供檢視修改</p>
            </div>

            {/* 完工結算核銷池 */}
            <div className="glass-card rounded-[24px] p-6 shadow-lg border-l-4 border-l-primary overflow-hidden">
                <div className="flex justify-between items-end mb-6">
                    <div>
                        <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-widest mb-1">
                            <span className="material-symbols-outlined text-sm">task_alt</span>
                            Settlement Pool
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight">完工結算核銷池</h3>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">待核銷筆數</p>
                        <p className="text-xl font-black text-primary font-mono">{globalNsrData.filter(r => r.status === "已核定").length}</p>
                    </div>
                </div>
                
                <div className="overflow-x-auto bg-white/50 rounded-xl border border-slate-200">
                    <table className="w-full text-left whitespace-nowrap">
                        <thead>
                            <tr className="text-[11px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-200 bg-slate-50/80">
                                <th className="py-3 px-5 rounded-tl-xl">申請單號</th>
                                <th className="py-3 px-4">單位名稱</th>
                                <th className="py-3 px-4 text-center">數量/規格</th>
                                <th className="py-3 px-5 text-right rounded-tr-xl">操作</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-slate-100">
                            {globalNsrData.filter(r => r.status === "已核定").map(r => (
                                <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                                    <td className="py-4 px-5 font-black text-slate-700 text-xs font-mono">{r.id}</td>
                                    <td className="py-4 px-4 font-bold text-slate-600 text-xs truncate max-w-[120px]">{r.unit}</td>
                                    <td className="py-4 px-4 text-center">
                                        <span className="text-sm font-black text-slate-800">{r.points}</span><span className="text-[9px] font-bold text-slate-400 ml-1 uppercase">Pts</span>
                                        <div className="text-[10px] text-primary font-black mt-0.5">{r.type}</div>
                                    </td>
                                    <td className="py-4 px-5 text-right">
                                        <button onClick={() => { setSettleItem(r); setIsSettleOpen(true); }} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-md active:scale-95">執行結算</button>
                                    </td>
                                </tr>
                            ))}
                            {globalNsrData.filter(r => r.status === "已核定").length === 0 && (
                                <tr><td colSpan={4} className="py-10 text-center opacity-50 font-black tracking-widest uppercase">目前無待結算項目</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
          </div>
        </div>
      </main>

      {/* 🚀 結案計價彈窗 (115 合約) */}
      {isSettleOpen && settleItem && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 fade-enter">
          <div className="glass-card w-full max-w-2xl rounded-[32px] p-8 sm:p-10 shadow-2xl relative bg-white/95 border-t-[8px] border-t-emerald-500">
            <button onClick={() => setIsSettleOpen(false)} className="absolute top-6 right-6 w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors">
                <span className="material-symbols-outlined text-slate-400">close</span>
            </button>
            
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shadow-inner border border-emerald-100"><span className="material-symbols-outlined text-[28px]">calculate</span></div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">115 合約階梯結案</h2>
                </div>
                <p className="text-xs font-bold text-slate-500 mt-2">根據 NSR 施工點位數量，自動調用 Server Actions 執行合約階梯對沖。</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div className="space-y-5">
                    <div className="relative">
                        <label htmlFor="cfg-type" className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">案件施工性質</label>
                        <select id="cfg-type" title="施工性質" value={settleConfig.type} onChange={e => setSettleConfig({...settleConfig, type: e.target.value})} className="w-full bg-white/60 border border-slate-200 rounded-xl text-sm font-bold px-4 py-3 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none shadow-sm text-slate-700">
                            <option value="normal">一般施工 (合約基準)</option>
                            <option value="addon">加成施工 (複雜/緊急)</option>
                        </select>
                    </div>
                    <div className="relative">
                        <label htmlFor="cfg-panel" className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">面板採購選項</label>
                        <select id="cfg-panel" title="面板採購" value={settleConfig.panel} onChange={e => setSettleConfig({...settleConfig, panel: e.target.value})} className="w-full bg-white/60 border border-slate-200 rounded-xl text-sm font-bold px-4 py-3 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none shadow-sm text-slate-700">
                            <option value="no">無須加購面板</option>
                            <option value="yes">加購面板 (+$1,000)</option>
                        </select>
                    </div>
                    <div className="relative">
                        <label htmlFor="cfg-remark" className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">完工行政備註 (O)</label>
                        <textarea id="cfg-remark" title="完工備註" value={settleConfig.remark} onChange={e => setSettleConfig({...settleConfig, remark: e.target.value})} rows={2} className="w-full bg-white/60 border border-slate-200 rounded-xl text-sm font-bold px-4 py-3 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none shadow-sm text-slate-700" placeholder="請填寫完工描述或行政例外說明..."></textarea>
                    </div>
                </div>

                {/* 計價結果面板 */}
                <div className="bg-slate-900 p-6 rounded-[1.5rem] border border-slate-800 flex flex-col justify-between text-white shadow-xl">
                    <div>
                        <p className="text-[10px] font-black text-emerald-400 uppercase mb-3 tracking-widest">本次試算對象: <span className="text-white ml-1 font-mono">{settleItem.id}</span></p>
                        <div className="space-y-3 mt-4">
                            <div className="flex justify-between items-center text-sm border-b border-white/10 pb-2">
                                <span className="text-slate-400 font-bold text-[11px]">施工總點位:</span>
                                <span className="font-black text-white"><span className="text-xl mr-1">{settleItem.points}</span> 點</span>
                            </div>
                            <div className="flex justify-between items-center text-sm border-b border-white/10 pb-2">
                                <span className="text-slate-400 font-bold text-[11px]">適用階梯:</span>
                                <span className="font-bold text-emerald-300 text-[11px] uppercase tracking-wider">{settleItem.type} | Tier: {calculatedPrices.tier}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm pt-1">
                                <span className="text-slate-400 font-bold text-[11px]">核定單價 (參考):</span>
                                <span className="font-bold text-white font-mono">$ {calculatedPrices.unit.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="pt-4 mt-4 border-t border-emerald-500/30">
                        <p className="text-[10px] font-black text-emerald-500 mb-1 uppercase tracking-widest">核銷總額 (L)</p>
                        <p className="text-4xl font-black text-white font-mono tracking-tight leading-none">$ {calculatedPrices.total.toLocaleString()}</p>
                    </div>
                </div>
            </div>
            
            <div className="flex gap-4">
                <button onClick={() => setIsSettleOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-700 rounded-xl font-black hover:bg-slate-200 transition-all text-xs uppercase tracking-widest">取消</button>
                <button onClick={confirmSettle} className="flex-[2] py-4 bg-emerald-600 text-white rounded-xl font-black shadow-lg shadow-emerald-600/20 active:scale-95 transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">fact_check</span> 確認結算並物理入庫
                </button>
            </div>
          </div>
        </div>
      )}

      {/* 強同步遮罩 */}
      {isLoading && (
        <div className="fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-white/80 backdrop-blur-xl">
           <div className="w-12 h-12 border-4 border-primary-fixed border-t-primary rounded-full animate-spin mb-4 shadow-lg"></div>
           <p className="text-[11px] font-black text-primary uppercase tracking-widest">{loaderText}</p>
        </div>
      )}

      {/* 通知氣泡 */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[1100] flex flex-col gap-3 pointer-events-none w-full max-w-[320px] px-5">
        {toast && (
          <div className={`px-6 py-4 rounded-3xl shadow-2xl font-black text-[11px] animate-bounce flex items-center gap-3 border border-white/20 pointer-events-auto text-white ${toast.type === "success" ? "bg-emerald-600" : toast.type === "info" ? "bg-slate-900" : "bg-error"}`}>
            <span className="material-symbols-outlined text-base">{toast.type === "success" ? "check_circle" : toast.type === "info" ? "info" : "error"}</span>
            <span>{toast.msg}</span>
          </div>
        )}
      </div>
    </div>
  );
}