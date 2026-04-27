"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";

// 🚀 引入共用佈局模組 (物理修正：屬性對稱)
import AdminSidebar from "@/components/layout/AdminSidebar";
import TopNavbar from "@/components/layout/TopNavbar";

// 🚀 引入後端 Server Actions
// 註：若 updateNsrStatus 報錯，建議於 nsr.ts 補齊匯出，目前採物理防護處理
import { getNsrList, submitNsrData, settleNsrRecord } from "@/lib/actions/nsr";
import { formatFloor } from "@/lib/logic/formatters";

/**
 * 🚀 115 年度物理計價引擎 (內部私有，修復 Vercel Build Error)
 * 物理職責：實作 115~118 合約年度之「階梯式點位計價矩陣」。
 */
function calculateNsrPrice(
  spec: "CAT 6" | "CAT 6A",
  points: number,
  isAddon: boolean,
  hasPanel: boolean
): number {
  let unitPrice = 0;
  const tierIndex = points >= 9 ? 2 : (points >= 5 ? 1 : 0);
  
  const pricingMatrix = {
    CAT6: {
      standard: [3600, 3500, 3400],
      addon: [4800, 4700, 4500]
    },
    CAT6A: {
      standard: [4400, 4300, 4200],
      addon: [6000, 5800, 5600]
    }
  };

  if (spec === "CAT 6A") {
    unitPrice = isAddon ? pricingMatrix.CAT6A.addon[tierIndex] : pricingMatrix.CAT6A.standard[tierIndex];
  } else {
    unitPrice = isAddon ? pricingMatrix.CAT6.addon[tierIndex] : pricingMatrix.CAT6.standard[tierIndex];
  }

  return (unitPrice * points) + (hasPanel ? 1000 : 0);
}

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
 * 狀態：V4.1 物理修正終極體 (修復 TS2305, TS2345, TS2353, TS2741)
 * 物理職責：
 * 1. 15位單號對沖：C01 + YYYYMMDD + SSSS。
 * 2. 解決匯出錯誤：計價函數內部化。
 * 3. 解決型別報警：補齊 dept_code 與 finishRemark。
 * 4. 無障礙標準：符合 axe/forms 物理關聯。
 * ==========================================
 */

export default function NsrAdminPage() {
  const router = useRouter();

  // --- 核心數據狀態 ---
  const [globalNsrData, setGlobalNsrData] = useState<NsrRecord[]>([]);
  const [formData, setFormData] = useState<Partial<NsrRecord>>({
    id: "", date: "", area: "A", floor: "", deptCode: "", unit: "", user: "", ext: "", points: 1, type: "CAT 6", desc: ""
  });

  // --- UI 與交互狀態 ---
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loaderText, setLoaderText] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" | "info" } | null>(null);

  // 結算 Modal 狀態
  const [isSettleOpen, setIsSettleOpen] = useState(false);
  const [settleItem, setSettleItem] = useState<NsrRecord | null>(null);
  const [settleConfig, setSettleConfig] = useState({ isAddon: false, usePanel: false, remark: "" });

  const showToast = useCallback((msg: string, type: "success" | "error" | "info" = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    setLoaderText("對接 115 合約雲端資料庫...");
    try {
      const data = await getNsrList();
      setGlobalNsrData(data as NsrRecord[]);
    } catch (err: unknown) {
      showToast("連線同步失敗", "error");
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    const auth = sessionStorage.getItem("asset_link_admin_auth");
    if (auth !== "true") { router.push("/"); return; }
    refreshData();
  }, [router, refreshData]);

  /**
   * 🚀 物理對沖：15位單號自動解碼日期 (C01YYYYMMDDSSSS)
   */
  const handleIdInput = (val: string) => {
    const id = val.toUpperCase();
    setFormData({ ...formData, id });
    if (id.startsWith("C01") && id.length === 15) {
      const y = id.substring(3, 7);
      const m = id.substring(7, 9);
      const d = id.substring(9, 11);
      setFormData(prev => ({ ...prev, date: `${y}-${m}-${d}` }));
      showToast("單號偵測成功：已物理擷取申請日期", "info");
    }
  };

  /**
   * 🚀 需求錄入 (修復 TS2345：補齊 dept_code)
   */
  const submitNSR = async () => {
    if (!formData.id || !formData.unit) return showToast("單號與單位必填", "error");
    setIsLoading(true);
    setLoaderText("需求數據物理封裝中...");
    try {
      await submitNsrData({
        form_id: formData.id,
        request_date: formData.date || "",
        area: formData.area || "A",
        floor: formatFloor(formData.floor || ""),
        dept_code: formData.deptCode || "N/A", // 🚀 物理補齊必填欄位
        unit: formData.unit,
        applicant: formData.user || "",
        phone: formData.ext || "",
        qty: formData.points || 1,
        cable_type: formData.type || "CAT 6",
        reason: formData.desc || ""
      });
      showToast("錄入成功", "success");
      setFormData({ id: "", date: "", area: "A", floor: "", deptCode: "", unit: "", user: "", ext: "", points: 1, type: "CAT 6", desc: "" });
      refreshData();
    } catch (e: unknown) { showToast("提交異常", "error"); } finally { setIsLoading(false); }
  };

  /**
   * 🚀 派工輸出 (修復 TS2305：移除未匯出之 updateNsrStatus 呼叫)
   */
  const handleDispatch = async (item: NsrRecord) => {
    const content = `【Asset-Link 派工單】\n單號：${item.id}\n單位：${item.unit}\n地點：${item.area}棟 ${item.floor}F\n點位：${item.points} (${item.type})\n需求：${item.desc}`;
    const blob = new Blob([content], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Dispatch_${item.id}.txt`;
    a.click();
    
    // 註：若需更新狀態，請在 lib/actions/nsr.ts 匯出 updateNsrStatus 函數後再恢復呼叫
    showToast("已匯出派工單檔案", "success");
  };

  /**
   * 🚀 115 合約計價預覽 (修復 TS2345：類型對沖)
   */
  const previewTotal = useMemo(() => {
    if (!settleItem) return 0;
    return calculateNsrPrice(
        settleItem.type as "CAT 6" | "CAT 6A", 
        settleItem.points, 
        settleConfig.isAddon, 
        settleConfig.usePanel
    );
  }, [settleItem, settleConfig]);

  /**
   * 🚀 執行完工結算 (修復 TS2345：補齊 finishRemark 並移除 status)
   */
  const confirmSettleAction = async () => {
    if (!settleItem) return;
    setIsLoading(true);
    setLoaderText("執行財務對沖與核銷...");
    try {
      await settleNsrRecord({
        form_id: settleItem.id,
        isAddon: settleConfig.isAddon,
        usePanel: settleConfig.usePanel,
        finishRemark: settleConfig.remark || "無備註" // 🚀 物理補齊必填之屬性
      });
      showToast(`結算成功：$${previewTotal.toLocaleString()}，已進入待請款`, "success");
      setIsSettleOpen(false);
      refreshData();
    } catch (e) { showToast("結算處理失敗", "error"); } finally { setIsLoading(false); }
  };

  const pendingPool = globalNsrData.filter(r => ["未處理", "待處理", "已派工"].includes(r.status));
  const finishPool = globalNsrData.filter(r => r.status === "已完工" || (r.status === "已派工" && !r.total));

  return (
    <div className="bg-[#f0f4f8] min-h-screen text-[#1d1d1f] font-sans antialiased overflow-x-hidden">
      {/* 🚀 物理修正：使用正確屬性 currentRoute */}
      <AdminSidebar currentRoute="/nsr" isOpen={isSidebarOpen} onLogout={() => router.push("/")} />

      <main className="lg:ml-64 p-6 lg:p-10 flex flex-col gap-8">
        {/* 🚀 物理修正：補齊必填之 onMenuToggle */}
        <TopNavbar 
            title="NSR 需求管理與計價核銷中樞" 
            onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)} 
        />

        <div className="grid grid-cols-12 gap-8 max-w-[1440px] mx-auto w-full">
          
          {/* 左軌：錄入區 */}
          <div className="col-span-12 lg:col-span-4">
            <section className="bg-white rounded-[2.5rem] p-8 shadow-2xl shadow-slate-200/50 border border-white sticky top-10">
                <div className="flex items-center gap-3 mb-8 border-b pb-4">
                    <span className="material-symbols-outlined text-blue-600 text-3xl">post_add</span>
                    <h2 className="text-xl font-black text-slate-800 tracking-tight">錄入施工需求</h2>
                </div>
                
                <div className="space-y-6">
                    {/* 🚀 物理修正：axe/forms - 加入 id 與 label 物理關聯 */}
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1 block mb-2 tracking-widest" htmlFor="nsr-id-input">申請單號 (15位物理格式)</label>
                        <input id="nsr-id-input" value={formData.id} onChange={e => handleIdInput(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 font-mono font-black text-blue-700 focus:ring-2 focus:ring-blue-600 outline-none transition-all" placeholder="C01YYYYMMDDSSSS" maxLength={15} title="15位申請單號" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 ml-1 block" htmlFor="nsr-date-input">申請日期</label>
                            <input id="nsr-date-input" type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3.5 font-bold text-sm" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 ml-1 block" htmlFor="nsr-area-select">院區</label>
                            <select id="nsr-area-select" title="選擇院區" value={formData.area} onChange={e => setFormData({...formData, area: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3.5 font-bold">
                                {["A","B","C","D","E","G","H","I","K","T"].map(v => <option key={v} value={v}>{v} 棟</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 ml-1 block" htmlFor="nsr-floor-input">樓層</label>
                            <input id="nsr-floor-input" value={formData.floor} onChange={e => setFormData({...formData, floor: e.target.value})} onBlur={e => setFormData({...formData, floor: formatFloor(e.target.value)})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3.5 font-bold" placeholder="05" title="所在樓層" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 ml-1 block" htmlFor="nsr-pts-input">點位數量</label>
                            <input id="nsr-pts-input" type="number" value={formData.points} onChange={e => setFormData({...formData, points: parseInt(e.target.value)})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3.5 font-black text-center" min={1} title="施工點位數量" />
                        </div>
                    </div>
                    <div className="p-5 bg-blue-50/50 rounded-3xl border border-blue-100">
                        <label className="text-[10px] font-black text-blue-600 ml-1 block mb-3 uppercase tracking-widest">合約規格對沖</label>
                        <div className="flex gap-3">
                            <button type="button" onClick={() => setFormData({...formData, type: "CAT 6"})} className={`flex-1 py-3.5 rounded-xl font-black text-xs transition-all ${formData.type === 'CAT 6' ? 'bg-white shadow-lg text-blue-600' : 'text-slate-400'}`}>CAT 6</button>
                            <button type="button" onClick={() => setFormData({...formData, type: "CAT 6A"})} className={`flex-1 py-3.5 rounded-xl font-black text-xs transition-all ${formData.type === 'CAT 6A' ? 'bg-white shadow-lg text-blue-600' : 'text-slate-400'}`}>CAT 6A</button>
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 ml-1 block mb-2 uppercase tracking-widest" htmlFor="nsr-dept-input">部門代碼</label>
                        <input id="nsr-dept-input" value={formData.deptCode} onChange={e => setFormData({...formData, deptCode: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 font-bold mb-3" placeholder="例如：1N12" title="部門代碼" />
                        
                        <label className="text-[10px] font-black text-slate-400 ml-1 block mb-2 uppercase tracking-widest" htmlFor="nsr-unit-input">單位人員資訊</label>
                        <input id="nsr-unit-input" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 font-bold mb-3" placeholder="使用單位名稱" title="使用單位名稱" />
                        <input id="nsr-user-input" value={formData.user} onChange={e => setFormData({...formData, user: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 font-bold" placeholder="姓名#分機" title="申請人員" />
                    </div>
                    <button type="button" onClick={submitNSR} className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black shadow-2xl hover:bg-blue-900 transition-all uppercase tracking-widest">存入 115 數據庫</button>
                </div>
            </section>
          </div>

          {/* 右軌：監控池 */}
          <div className="col-span-12 lg:col-span-8 space-y-8">
            <section className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/40">
                <div className="flex justify-between items-center mb-8 pb-4 border-b">
                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-3"><span className="material-symbols-outlined text-orange-500">pending_actions</span> 施工監控池</h3>
                    <span className="bg-orange-50 text-orange-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">{pendingPool.length} 案件施工中</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-h-[450px] overflow-y-auto pr-3 custom-scrollbar">
                    {pendingPool.map(item => (
                        <div key={item.id} className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 hover:bg-white hover:shadow-xl transition-all group relative overflow-hidden">
                            <div className="flex justify-between mb-4 relative z-10">
                                <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${item.status === '已派工' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-slate-200 text-slate-500'}`}>{item.status}</span>
                                <span className="font-mono text-[10px] font-black text-slate-300">{item.id}</span>
                            </div>
                            <h4 className="font-black text-base text-slate-800 mb-1 relative z-10">{item.unit}</h4>
                            <p className="text-[11px] font-bold text-slate-400 mb-5 relative z-10">{item.area}棟 {item.floor}F | {item.points}點 ({item.type})</p>
                            <div className="flex gap-2 relative z-10">
                                <button type="button" onClick={() => handleDispatch(item)} className="flex-1 py-3 bg-white border border-slate-200 rounded-2xl font-black text-[10px] hover:text-blue-600 transition-all flex items-center justify-center gap-2 shadow-sm"><span className="material-symbols-outlined text-base">download_for_offline</span> 派工單</button>
                                <button type="button" onClick={() => { setSettleItem(item); setIsSettleOpen(true); }} className="flex-1 py-3 bg-slate-800 text-white rounded-2xl font-black text-[10px] hover:bg-emerald-600 transition-all shadow-md">廠商完工</button>
                            </div>
                            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -mr-10 -mt-10 group-hover:scale-150 transition-transform duration-500"></div>
                        </div>
                    ))}
                </div>
            </section>

            <section className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/40 border-t-[10px] border-t-emerald-500">
                <div className="flex justify-between items-center mb-10">
                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-3"><span className="material-symbols-outlined text-emerald-600 text-3xl">payments</span> 115 完工計價結算池</h3>
                    <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">等待結算筆數</p>
                        <p className="text-4xl font-black text-emerald-600 font-mono tracking-tighter leading-none">{finishPool.length}</p>
                    </div>
                </div>
                <div className="space-y-4">
                    {finishPool.length === 0 ? (
                        <div className="py-16 text-center text-slate-300 font-black italic uppercase tracking-widest text-xs opacity-50">目前無待算帳案件</div>
                    ) : (
                        finishPool.map(item => (
                            <div key={item.id} className="bg-emerald-50/30 p-8 rounded-[2.5rem] border border-emerald-100 flex justify-between items-center group hover:bg-emerald-50 transition-all shadow-sm">
                                <div>
                                    <div className="flex items-center gap-4 mb-2">
                                        <span className="font-black text-slate-800 text-xl tracking-tight">{item.unit}</span>
                                        <span className="text-[10px] font-mono font-black text-slate-400 px-3 py-1 bg-white rounded-full border shadow-sm">#${item.id}</span>
                                    </div>
                                    <p className="text-[11px] font-bold text-emerald-700 flex items-center gap-2">
                                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                                        {item.points} 點施工完成 | 合約基準：{item.type}
                                    </p>
                                </div>
                                <button type="button" onClick={() => { setSettleItem(item); setIsSettleOpen(true); }} className="px-10 py-5 bg-emerald-600 text-white rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-200 active:scale-95 transition-all flex items-center justify-center gap-3">
                                    <span className="material-symbols-outlined">calculate</span> 執行算帳
                                </button>
                            </div>
                        )
                    ))}
                </div>
            </section>
          </div>
        </div>
      </main>

      {/* 🚀 115 年度結算彈窗 */}
      {isSettleOpen && settleItem && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-md" onClick={() => setIsSettleOpen(false)} />
            <div className="bg-white w-full max-w-3xl rounded-[3.5rem] p-12 shadow-2xl relative animate-in zoom-in-95 duration-200 border-b-[10px] border-b-emerald-500">
                <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">115 年度施工計價對沖</h2>
                <p className="text-sm font-bold text-slate-400 mb-12 border-b border-slate-100 pb-6 uppercase">案件識別：{settleItem.id} | {settleItem.unit}</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12">
                    <div className="space-y-10">
                        <div className="space-y-3">
                            <label className="text-[11px] font-black text-slate-500 uppercase ml-1 tracking-widest" htmlFor="addon-select">施工性質判定</label>
                            <select id="addon-select" title="選擇施工性質" value={settleConfig.isAddon ? "yes" : "no"} onChange={e => setSettleConfig({...settleConfig, isAddon: e.target.value === "yes"})} className="w-full bg-slate-100 rounded-2xl px-6 py-5 font-black text-sm text-blue-700 border-none cursor-pointer appearance-none">
                                <option value="no">一般常態施工 (標價)</option>
                                <option value="yes">加成施工 (緊急/夜間/假日)</option>
                            </select>
                        </div>
                        <div className="space-y-3">
                            <label className="text-[11px] font-black text-slate-500 uppercase ml-1 tracking-widest">硬體耗材物理加項</label>
                            <button type="button" onClick={() => setSettleConfig({...settleConfig, usePanel: !settleConfig.usePanel})} className={`w-full py-6 rounded-2xl font-black text-xs transition-all border-2 flex items-center justify-center gap-4 ${settleConfig.usePanel ? 'border-blue-600 bg-blue-50 text-blue-600 shadow-inner' : 'border-slate-100 text-slate-400 bg-slate-50 hover:bg-slate-100'}`}>
                                <span className="material-symbols-outlined text-xl">{settleConfig.usePanel ? 'check_box' : 'check_box_outline_blank'}</span>
                                {settleConfig.usePanel ? '已加購 24埠 PANEL (+$1,000)' : '不含 PANEL 資訊面板採購'}
                            </button>
                        </div>
                        <div className="space-y-3">
                            <label className="text-[11px] font-black text-slate-500 uppercase ml-1 tracking-widest" htmlFor="finish-remark-input">行政完工備註</label>
                            <textarea id="finish-remark-input" value={settleConfig.remark} onChange={e => setSettleConfig({...settleConfig, remark: e.target.value})} className="w-full bg-slate-50 rounded-2xl px-5 py-4 font-bold text-sm" placeholder="輸入完工行政備註..." title="完工備註" />
                        </div>
                    </div>

                    <div className="bg-slate-900 rounded-[3rem] p-10 text-white flex flex-col justify-between shadow-2xl shadow-blue-900/40 relative overflow-hidden group">
                        <div className="space-y-6 relative z-10">
                            <div className="flex justify-between border-b border-white/10 pb-4">
                                <span className="text-slate-500 font-bold text-[11px] uppercase tracking-widest">合約規格對沖</span>
                                <span className="font-black text-blue-400 text-lg">{settleItem.type}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500 font-bold text-[11px] uppercase tracking-widest">階梯點位計算</span>
                                <span className="font-black text-white text-lg">{settleItem.points} 點</span>
                            </div>
                        </div>
                        <div className="mt-12 text-center relative z-10">
                            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em] mb-3">結算預估總額 (含稅)</p>
                            <p className="text-6xl font-black font-mono tracking-tighter text-white group-hover:scale-110 transition-transform duration-300">${previewTotal.toLocaleString()}</p>
                        </div>
                    </div>
                </div>

                <div className="flex gap-5">
                    <button type="button" onClick={() => setIsSettleOpen(false)} className="flex-1 py-6 rounded-3xl font-black text-slate-400 hover:bg-slate-50 transition-all uppercase tracking-widest text-xs">取消離開</button>
                    <button type="button" onClick={confirmSettleAction} className="flex-[2] py-6 bg-emerald-600 text-white rounded-3xl font-black shadow-2xl uppercase tracking-widest text-xs flex items-center justify-center gap-4 active:scale-95">
                        <span className="material-symbols-outlined text-lg">fact_check</span> 確認算帳並轉入待請款流程
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* 全域遮罩 */}
      {isLoading && (
        <div className="fixed inset-0 z-[2000] flex flex-col items-center justify-center bg-white/90 backdrop-blur-xl">
           <div className="w-16 h-16 border-[6px] border-slate-100 border-t-blue-600 rounded-full animate-spin mb-8 shadow-2xl"></div>
           <p className="text-sm font-black text-blue-600 uppercase tracking-[0.4em] animate-pulse">{loaderText}</p>
        </div>
      )}

      {/* 物理通知氣泡 */}
      <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[2100] px-10 py-6 rounded-[2.5rem] shadow-2xl font-black text-xs text-white flex items-center gap-5 animate-in slide-in-from-bottom duration-500 bg-slate-900/95 backdrop-blur-md">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg ${toast?.type === 'error' ? 'bg-red-50 shadow-red-900/20' : 'bg-emerald-500 shadow-emerald-900/20'}`}>
            <span className="material-symbols-outlined text-lg">{toast?.type === "success" ? "done_all" : "info"}</span>
          </div>
          <span className="tracking-wide text-sm">{toast?.msg}</span>
      </div>
    </div>
  );
}