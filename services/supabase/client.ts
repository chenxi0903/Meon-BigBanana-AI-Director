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
    
    // 设置 Cookie
    // 注意：supabase-js 会频繁调用 setItem，包括 refresh_token 更新时
    Cookies.set(key, value, {
      domain: domain, 
      path: '/',
      sameSite: 'Lax',
      secure: window.location.protocol === 'https:',
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
 * 监听 TOKEN_REFRESHED 事件，确保 Cookie 被正确更新
 * 有时自动刷新后，js-cookie 可能没有及时同步，这里加一层保险
 */
if (supabase) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'TOKEN_REFRESHED' && session) {
      // 强制更新 Cookie，防止过期
      const key = `sb-${new URL(supabaseUrl!).hostname.split('.')[0]}-auth-token`;
      // 注意：这里我们无法直接获取内部使用的 key 名称，
      // 但 supabase-js 会在内部调用 storage.setItem，所以通常不需要手动干预。
      // 如果仍然出现登出问题，可能是因为多标签页导致旧 Token 覆盖了新 Token。
      // 在这里打印日志以便调试
      console.log('[Auth] Token Refreshed', session.expires_at);
    }
    if (event === 'SIGNED_OUT') {
       // 确保彻底清除
       const domain = getCookieDomain();
       // 清除可能存在的残留
       Object.keys(Cookies.get()).forEach(cookieName => {
         if (cookieName.startsWith('sb-')) {
            Cookies.remove(cookieName, { domain, path: '/' });
         }
       });
    }
  });
}

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
