"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// --- 💰 115 年度正式計價矩陣 (物理校準版) ---
const PRICING_MATRIX: any = {
  'CAT 6A': {
    'normal': { '1-4': 4400, '5-8': 4300, '9+': 4200 },
    'addon': { '1-4': 5700, '5-8': 5600, '9+': 5500 }
  },
  'CAT 6': {
    'normal': { '1-4': 3600, '5-8': 3500, '9+': 3400 },
    'addon': { '1-4': 4800, '5-8': 4700, '9+': 4500 }
  }
};

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
  finishDate?: string;
  finishRemark?: string;
  source: string;
}

export default function NsrAdminPage() {
  const router = useRouter();

  // --- 狀態管理 ---
  const [globalNsrData, setGlobalNsrData] = useState<NsrRecord[]>([]);
  const [formData, setFormData] = useState<Partial<NsrRecord>>({
    id: "", date: "", area: "A", floor: "", deptCode: "", unit: "",
    user: "", ext: "", points: 1, type: "CAT 6", desc: ""
  });

  const [isLoading, setIsLoading] = useState(false);
  const [loaderText, setLoaderText] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // 結算彈窗狀態
  const [isSettleOpen, setIsSettleOpen] = useState(false);
  const [settleItem, setSettleItem] = useState<NsrRecord | null>(null);
  const [settleConfig, setSettleConfig] = useState({ type: "normal", panel: "no", remark: "" });

  // --- 生命週期 ---
  useEffect(() => {
    initNsrHub();
  }, []);

  const initNsrHub = async () => {
    setIsLoading(true);
    setLoaderText("同步 115 合約數據庫...");
    
    // 從 Supabase 撈取 NSR 紀錄 (透過 form_id 辨識)
    const { data, error } = await supabase
      .from("assets")
      .select("*")
      .ilike("form_id", "C01%");

    if (error) {
      showToast("同步失敗：" + error.message, "error");
    } else {
      // 物理映射 Supabase 17 欄位回 NSR 16 欄位結構
      const mapped: NsrRecord[] = (data || []).map(r => ({
        id: r.form_id,
        date: r.install_date,
        area: r.area,
        floor: r.floor,
        deptCode: r.remark?.split('|')[0]?.trim() || "", // 假設部門代碼存在備註中
        unit: r.unit,
        user: r.applicant,
        ext: r.applicant?.split('#')[1] || "",
        points: parseInt(r.model) || 0, // 假設點位數存在 model 欄位
        type: r.device_type || "CAT 6", // 假設規格存在 device_type
        desc: r.remark || "",
        total: parseFloat(r.ip) || 0, // 假設總價存於 IP 位址欄位(僅作示範，實際應對齊資料表欄位)
        status: r.status,
        source: r.vendor
      }));
      setGlobalNsrData(mapped);
    }
    setIsLoading(false);
  };

  // --- 核心邏輯：計價引擎 ---
  const calculatedPrices = useMemo(() => {
    if (!settleItem) return { unit: 0, total: 0, tier: "---" };
    let cable = settleItem.type;
    const qty = settleItem.points || 0;
    const isAddon = settleConfig.type === "addon";
    const usePanel = settleConfig.panel === "yes";

    if (!PRICING_MATRIX[cable]) cable = 'CAT 6';

    let tier: '1-4' | '5-8' | '9+' = '1-4';
    if (qty >= 5 && qty <= 8) tier = '5-8';
    else if (qty >= 9) tier = '9+';

    const unitPrice = PRICING_MATRIX[cable][isAddon ? "addon" : "normal"][tier];
    const total = (unitPrice * qty) + (usePanel ? 1000 : 0);

    return { unit: unitPrice, total, tier };
  }, [settleItem, settleConfig]);

  // --- 工具功能 ---
  const showToast = (msg: string, type: "success" | "error" = "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fmtFloor = (val: string) => {
    let v = val.trim().toUpperCase();
    if (!v) return "";
    if (v.includes('4')) {
      showToast("醫院無 4 樓，請重新輸入", "error");
      return "";
    }
    if (/^B[1-3]$/.test(v)) return v;
    const num = v.replace(/[^0-9]/g, '');
    return num ? num.padStart(2, '0') + '樓' : v;
  };

  const handleIdInput = (val: string) => {
    const id = val.trim().toUpperCase();
    let newDate = formData.date;
    if (id.startsWith("C01") && id.length >= 11) {
      const y = id.substring(3, 7), m = id.substring(7, 9), d = id.substring(9, 11);
      if (!isNaN(parseInt(y))) newDate = `${y}-${m}-${d}`;
    }
    setFormData({ ...formData, id, date: newDate });
  };

  const viewDetail = (id: string) => {
    const item = globalNsrData.find(r => r.id === id);
    if (item) {
      setFormData(item);
      showToast(`已載入案件：${id}`, "success");
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // --- 提交與結案 ---
  const submitNSR = async () => {
    if (!formData.id || !formData.unit || !formData.user?.includes('#')) {
      return showToast("❌ 行政偏差：申請人須為 姓名#分機。", "error");
    }

    setIsLoading(true);
    setLoaderText("雲端數據落地中...");

    // 模擬 16 欄位寫入 Supabase (實際應對齊 DB 欄位)
    const { error } = await supabase.from("assets").upsert({
      form_id: formData.id,
      install_date: formData.date,
      area: formData.area,
      floor: formData.floor,
      unit: formData.unit,
      applicant: formData.user,
      model: String(formData.points), // points
      device_type: formData.type, // cable
      remark: `${formData.deptCode} | ${formData.desc}`,
      status: formData.status || "未處理",
      vendor: "系統管理端錄入"
    });

    if (error) {
      showToast("提交失敗：" + error.message, "error");
    } else {
      showToast("✅ 需求單提交成功", "success");
      setFormData({ id: "", date: "", area: "A", floor: "", deptCode: "", unit: "", user: "", ext: "", points: 1, type: "CAT 6", desc: "" });
      initNsrHub();
    }
    setIsLoading(false);
  };

  const confirmSettle = async () => {
    if (!settleItem) return;
    setIsLoading(true);
    setLoaderText("執行物理結案遷移...");

    const { error } = await supabase
      .from("assets")
      .update({
        status: "已結案",
        ip: String(calculatedPrices.total), // 暫借 IP 欄位存總價
        remark: `${settleItem.desc} | 完工備註: ${settleConfig.remark}`
      })
      .eq("form_id", settleItem.id);

    if (error) {
      showToast("結案失敗：" + error.message, "error");
    } else {
      showToast("✅ 結案核銷成功！", "success");
      setIsSettleOpen(false);
      initNsrHub();
    }
    setIsLoading(false);
  };

  const exportAssignment = () => {
    const pending = globalNsrData.filter(r => ["未處理", "待處理", "", "退回修正"].includes(r.status));
    if (!pending.length) return showToast("目前無待處理案件", "error");
    let txt = `===== 網點施工派工單 (V0.0) =====\n生成時間：${new Date().toLocaleString()}\n\n`;
    pending.forEach((r, i) => {
      txt += `[${i + 1}] 申請單號：${r.id}\n位置：${r.area}棟 ${r.floor}\n單位：${r.unit}\n申請人：${r.user}\n規格：${r.points}點 (${r.type})\n事由：${r.desc}\n----------------------------------\n\n`;
    });
    const blob = new Blob([txt], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `NSR_DISPATCH_ORDER.txt`;
    a.click();
  };

  return (
    <div className="bg-[#f8fafc] text-[#1d1d1f] font-[family-name:-apple-system,BlinkMacSystemFont,'SF_Pro_TC','PingFang_TC',system-ui,sans-serif] text-[10.5px] antialiased tracking-[-0.015em] min-h-screen pb-12">
      <style dangerouslySetInnerHTML={{ __html: `
        .glass-card { 
            background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(25px) saturate(200%); -webkit-backdrop-filter: blur(25px) saturate(200%);
            border: 1px solid rgba(255, 255, 255, 0.5); border-radius: 24px; box-shadow: 0 4px 25px rgba(0, 0, 0, 0.02);
        }
        .info-label { position: absolute; top: -8px; left: 14px; background: #fff; padding: 0 6px; font-size: 9px; font-weight: 800; color: #86868b; z-index: 10; text-transform: uppercase; }
        input, select, textarea { background: rgba(255, 255, 255, 0.5) !important; border: 0.5px solid rgba(0, 0, 0, 0.1) !important; border-radius: 14px !important; padding: 12px 16px !important; width: 100%; font-weight: 600 !important; }
        input:focus, select:focus, textarea:focus { background: white !important; border-color: #007aff !important; box-shadow: 0 0 0 4px rgba(0, 122, 255, 0.1) !important; outline: none !important; }
        .material-symbols-outlined { font-family: 'Material Symbols Outlined' !important; line-height: 1; display: inline-block; }
      `}} />

      {/* 頂部導覽列 */}
      <nav className="sticky top-0 z-50 glass-card mx-4 mt-4 p-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-3 h-3 rounded-full bg-blue-600 animate-pulse"></div>
          <div>
            <h1 className="text-xs font-black uppercase tracking-tight">網點需求管理中樞</h1>
            <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5 tracking-widest">Asset-Link NSR V0.0</p>
          </div>
        </div>
        <button onClick={() => router.push("/admin")} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-[9px] uppercase active:scale-95 transition-all flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">grid_view</span>
          <span className="hidden sm:inline">返回管理主面板</span>
        </button>
      </nav>

      <main className="px-4 mt-8 max-w-7xl mx-auto flex flex-col lg:flex-row gap-8">
        
        {/* 🧱 軌道 1：施工需求錄入 */}
        <div className="w-full lg:w-5/12 shrink-0">
          <section className="glass-card p-6 sm:p-8 space-y-8 border-l-[8px] border-l-slate-900">
            <div className="flex items-center justify-between">
              <h2 className="font-black text-slate-800 text-sm flex items-center gap-2 italic uppercase">
                <span className="material-symbols-outlined text-blue-600">assignment_add</span> 施工需求申請
              </h2>
              <button onClick={submitNSR} className="px-6 py-3 bg-blue-600 text-white text-[10px] rounded-2xl font-bold shadow-xl uppercase tracking-widest active:scale-95 transition-all">提交雲端</button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="sm:col-span-2 relative pt-2">
                <label className="info-label text-blue-600">申請單號 (A)</label>
                <input type="text" value={formData.id} onChange={e => handleIdInput(e.target.value)} placeholder="C01-2026-0001" className="font-mono tracking-widest uppercase" />
              </div>
              <div className="relative">
                <label className="info-label">申請日期 (B)</label>
                <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
              </div>
              <div className="relative">
                <label className="info-label">裝機棟別 (C)</label>
                <select value={formData.area} onChange={e => setFormData({...formData, area: e.target.value})}>
                  {['A','B','C','D','E','G','H','I','K','T'].map(a => <option key={a} value={a}>{a}棟</option>)}
                </select>
              </div>
              <div className="relative">
                <label className="info-label text-blue-600">樓層區域 (D)</label>
                <input type="text" value={formData.floor} onBlur={e => setFormData({...formData, floor: fmtFloor(e.target.value)})} onChange={e => setFormData({...formData, floor: e.target.value})} placeholder="例如：05" />
              </div>
              <div className="relative">
                <label className="info-label">部門代號 (E)</label>
                <input type="text" value={formData.deptCode} onChange={e => setFormData({...formData, deptCode: e.target.value})} placeholder="例如：7020" />
              </div>
              <div className="sm:col-span-2 relative">
                <label className="info-label font-black text-slate-900">單位全銜 (F)</label>
                <input type="text" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} placeholder="請輸入完整單位名稱" />
              </div>
              <div className="relative">
                <label className="info-label text-blue-600 font-black">申請人#分機 (G)</label>
                <input type="text" value={formData.user} onChange={e => setFormData({...formData, user: e.target.value})} placeholder="姓名#分機" />
              </div>
              <div className="relative">
                <label className="info-label">連絡電話 (H)</label>
                <input type="text" value={formData.ext} onChange={e => setFormData({...formData, ext: e.target.value})} placeholder="手機或分機" />
              </div>
              <div className="sm:col-span-2 p-6 bg-slate-50/80 rounded-[1.5rem] border border-slate-100 grid grid-cols-2 gap-6 shadow-inner">
                <div className="relative">
                  <label className="info-label text-blue-600 font-bold">需求點數 (I)</label>
                  <input type="number" value={formData.points} onChange={e => setFormData({...formData, points: parseInt(e.target.value) || 0})} className="text-base font-black" />
                </div>
                <div className="relative">
                  <label className="info-label text-blue-600 font-bold">線材規格 (J)</label>
                  <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} className="font-bold">
                    <option value="CAT 6">CAT 6</option>
                    <option value="CAT 6A">CAT 6A</option>
                  </select>
                </div>
              </div>
              <div className="sm:col-span-2 relative">
                <label className="info-label">施工原因 (K)</label>
                <textarea value={formData.desc} onChange={e => setFormData({...formData, desc: e.target.value})} rows={3} placeholder="說明施工需求..." />
              </div>
            </div>
          </section>
        </div>

        {/* 🧱 軌道 2：行政處理池 */}
        <div className="w-full lg:w-7/12 flex flex-col gap-8">
          {/* 待辦池 */}
          <div className="glass-card p-6 sm:p-8 flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-blue-500">pending_actions</span>
                <h3 className="font-black text-slate-800 text-[11px] uppercase tracking-widest">待辦施工案件庫</h3>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={exportAssignment} className="px-4 py-2 bg-slate-900 text-white rounded-full text-[8.5px] font-black uppercase shadow-lg active:scale-90">匯出派工單</button>
                <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-[10px] font-black italic">
                  {globalNsrData.filter(r => ["未處理", "待處理", "", "退回修正"].includes(r.status)).length}
                </span>
              </div>
            </div>
            <div className="relative">
              <select onChange={(e) => viewDetail(e.target.value)} className="w-full font-black text-slate-600 py-5 px-6 rounded-3xl cursor-pointer hover:bg-white shadow-inner appearance-none border-2 border-slate-50 transition-all">
                <option value="">-- 選取案件以檢視詳情 --</option>
                {globalNsrData.filter(r => ["未處理", "待處理", "", "退回修正"].includes(r.status)).map(r => (
                  <option key={r.id} value={r.id}>{r.id} | {r.unit} ({r.points} 點)</option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300">expand_more</span>
            </div>
            <p className="text-[8px] text-slate-400 mt-4 ml-2 italic">※ 選取後資料將自動回填至左側表單供檢視或修改</p>
          </div>

          {/* 計價池 */}
          <div className="glass-card p-6 sm:p-8 flex flex-col border-l-[8px] border-l-emerald-500">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-emerald-500">account_balance_wallet</span>
                <h3 className="font-black text-slate-800 text-[11px] uppercase tracking-widest">行政計價核銷池</h3>
              </div>
              <span className="bg-emerald-600 text-white px-3 py-1 rounded-full text-[10px] font-black italic">
                {globalNsrData.filter(r => r.status === "已核定").length}
              </span>
            </div>
            <div className="relative">
              <select onChange={(e) => {
                const item = globalNsrData.find(r => r.id === e.target.value);
                if (item) { setSettleItem(item); setIsSettleOpen(true); }
              }} className="w-full font-black text-slate-600 py-5 px-6 rounded-3xl cursor-pointer hover:bg-white shadow-inner appearance-none border-2 border-slate-50 transition-all">
                <option value="">選取已完工待核銷單號...</option>
                {globalNsrData.filter(r => r.status === "已核定").map(r => (
                  <option key={r.id} value={r.id}>{r.id} | {r.unit} ({r.type})</option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300">expand_more</span>
            </div>
          </div>

          <div className="p-8 bg-slate-900 rounded-[2.5rem] text-emerald-400 font-mono text-[10px] shadow-2xl flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-white font-black uppercase tracking-widest text-[9.5px]">115 合約計價引擎：穩定對沖</span>
            </div>
            <div className="opacity-30 italic font-black uppercase tracking-[0.3em]">NSR Master V0.0</div>
          </div>
        </div>
      </main>

      {/* 🚀 結案計價彈窗 */}
      {isSettleOpen && settleItem && (
        <div className="fixed inset-0 z-[100] modal-blur flex items-center justify-center p-6 bg-slate-900/40">
          <div className="glass-card w-full max-w-lg p-10 shadow-2xl space-y-8 bg-white/95 border-2 border-emerald-50 animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between border-b border-slate-100 pb-6">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 bg-emerald-600 text-white rounded-[1.5rem] flex items-center justify-center shadow-xl">
                  <span className="material-symbols-outlined text-3xl">currency_exchange</span>
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-lg italic uppercase tracking-tighter">115年度計價結案</h3>
                  <p className="text-[10px] font-mono text-slate-400 font-black mt-1 tracking-widest uppercase">案號：{settleItem.id}</p>
                </div>
              </div>
              <button onClick={() => setIsSettleOpen(false)} className="w-10 h-10 rounded-full hover:bg-red-50 flex items-center justify-center transition-all"><span className="material-symbols-outlined text-slate-300">close</span></button>
            </div>

            <div className="space-y-8">
              <div className="grid grid-cols-2 gap-6">
                <div className="relative">
                  <label className="info-label text-blue-600 font-black">案件施工性質</label>
                  <select value={settleConfig.type} onChange={e => setSettleConfig({...settleConfig, type: e.target.value})}>
                    <option value="normal">一般施工 (合約基準)</option>
                    <option value="addon">加成施工 (複雜/緊急)</option>
                  </select>
                </div>
                <div className="relative">
                  <label className="info-label text-emerald-600 font-black">面板採購選項</label>
                  <select value={settleConfig.panel} onChange={e => setSettleConfig({...settleConfig, panel: e.target.value})}>
                    <option value="no">無須加購面板</option>
                    <option value="yes">加購面板 (+$1,000)</option>
                  </select>
                </div>
              </div>

              <div className="bg-slate-900 p-8 rounded-[2.2rem] space-y-6 shadow-2xl text-white">
                <div className="flex justify-between items-center text-slate-500 font-black text-[9px] uppercase tracking-[0.2em]">
                  <span>115 合約階梯單價 (Tier)</span>
                  <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase">{settleItem.type} | {calculatedPrices.tier}</span>
                </div>
                <div className="flex justify-between items-end border-b border-white/5 pb-4">
                  <div className="text-[10px] font-black text-slate-400 uppercase">核算結案單價:</div>
                  <div className="text-2xl font-mono font-black">$ {calculatedPrices.unit.toLocaleString()}</div>
                </div>
                <div className="flex justify-between items-end pt-2">
                  <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">行政核銷總計 (L):</div>
                  <div className="text-4xl font-mono font-black text-emerald-500">$ {calculatedPrices.total.toLocaleString()}</div>
                </div>
              </div>

              <div className="relative">
                <label className="info-label">完工行政備註 (O)</label>
                <textarea value={settleConfig.remark} onChange={e => setSettleConfig({...settleConfig, remark: e.target.value})} rows={3} placeholder="填寫完工描述..." />
              </div>

              <button onClick={confirmSettle} className="w-full py-5 bg-slate-900 text-white rounded-2xl shadow-2xl text-[12px] tracking-[0.4em] uppercase font-black active:scale-95 transition-all">
                確認數據並物理結案
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 全域遮罩 */}
      {isLoading && (
        <div className="fixed inset-0 z-[500] flex flex-col items-center justify-center bg-white/80 backdrop-blur-xl">
          <div className="w-12 h-12 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin mb-6"></div>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em]">{loaderText}</p>
        </div>
      )}

      {/* 通知氣泡 */}
      {toast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[600] flex flex-col gap-3 pointer-events-none w-full max-w-[340px] px-4">
          <div className={`px-6 py-4 rounded-3xl shadow-2xl font-black text-[11px] animate-bounce flex items-center gap-3 border border-white/20 ${toast.type === "success" ? "bg-slate-900" : "bg-red-600"} text-white`}>
            <span className="material-symbols-outlined text-sm">info</span>
            <span>{toast.msg}</span>
          </div>
        </div>
      )}
    </div>
  );
}