/**
 * Supabase 客户端初始化
 * 使用 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY 环境变量
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Supabase] 缺少环境变量 VITE_SUPABASE_URL 或 VITE_SUPABASE_ANON_KEY，云端同步功能不可用。'
  );
}

/**
 * Supabase 单例客户端
 * 如果环境变量缺失，则为 null（应用仍可在纯本地模式下运行）
 */
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      })
    : null;

/**
 * 检查 Supabase 是否可用（环境变量已配置）
 */
export const isSupabaseConfigured = (): boolean => {
  return supabase !== null;
};

/**
 * 获取 Supabase 客户端（非空断言版本，仅在确认已配置后使用）
 * @throws 如果 Supabase 未配置
 */
export const getSupabase = (): SupabaseClient => {
  if (!supabase) {
    throw new Error('Supabase 未配置，请检查环境变量 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY');
  }
  return supabase;
};
