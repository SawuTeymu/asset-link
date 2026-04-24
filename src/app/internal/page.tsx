"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function InternalFastIssue() {
  const router = useRouter();

  // --- 表單狀態管理 ---
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    area: "A",
    floor: "",
    unit: "",
    ext: "",
    type: "桌上型電腦",
    model: "",
    sn: "",
    mac1: "",
    mac2: "",
    ip: "",
    name: "", // 自動生成的設備標記
  });

  const [isLoading, setIsLoading] = useState(false);
  const [loaderText, setLoaderText] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // --- 核心演算邏輯：自動生成設備標記 (Name Suggestion) ---
  useEffect(() => {
    const { area, floor, ext, ip } = formData;
    if (!area || !floor || !ip) return;

    // A. 樓層段 (05 或 B1)
    let floorPart = floor.replace("樓", "").padStart(2, "0");
    if (floor.toUpperCase().startsWith("B")) {
        const bMatch = floor.toUpperCase().match(/B[1-3]/);
        floorPart = bMatch ? bMatch[0] : floor.toUpperCase();
    }

    // B. 分機段 (處理 姓名#分機)
    let extNum = ext.includes("#") ? ext.split("#")[1] : ext;
    extNum = extNum.replace(/[^0-9]/g, "");
    if (extNum.length === 4) extNum = "1" + extNum;
    let extPart = extNum.padStart(5, "0");

    // C. IP 末三碼
    const ipParts = ip.split(".");
    let nameResult = formData.name;
    if (ipParts.length === 4 && ipParts[3] !== "") {
      const lastOctet = ipParts[3].padStart(3, "0");
      nameResult = `${area}${floorPart}-${extPart}-${lastOctet}`.toUpperCase();
    }

    if (nameResult !== formData.name) {
      setFormData((prev) => ({ ...prev, name: nameResult }));
    }
  }, [formData.area, formData.floor, formData.ext, formData.ip]);

  // --- 工具函式 ---
  const showToast = (msg: string, type: "success" | "error" = "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fmtFloor = (val: string) => {
    let v = val.trim().toUpperCase();
    if (!v) return "";
    if (v.startsWith("B")) {
      const bNum = v.replace(/[^0-9]/g, "");
      if (["1", "2", "3"].includes(bNum)) return "B" + bNum;
    }
    const n = v.replace(/[^0-9]/g, "");
    if (n) {
      if (n === "4") {
        showToast("⚠️ 行政警報：本院無 4 樓層。");
        return "";
      }
      return n.padStart(2, "0") + "樓";
    }
    return v;
  };

  const fmtMac = (val: string) => {
    let clean = val.replace(/[^A-Fa-f0-9]/g, "").toUpperCase();
    let res = "";
    for (let i = 0; i < clean.length && i < 12; i++) {
      if (i > 0 && i % 2 === 0) res += ":";
      res += clean[i];
    }
    return res;
  };

  const handleBackAdmin = () => router.push("/admin");

  // --- 提交邏輯：IP 衝突偵測 + 入庫 ---
  const submitDirect = async () => {
    const { date, sn, ip, name } = formData;
    if (!date || !sn || !ip || !name) {
      return showToast("❌ 必填行政欄位缺失 (日期, 序號, IP, 名稱)", "error");
    }

    setIsLoading(true);
    setLoaderText("掃描全院 IP 衝突...");

    try {
      // 1. 檢查 IP 衝突 (排除已報廢設備)
      const { data: conflictData, error: checkError } = await supabase
        .from("assets")
        .select("status, vendor")
        .eq("ip", ip)
        .neq("status", "已報廢");

      if (checkError) throw checkError;

      if (conflictData && conflictData.length > 0) {
        setIsLoading(false);
        return showToast(`⚠️ IP 衝突！已存於 ${conflictData[0].vendor} 庫。`, "error");
      }

      setLoaderText("物理入庫中...");

      // 2. 執行插入 (對齊 17 欄位架構)
      const { error: insertError } = await supabase.from("assets").insert([
        {
          form_id: `INT-${Date.now().toString().slice(-6)}`,
          install_date: formData.date,
          area: formData.area,
          floor: formData.floor,
          unit: formData.unit,
          applicant: formData.ext,
          device_type: formData.type,
          model: formData.model,
          sn: formData.sn.toUpperCase(),
          mac1: formData.mac1,
          mac2: formData.mac2,
          remark: "資產室內部核發",
          ip: formData.ip,
          name: formData.name,
          status: "已結案",
          vendor: "內部配發",
        },
      ]);

      if (insertError) throw insertError;

      showToast("✅ 資產已完成物理入庫並結案", "success");
      setTimeout(() => window.location.reload(), 2000);
    } catch (e: any) {
      setIsLoading(false);
      showToast(`❌ 傳輸失敗：${e.message}`, "error");
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen pb-10 font-[family-name:-apple-system,BlinkMacSystemFont,'SF_Pro_TC','PingFang_TC',system-ui,sans-serif] text-[10.5px] text-[#1d1d1f] antialiased tracking-[-0.015em]">
      <style dangerouslySetInnerHTML={{ __html: `
        .glass-card { 
            background: rgba(255, 255, 255, 0.75); 
            backdrop-filter: blur(20px) saturate(180%); 
            -webkit-backdrop-filter: blur(20px) saturate(180%);
            border: 1px solid rgba(255, 255, 255, 0.4); 
            border-radius: 20px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.03);
        }
        .info-label { 
            position: absolute; top: -7px; left: 12px; 
            background: #fff; padding: 0 6px; 
            font-size: 9px; font-weight: 800; color: #86868b; 
            z-index: 10; letter-spacing: 0.05em; border-radius: 4px;
        }
        input, select {
            background: rgba(255, 255, 255, 0.5) !important;
            border: 0.5px solid rgba(0, 0, 0, 0.1) !important;
            border-radius: 10px !important;
            padding: 10px 14px !important;
            width: 100%; transition: all 0.2s;
            font-weight: 700 !important;
            outline: none !important;
        }
        input:focus, select:focus {
            background: white !important;
            border-color: #007aff !important;
            box-shadow: 0 0 0 4px rgba(0, 122, 255, 0.1) !important;
        }
        .submit-btn {
            background: #1d1d1f; color: white;
            padding: 16px; border-radius: 14px;
            font-weight: 700; width: 100%;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 10px 20px rgba(0,0,0,0.1);
            text-transform: uppercase;
        }
        .submit-btn:active { transform: scale(0.97); background: #000; }
        .material-symbols-outlined { font-family: 'Material Symbols Outlined' !important; line-height: 1; display: inline-block; }
      `}} />

      {/* 頂部導航欄 */}
      <nav className="sticky top-0 z-50 glass-card mx-4 mt-4 p-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(0,122,255,0.5)]"></div>
          <div>
            <h1 className="text-xs font-black uppercase tracking-tight">Internal Fast-Issue</h1>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none">Asset-Link V0.0</p>
          </div>
        </div>
        <button onClick={handleBackAdmin} className="p-2 rounded-full hover:bg-slate-100 transition-colors">
          <span className="material-symbols-outlined text-slate-400 text-xl">menu</span>
        </button>
      </nav>

      <main className="px-4 mt-6 max-w-2xl mx-auto space-y-6">
        
        {/* 區塊 1: 地點與時間 */}
        <section className="glass-card p-6 grid grid-cols-1 md:grid-cols-2 gap-6 relative pt-8">
          <div className="relative">
            <label className="info-label text-blue-600">裝機日期 (C)</label>
            <input 
              type="date" 
              value={formData.date} 
              onChange={(e) => setFormData({ ...formData, date: e.target.value })} 
            />
          </div>
          <div className="relative">
            <label className="info-label text-blue-600">院區棟別 (D)</label>
            <select 
              value={formData.area} 
              onChange={(e) => setFormData({ ...formData, area: e.target.value })}
            >
              <option value="A">A 棟 (第一醫療)</option><option value="B">B 棟 (兒童醫院)</option>
              <option value="C">C 棟 (立夫醫療)</option><option value="D">D 棟 (忠孝行政)</option>
              <option value="E">E 棟 (美德醫療)</option><option value="G">G 棟 (復健醫療)</option>
              <option value="H">H 棟 (急重症中心)</option><option value="I">I 棟 (癌症中心)</option>
              <option value="K">K 棟 (眼耳鼻喉)</option><option value="T">T 棟 (立夫教學)</option>
            </select>
          </div>
          <div className="relative md:col-span-2">
            <label className="info-label text-blue-600">樓層區域 (E) [補0+樓]</label>
            <input 
              type="text" 
              value={formData.floor} 
              onBlur={(e) => setFormData({ ...formData, floor: fmtFloor(e.target.value) })}
              onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
              placeholder="例如：05 或 B1" 
            />
          </div>
        </section>

        {/* 區塊 2: 單位與人員 */}
        <section className="glass-card p-6 grid grid-cols-1 md:grid-cols-2 gap-6 relative pt-8">
          <div className="relative">
            <label className="info-label">使用單位 (F)</label>
            <input 
              type="text" 
              value={formData.unit} 
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              placeholder="護理站、藥劑科..." 
            />
          </div>
          <div className="relative">
            <label className="info-label">申請人#分機 (G)</label>
            <input 
              type="text" 
              value={formData.ext} 
              onChange={(e) => setFormData({ ...formData, ext: e.target.value })}
              placeholder="姓名#分機" 
            />
          </div>
        </section>

        {/* 區塊 3: 硬體屬性 */}
        <section className="glass-card p-6 space-y-6 relative pt-8">
          <div className="relative">
            <label className="info-label">資產類型 (H)</label>
            <select 
              value={formData.type} 
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            >
              <option value="桌上型電腦">桌上型電腦</option>
              <option value="筆記型電腦">筆記型電腦</option>
              <option value="印表機">印表機</option>
              <option value="醫療工作車">醫療工作車</option>
              <option value="行政周邊">行政周邊</option>
            </select>
          </div>
          <div className="relative">
            <label className="info-label">品牌型號 (I)</label>
            <input 
              type="text" 
              value={formData.model} 
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              placeholder="例如：HP ProDesk 600" 
            />
          </div>
          <div className="relative">
            <label className="info-label text-red-500 font-black">產品序號 S/N (J)</label>
            <input 
              type="text" 
              value={formData.sn} 
              maxLength={12} 
              onChange={(e) => setFormData({ ...formData, sn: e.target.value.toUpperCase() })}
              className="font-mono uppercase tracking-widest" 
              placeholder="嚴格 12 位元" 
            />
          </div>
        </section>

        {/* 區塊 4: 網路與對沖規則 */}
        <section className="glass-card p-6 bg-blue-50/10 space-y-6 relative pt-8 border-dashed border-blue-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <label className="info-label text-blue-400">主要 MAC (K)</label>
              <input 
                type="text" 
                value={formData.mac1} 
                onChange={(e) => setFormData({ ...formData, mac1: fmtMac(e.target.value) })}
                className="font-mono text-[9px]" 
                placeholder="XX:XX:XX:XX:XX:XX" 
              />
            </div>
            <div className="relative">
              <label className="info-label text-emerald-400">無線 MAC (L)</label>
              <input 
                type="text" 
                value={formData.mac2} 
                onChange={(e) => setFormData({ ...formData, mac2: fmtMac(e.target.value) })}
                className="font-mono text-[9px]" 
                placeholder="XX:XX:XX:XX:XX:XX" 
              />
            </div>
          </div>

          <div className="relative">
            <label className="info-label text-blue-600 font-bold">核定 IP 位址 (N)</label>
            <input 
              type="text" 
              value={formData.ip} 
              onChange={(e) => setFormData({ ...formData, ip: e.target.value })}
              className="font-mono text-base font-bold text-blue-700" 
              placeholder="10.x.x.x" 
            />
          </div>

          <div className="relative">
            <label className="info-label text-emerald-600 font-bold">自動標記名稱 (M)</label>
            <input 
              type="text" 
              value={formData.name} 
              readOnly 
              className="bg-emerald-50/30 font-mono text-xs uppercase tracking-tight text-emerald-800" 
              placeholder="系統自動演算中..." 
            />
            <p className="text-[8px] text-slate-400 mt-2 ml-1 italic font-medium">規則：[棟別樓層] - [分機補1] - [IP末三碼]</p>
          </div>
        </section>

        <button onClick={submitDirect} className="submit-btn flex items-center justify-center gap-2 shadow-xl hover:scale-[1.02] active:scale-95 transition-transform">
          <span className="material-symbols-outlined text-sm">verified</span>
          執行物理入庫結案
        </button>

      </main>

      {/* 全域強同步遮罩 */}
      {isLoading && (
        <div className="fixed inset-0 z-[500] flex flex-col items-center justify-center bg-white/70 backdrop-blur-xl">
          <div className="w-10 h-10 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin"></div>
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-4">{loaderText}</p>
        </div>
      )}

      {/* 通知系統 */}
      {toast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[600] flex flex-col gap-2 pointer-events-none">
          <div className={`px-8 py-4 rounded-3xl shadow-2xl font-black text-[11px] animate-bounce ${toast.type === "success" ? "bg-slate-900" : "bg-red-600"} text-white flex items-center gap-3`}>
            <span className="material-symbols-outlined text-base">info</span>
            <span>{toast.msg}</span>
          </div>
        </div>
      )}
    </div>
  );
}