/**
 * Supabase 认证服务
 * 封装 signUp / signIn / signOut / onAuthStateChange 等认证操作
 */

import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from './client';

// ============================================
// 类型定义
// ============================================

export interface AuthResult {
  success: boolean;
  message: string;
  user?: User | null;
}

export interface UserProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// 认证操作
// ============================================

/**
 * 邮箱密码注册
 */
export const signUp = async (
  email: string,
  password: string,
  displayName?: string
): Promise<AuthResult> => {
  if (!supabase) {
    return { success: false, message: 'Supabase 未配置' };
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName || email.split('@')[0],
        },
      },
    });

    if (error) {
      return { success: false, message: error.message };
    }

    return {
      success: true,
      message: data.user?.identities?.length === 0
        ? '该邮箱已注册，请直接登录'
        : '注册成功！请检查邮箱确认链接（如已启用邮箱确认）',
      user: data.user,
    };
  } catch (err: any) {
    return { success: false, message: err.message || '注册失败' };
  }
};

/**
 * 邮箱密码登录
 */
export const signIn = async (
  email: string,
  password: string
): Promise<AuthResult> => {
  if (!supabase) {
    return { success: false, message: 'Supabase 未配置' };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { success: false, message: error.message };
    }

    return {
      success: true,
      message: '登录成功',
      user: data.user,
    };
  } catch (err: any) {
    return { success: false, message: err.message || '登录失败' };
  }
};

/**
 * OAuth 第三方登录（GitHub / Google 等）
 */
export const signInWithOAuth = async (
  provider: 'github' | 'google'
): Promise<AuthResult> => {
  if (!supabase) {
    return { success: false, message: 'Supabase 未配置' };
  }

  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      return { success: false, message: error.message };
    }

    // OAuth 会重定向，不会走到这里
    return { success: true, message: '正在跳转到登录页面...' };
  } catch (err: any) {
    return { success: false, message: err.message || '第三方登录失败' };
  }
};

/**
 * 登出
 */
export const signOut = async (): Promise<AuthResult> => {
  if (!supabase) {
    return { success: false, message: 'Supabase 未配置' };
  }

  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true, message: '已退出登录' };
  } catch (err: any) {
    return { success: false, message: err.message || '登出失败' };
  }
};

/**
 * 获取当前会话
 */
export const getSession = async (): Promise<Session | null> => {
  if (!supabase) return null;

  try {
    const { data } = await supabase.auth.getSession();
    return data.session;
  } catch {
    return null;
  }
};

/**
 * 获取当前用户
 */
export const getCurrentUser = async (): Promise<User | null> => {
  if (!supabase) return null;

  try {
    const { data } = await supabase.auth.getUser();
    return data.user;
  } catch {
    return null;
  }
};

/**
 * 监听认证状态变化
 * @returns 取消订阅函数
 */
export const onAuthStateChange = (
  callback: (event: AuthChangeEvent, session: Session | null) => void
): (() => void) => {
  if (!supabase) {
    return () => {};
  }

  const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
  return () => subscription.unsubscribe();
};

// ============================================
// Profile 操作
// ============================================

/**
 * 获取用户 Profile
 */
export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('获取用户 Profile 失败:', error);
      return null;
    }

    return data as UserProfile;
  } catch {
    return null;
  }
};

/**
 * 更新用户 Profile
 */
export const updateUserProfile = async (
  userId: string,
  updates: { display_name?: string; avatar_url?: string }
): Promise<boolean> => {
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      console.error('更新用户 Profile 失败:', error);
      return false;
    }

    return true;
  } catch {
    return false;
  }
};

/**
 * 发送密码重置邮件
 */
export const resetPassword = async (email: string): Promise<AuthResult> => {
  if (!supabase) {
    return { success: false, message: 'Supabase 未配置' };
  }

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true, message: '密码重置邮件已发送，请查收' };
  } catch (err: any) {
    return { success: false, message: err.message || '发送失败' };
  }
};
