import { createClient } from '@supabase/supabase-js';

// 1. 初始化 Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  // 2. 請求方法保護
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method Not Allowed' 
    });
  }

  const payload = req.body;

  try {
    // 3. 執行資料寫入
    const { data, error } = await supabase
      .from('nsr_records')
      .insert([payload]);

    // 4. 錯誤捕捉邏輯
    if (error) {
      // 捕捉 Postgres 唯一性衝突 (Code: 23505)
      if (error.code === '23505' || error.status === 409) {
        return res.status(409).json({
          success: false,
          code: 'CONFLICT',
          message: "該記錄已存在 (409 Conflict)，請確認是否有重複提交。",
          detail: error.detail
        });
      }
      
      // 捕捉其餘 Supabase 錯誤
      throw error;
    }

    // 5. 成功回應
    return res.status(200).json({
      success: true,
      message: "資料儲存成功",
      data: data
    });

  } catch (err) {
    // 6. 終極防護：避免伺服器 500 崩潰
    console.error("[Backend Crash Avoided]:", err);
    
    return res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      message: "系統內部處理異常，請洽管理員。",
      error_hint: err.message
    });
  }
}
