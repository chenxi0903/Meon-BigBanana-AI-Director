/**
 * 登录/注册页面
 * 支持邮箱密码登录和注册
 */

import React, { useState } from 'react';
import { Loader2, Mail, Lock, User, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import logoImg from '../../meon_logo.svg';

type AuthMode = 'login' | 'register';

const LoginPage: React.FC = () => {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setIsLoading(true);

    try {
      if (mode === 'login') {
        const result = await signIn(email, password);
        if (!result.success) {
          setError(result.message);
        }
      } else {
        if (password.length < 6) {
          setError('密码长度至少 6 位');
          setIsLoading(false);
          return;
        }
        const result = await signUp(email, password, displayName || undefined);
        if (result.success) {
          setSuccessMessage(result.message);
          // 如果注册成功且不需要邮箱确认，自动切换到登录
          if (result.user?.confirmed_at) {
            setMode('login');
          }
        } else {
          setError(result.message);
        }
      }
    } catch (err: any) {
      setError(err.message || '操作失败');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError('');
    setSuccessMessage('');
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo & Title */}
        <div className="text-center mb-10">
          <img src={logoImg} alt="Logo" className="w-16 h-16 mx-auto mb-4" />
          <h1 className="text-2xl font-light text-[var(--text-primary)] tracking-tight mb-1">
            Meon
          </h1>
          <p className="text-xs text-[var(--text-muted)] font-mono uppercase tracking-widest">
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-[var(--bg-primary)] border border-[var(--border-primary)] p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Display Name (register only) */}
            {mode === 'register' && (
              <div>
                <label className="block text-[10px] text-[var(--text-tertiary)] font-mono uppercase tracking-widest mb-2">
                  昵称（可选）
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="输入昵称"
                    className="w-full pl-10 pr-4 py-3 bg-[var(--bg-surface)] border border-[var(--border-primary)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-text)] transition-colors"
                  />
                </div>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-[10px] text-[var(--text-tertiary)] font-mono uppercase tracking-widest mb-2">
                邮箱
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-[var(--bg-surface)] border border-[var(--border-primary)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-text)] transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-[10px] text-[var(--text-tertiary)] font-mono uppercase tracking-widest mb-2">
                密码
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? '至少 6 位' : '输入密码'}
                  required
                  minLength={mode === 'register' ? 6 : undefined}
                  className="w-full pl-10 pr-12 py-3 bg-[var(--bg-surface)] border border-[var(--border-primary)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-text)] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--text-tertiary)] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-2 p-3 bg-[var(--error-hover-bg)] border border-[var(--error-border)] text-[var(--error-text)] text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Success Message */}
            {successMessage && (
              <div className="flex items-start gap-2 p-3 bg-[var(--success)]/10 border border-[var(--success)]/30 text-[var(--success)] text-xs">
                <span>{successMessage}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover)] disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-widest"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {mode === 'login' ? '登录中...' : '注册中...'}
                </>
              ) : (
                mode === 'login' ? '登录' : '注册'
              )}
            </button>
          </form>

          {/* Toggle Mode */}
          <div className="mt-6 text-center">
            <button
              onClick={toggleMode}
              className="text-xs text-[var(--text-tertiary)] hover:text-[var(--accent-text)] transition-colors"
            >
              {mode === 'login' ? '没有账户？点击注册' : '已有账户？点击登录'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-[9px] text-[var(--text-muted)] font-mono uppercase tracking-widest">
          Meon &copy; {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
