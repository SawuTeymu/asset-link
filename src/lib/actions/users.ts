"use server";

import { supabase } from "../supabase";
import { revalidatePath } from "next/cache";

/**
 * 🚀 帳號管理控制中樞
 * 物理職責：負責 profiles 表的增刪改查與狀態切換
 */

export async function getAllUsers() {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function upsertUser(payload: any) {
  const { error } = await supabase
    .from("profiles")
    .upsert([{
      ...payload,
      updated_at: new Date().toISOString()
    }], { onConflict: 'account' });
  
  if (error) throw error;
  revalidatePath("/admin");
  return { success: true };
}

export async function deleteUserRecord(id: string) {
  const { error } = await supabase
    .from("profiles")
    .delete()
    .eq("id", id);
  
  if (error) throw error;
  revalidatePath("/admin");
  return { success: true };
}

export async function getSystemPolicy() {
  const { data, error } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "user_policy")
    .single();
  if (error) return null;
  return data.value;
}