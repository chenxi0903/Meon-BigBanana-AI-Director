/**
 * 认证上下文
 * 管理用户认证状态，提供 useAuth hook
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { isSupabaseConfigured } from '../services/supabase/client';
import {
  signUp as authSignUp,
  signIn as authSignIn,
  signOut as authSignOut,
  signInWithOAuth as authSignInWithOAuth,
  onAuthStateChange,
  getSession,
  getUserProfile,
  UserProfile,
  AuthResult,
} from '../services/supabase/authService';
import { initializeCloudSync } from '../services/modelRegistry';
import { initializePromptCache, clearPromptCache } from '../services/promptManager';

// ============================================
// 类型定义
// ============================================

interface AuthContextValue {
  /** 当前用户 */
  user: User | null;
  /** 当前会话 */
  session: Session | null;
  /** 用户 Profile */
  profile: UserProfile | null;
  /** 是否正在加载认证状态 */
  loading: boolean;
  /** Supabase 是否已配置 */
  isConfigured: boolean;
  /** 注册 */
  signUp: (email: string, password: string, displayName?: string) => Promise<AuthResult>;
  /** 登录 */
  signIn: (email: string, password: string) => Promise<AuthResult>;
  /** OAuth 登录 */
  signInWithOAuth: (provider: 'github' | 'google') => Promise<AuthResult>;
  /** 登出 */
  signOut: () => Promise<AuthResult>;
  /** 刷新 Profile */
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ============================================
// Provider 组件
// ============================================

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const isConfigured = isSupabaseConfigured();

  // 加载用户 Profile
  const loadProfile = useCallback(async (userId: string) => {
    const p = await getUserProfile(userId);
    setProfile(p);
  }, []);

  // 初始化：获取当前会话
  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }

    let mounted = true;

    const init = async () => {
      try {
        const currentSession = await getSession();
        if (mounted) {
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
          
          // 初始化云端同步
          initializeCloudSync(currentSession?.user?.id ?? null);
          
          // 初始化提示词缓存
          if (currentSession?.user) {
            initializePromptCache(currentSession.user.id);
          } else {
            clearPromptCache();
          }

          if (currentSession?.user) {
            await loadProfile(currentSession.user.id);
          }
        }
      } catch (err) {
        console.error('初始化认证状态失败:', err);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    init();

    // 监听认证状态变化
    const unsubscribe = onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        loadProfile(newSession.user.id);
        initializePromptCache(newSession.user.id); // 更新提示词缓存
      } else {
        setProfile(null);
        clearPromptCache(); // 清除提示词缓存
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [isConfigured, loadProfile]);

  // 封装认证方法
  const signUp = useCallback(
    async (email: string, password: string, displayName?: string) => {
      return authSignUp(email, password, displayName);
    },
    []
  );

  const signIn = useCallback(async (email: string, password: string) => {
    return authSignIn(email, password);
  }, []);

  const signInWithOAuth = useCallback(async (provider: 'github' | 'google') => {
    return authSignInWithOAuth(provider);
  }, []);

  const signOut = useCallback(async () => {
    const result = await authSignOut();
    if (result.success) {
      setUser(null);
      setSession(null);
      setProfile(null);
      clearPromptCache(); // 清除提示词缓存
    }
    return result;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await loadProfile(user.id);
    }
  }, [user, loadProfile]);

  const value: AuthContextValue = {
    user,
    session,
    profile,
    loading,
    isConfigured,
    signUp,
    signIn,
    signInWithOAuth,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ============================================
// Hook
// ============================================

/**
 * 获取认证上下文
 * @throws 如果在 AuthProvider 外部使用
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
