"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ADMIN_CREDENTIALS_LIST } from "@/lib/constants";

/**
 * ==========================================
 * 檔案：src/app/page.tsx
 * 狀態：V122.0 旗艦除垢版 (Git 標記移除)
 * 物理職責：登入分流、管理者 UID 物理驗證。
 * ==========================================
 */

interface VendorDbRow {
  廠商名稱: string;
  行政狀態: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [loginType, setLoginType] = useState<"admin" | "vendor" | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [adminAccount, setAdminAccount] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [vendors, setVendors] = useState<{name: string, status: string}[]>([]);
  const [selectedVendor, setSelectedVendor] = useState("");

  useEffect(() => {
    const fetchVendors = async () => {
      try {
        const { data } = await supabase.from("vendors").select("廠商名稱, 行政狀態").eq("授權啟用開關", true).order("廠商名稱", { ascending: true });
        const mappedData = (data as unknown as VendorDbRow[] || []).map((v) => ({
          name: String(v.廠商名稱 || ""),
          status: String(v.行政狀態 || "")
        }));
        setVendors(mappedData);
      } catch (err) { console.error("物理同步失敗:", err); }
    };
    fetchVendors();
  }, []);

  const handleAdminLogin = () => {
    setErrorMsg("");
    if (!adminAccount.trim() || !adminPassword.trim()) { setErrorMsg("請輸入完整的帳密"); return; }
    setIsLoading(true);
    const matched = ADMIN_CREDENTIALS_LIST.find(a => a.uid === adminAccount && a.password === adminPassword);
    if (matched) {
      sessionStorage.setItem("asset_link_admin_auth", "true");
      sessionStorage.setItem("asset_link_admin_name", matched.uid);
      router.push("/admin");
    } else {
      setErrorMsg("🚫 驗證失敗：帳號或密碼錯誤。");
      setIsLoading(false);
    }
  };

  const handleVendorLogin = () => {
    if (!selectedVendor) return;
    const vendorData = vendors.find(v => v.name === selectedVendor);
    if (vendorData?.status === '停權' || vendorData?.status === '停用') { setErrorMsg("⚠️ 帳號已被凍結。"); return; }
    setIsLoading(true);
    sessionStorage.setItem("asset_link_vendor", selectedVendor);
    router.push("/keyin");
  };

  return (
    <div className="min-h-screen bg-[#f7f9fb] flex items-center justify-center p-6 relative overflow-hidden font-sans">
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-blue-600/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[100px] animate-pulse delay-1000"></div>
      </div>

      <div className="relative z-10 w-full max-w-[440px] animate-in fade-in zoom-in-95 duration-700">
        <header className="text-center mb-12">
          <div className="w-24 h-24 bg-blue-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-2xl rotate-3">
            <span className="material-symbols-outlined text-white text-5xl">token</span>
          </div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tighter uppercase">A-L-I-N-K</h1>
        </header>

        <main className="bg-white/70 backdrop-blur-3xl rounded-[3rem] p-10 shadow-2xl border border-white/60 relative">
          {errorMsg && <div className="mb-8 p-5 bg-red-50 text-red-600 rounded-2xl border border-red-100 text-xs font-black animate-bounce">{errorMsg}</div>}

          {!loginType ? (
            <div className="space-y-5">
              <button onClick={() => setLoginType("vendor")} className="w-full p-6 rounded-[1.75rem] bg-white border-2 border-slate-100 hover:border-blue-600 transition-all flex items-center gap-5 text-left active:scale-95">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400"><span className="material-symbols-outlined text-3xl">storefront</span></div>
                <div><h3 className="font-black text-slate-800 text-xl">廠商預約</h3><p className="text-[10px] font-bold text-slate-400 uppercase">Vendor Portal</p></div>
              </button>
              <button onClick={() => setLoginType("admin")} className="w-full p-6 rounded-[1.75rem] bg-white border-2 border-slate-100 hover:border-slate-900 transition-all flex items-center gap-5 text-left active:scale-95">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400"><span className="material-symbols-outlined text-3xl">admin_panel_settings</span></div>
                <div><h3 className="font-black text-slate-800 text-xl">資訊室管理</h3><p className="text-[10px] font-bold text-slate-400 uppercase">Admin Hub</p></div>
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <button onClick={() => setLoginType(null)} className="flex items-center gap-2 text-slate-400 font-black text-xs hover:text-blue-600 transition-colors"><span className="material-symbols-outlined text-sm">arrow_back</span> 返回</button>
              {loginType === "admin" ? (
                <div className="space-y-5">
                  <input id="v122-uid" type="text" placeholder="UID" value={adminAccount} onChange={e => setAdminAccount(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-5 font-bold outline-none focus:border-slate-900 transition-all" />
                  <input id="v122-pwd" type="password" placeholder="••••••••" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-5 font-bold outline-none focus:border-slate-900 transition-all" />
                  <button onClick={handleAdminLogin} className="w-full bg-slate-900 text-white rounded-2xl py-5 mt-4 font-black uppercase shadow-xl text-xs active:scale-95">執行身分對沖</button>
                </div>
              ) : (
                <div className="space-y-6">
                  <select id="vendorSelectInput" title="選擇廠商" value={selectedVendor} onChange={e => setSelectedVendor(e.target.value)} className="w-full appearance-none bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-5 font-black text-slate-700 outline-none focus:border-blue-600 transition-all shadow-inner">
                    <option value="" disabled>請選擇廠商名稱...</option>
                    {vendors.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                  </select>
                  <button onClick={handleVendorLogin} className="w-full bg-blue-600 text-white rounded-2xl py-5 font-black uppercase shadow-xl text-xs active:scale-95 flex items-center justify-center gap-4">進入作業區</button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
```

---

### 🚀 最終部署與除垢操作指南

請在終端機（VS Code）依序執行以下物理指令：

1.  **放棄所有衝突狀態**：
    ```bash
    git rebase --abort
    git merge --abort
    ```

2.  **清理所有檔案並提交純淨代碼**：
    * 手動將上面的代碼分別貼入對應檔案。
    * 檢查 `src/app/internal/page.tsx`、`src/app/pending/page.tsx`、`src/app/nsr/page.tsx` 裡面有沒有 `<<<<<<<` 標記，如果有，也手動刪掉（保留您要的邏輯即可）。

3.  **提交並推送到 GitHub**：
    ```bash
    git add .
    git commit -m "V122.0 Final Purification: Removing all merge conflict markers"
    git push origin main --force