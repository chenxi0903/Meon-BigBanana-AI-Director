/**
 * Supabase 客户端初始化
 * 使用 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY 环境变量
 * 
 * 修改说明 (2025-03-12):
 * 1. 引入 js-cookie 实现自定义 Storage Adapter
 * 2. 将 Session 存储位置从 localStorage 迁移到 Cookie
 * 3. 设置 Cookie Domain 为顶级域名 (.meonai.art) 以支持跨域 SSO
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Cookies from 'js-cookie';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Supabase] 缺少环境变量 VITE_SUPABASE_URL 或 VITE_SUPABASE_ANON_KEY，云端同步功能不可用。'
  );
}

/**
 * 动态获取 Cookie 作用域
 * 本地开发时返回 undefined (host-only cookie)，生产环境使用顶级域名 .meonai.art
 */
const getCookieDomain = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // 本地开发时不设置 domain
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return undefined;
    }
    // 线上环境设置为顶级域名，注意前面的点
    return '.meonai.art'; 
  }
  return undefined;
};

/**
 * 自定义 Cookie Storage 适配器
 * 用于替代默认的 localStorage，支持跨子域共享 Session
 */
const cookieStorage = {
  getItem: (key: string) => {
    return Cookies.get(key) ?? null;
  },
  setItem: (key: string, value: string) => {
    // 移除之前的 localStorage 数据（可选，避免混淆）
    if (typeof window !== 'undefined') {
      localStorage.removeItem(key);
    }
    
    const domain = getCookieDomain();
    
    Cookies.set(key, value, {
      domain: domain, // 如果是 undefined，js-cookie 不会设置 Domain 属性
      path: '/',
      sameSite: 'Lax',
      secure: window.location.protocol === 'https:', // 根据当前协议判断是否开启 Secure
      expires: 365, // 设置合理的过期时间
    });
  },
  removeItem: (key: string) => {
    const domain = getCookieDomain();
    Cookies.remove(key, {
      domain: domain,
      path: '/',
    });
  },
};

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
          storage: cookieStorage, // 使用自定义 Cookie Storage
          flowType: 'pkce',      // 使用 PKCE 流程增强安全性
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
