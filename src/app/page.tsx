"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

interface Vendor {
  id: string;
  name: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [view, setView] = useState<"role" | "vendor">("role");
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendor, setSelectedVendor] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loaderText, setLoaderText] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const showError = (msg: string) => {
    setErrorMsg("⚠️ " + msg);
    setTimeout(() => setErrorMsg(""), 6000);
  };

  const handleAdminSSO = () => {
    setIsLoading(true);
    setLoaderText("管理者身分識別中...");
    setTimeout(() => {
      router.push("/admin");
    }, 1500);
  };

  const showVendorForm = async () => {
    setView("vendor");
    const { data, error } = await supabase
      .from("vendors")
      .select("id, name")
      .eq("is_active", true)
      .order("name");

    if (error) {
      showError("清單讀取失敗：" + error.message);
    } else {
      setVendors(data || []);
    }
  };

  const handleVendorLogin = () => {
    if (!selectedVendor) {
      return showError("請選取您的廠商名稱");
    }
    setIsLoading(true);
    setLoaderText("簽發全院對沖安全憑證...");
    setTimeout(() => {
      router.push(`/keyin?v=${encodeURIComponent(selectedVendor)}`);
    }, 1500);
  };

  const resetUI = () => {
    setView("role");
    setErrorMsg("");
  };

  return (
    <div className="min-h-screen bg-[#f1f5f9] flex items-center justify-center font-[family-name:-apple-system,BlinkMacSystemFont,'SF_Pro_TC','PingFang_TC',system-ui,sans-serif] text-[10.5px] text-[#1e293b] antialiased tracking-[-0.015em] m-0">
      <style dangerouslySetInnerHTML={{__html: `
        .material-symbols-outlined {
            font-family: 'Material Symbols Outlined' !important;
            font-weight: normal;
            font-style: normal;
            line-height: 1;
            letter-spacing: normal;
            text-transform: none;
            display: inline-block;
            white-space: nowrap;
            word-wrap: normal;
            direction: ltr;
            -webkit-font-feature-settings: 'liga';
            -webkit-font-smoothing: antialiased;
        }
        .login-card { 
            background: rgba(255, 255, 255, 0.85); 
            backdrop-filter: blur(25px) saturate(180%);
            -webkit-backdrop-filter: blur(25px) saturate(180%);
            border: 1px solid rgba(255, 255, 255, 0.5); 
            box-shadow: 0 30px 60px -12px rgba(0, 0, 0, 0.08); 
            width: 90%; 
            max-width: 400px; 
            padding: 3rem 2rem; 
            border-radius: 3rem; 
            position: relative;
            animation: slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes slideUp { 
            from { opacity: 0; transform: translateY(40px); } 
            to { opacity: 1; transform: translateY(0); } 
        }
        .clean-select {
            -webkit-appearance: none !important;
            appearance: none !important;
            background-image: none !important;
            border: 0.5px solid rgba(0,0,0,0.1) !important;
            background-color: rgba(241, 245, 249, 0.7) !important;
            font-size: 14px !important;
            font-weight: 600 !important;
            color: #334155;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            outline: none !important;
            cursor: pointer;
            border-radius: 1.2rem !important;
        }
        .clean-select:focus {
            background-color: white !important;
            border-color: #007aff !important;
            box-shadow: 0 0 0 4px rgba(0, 122, 255, 0.1) !important;
        }
        .btn-action { 
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); 
            border-radius: 1.5rem; 
        }
        .btn-action:active { transform: scale(0.96); opacity: 0.9; }
        .admin-link {
            font-size: 9px;
            font-weight: 800;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            transition: all 0.2s;
            cursor: pointer;
        }
        .admin-link:hover { color: #007aff; }
        .shimmer {
            background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0) 100%);
            background-size: 200% 100%;
            animation: shimmer 5s infinite linear;
        }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
      `}} />

      <div className="login-card overflow-hidden">
        <div className="shimmer absolute inset-0 pointer-events-none opacity-20"></div>

        <div className="text-center mb-12 relative z-10">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/20 mb-6 transform hover:rotate-3 transition-transform">
            <span className="material-symbols-outlined text-white text-3xl font-bold">verified_user</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tighter leading-none">裝機預約管理系統</h1>
          <p className="text-[8px] font-black text-blue-500 uppercase tracking-[0.3em] mt-3 opacity-70">Logistics Center V0.0</p>
        </div>

        {view === "role" ? (
          <div id="role-selector" className="space-y-10 relative z-10">
            <div className="px-2">
              <button onClick={showVendorForm} className="btn-action w-full py-5 bg-slate-900 text-white font-bold flex items-center justify-center gap-3 shadow-xl group">
                <span className="material-symbols-outlined text-blue-400 group-hover:rotate-12 transition-transform text-xl">precision_manufacturing</span>
                <span className="tracking-widest text-sm">廠商預約申請入口</span>
              </button>
            </div>

            <div className="flex justify-center">
              <div onClick={handleAdminSSO} className="admin-link flex items-center gap-2 group">
                資訊室管理者專用登入 <span className="group-hover:translate-x-1 transition-transform">➔</span>
              </div>
            </div>
          </div>
        ) : (
          <div id="vendor-area" className="space-y-8 relative z-10">
            <button onClick={resetUI} className="text-slate-400 text-[9px] font-black uppercase flex items-center gap-1 hover:text-blue-600 transition-colors ml-2">
              <span className="material-symbols-outlined text-base">arrow_back</span> 返回
            </button>
            
            <div className="space-y-4 px-2">
              <label className="block text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">請選取您的所屬廠商名稱</label>
              <div className="relative group">
                <select
                  value={selectedVendor}
                  onChange={(e) => setSelectedVendor(e.target.value)}
                  className="clean-select w-full py-4 px-6 shadow-sm"
                >
                  <option value="">{vendors.length === 0 ? "正在讀取全院廠商清單..." : "請選擇..."}</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.name}>{v.name}</option>
                  ))}
                </select>
                <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-blue-500 transition-colors">
                  <span className="material-symbols-outlined text-xl">expand_more</span>
                </div>
              </div>
            </div>
            
            <div className="px-2">
              <button onClick={handleVendorLogin} className="btn-action w-full py-5 bg-blue-600 text-white font-black shadow-lg shadow-blue-600/20 text-sm tracking-widest">
                確認進入填報系統
              </button>
            </div>
          </div>
        )}

        <div className={`mt-8 text-center text-[10px] font-bold text-red-500 transition-opacity duration-300 ${errorMsg ? 'opacity-100' : 'opacity-0'}`}>
          {errorMsg || " "}
        </div>
      </div>

      <div className={`fixed inset-0 bg-white/80 z-[200] flex-col items-center justify-center backdrop-blur-xl ${isLoading ? 'flex' : 'hidden'}`}>
        <div className="w-10 h-10 border-2 border-slate-100 border-t-blue-500 rounded-full animate-spin mb-4"></div>
        <p className="text-slate-400 text-[9px] font-black tracking-[0.4em] uppercase">{loaderText}</p>
      </div>
    </div>
  );
}