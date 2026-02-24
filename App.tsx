import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import StageScript from './components/StageScript';
import StageAssets from './components/StageAssets';
import StageDirector from './components/StageDirector';
import StageExport from './components/StageExport';
import StagePrompts from './components/StagePrompts';
import Dashboard from './components/Dashboard';
import Onboarding, { shouldShowOnboarding, resetOnboarding } from './components/Onboarding';
import ModelConfigModal from './components/ModelConfig';
import LoginPage from './components/Auth/LoginPage';
import { ProjectState } from './types';
import { Save, CheckCircle, X, Loader2 } from 'lucide-react';
import { saveProjectToDB } from './services/storageService';
import { setGlobalApiKey } from './services/aiService';
import { setLogCallback, clearLogCallback } from './services/renderLogService';
import { useAlert } from './components/GlobalAlert';
import { useAuth } from './contexts/AuthContext';
import logoImg from './logo.png';

function App() {
  const { user, loading: authLoading, isConfigured: isSupabaseConfigured } = useAuth();
  const { showAlert } = useAlert();
  const [project, setProject] = useState<ProjectState | null>(null);
  const [apiKey, setApiKey] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [showSaveStatus, setShowSaveStatus] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showModelConfig, setShowModelConfig] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Ref to hold debounce timer
  const saveTimeoutRef = useRef<any>(null);
  const hideStatusTimeoutRef = useRef<any>(null);

  // Detect mobile device on mount
  useEffect(() => {
    const checkMobile = () => {
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 1024;
      setIsMobile(isMobileDevice);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load API Key from localStorage on mount
  useEffect(() => {
    const storedKey = localStorage.getItem('antsk_api_key');
    if (storedKey) {
      setApiKey(storedKey);
      setGlobalApiKey(storedKey);
    }
    // 检查是否需要显示首次引导（无论有没有 API Key）
    if (shouldShowOnboarding()) {
      setShowOnboarding(true);
    }
  }, []);

  // 处理引导完成
  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
  };

  // 处理快速开始选项
  const handleOnboardingQuickStart = (option: 'script' | 'example') => {
    setShowOnboarding(false);
    // 如果选择"从剧本开始"，可以后续扩展为创建新项目
    // 如果选择"看看示例项目"，可以后续扩展为打开示例项目
    console.log('Quick start option:', option);
  };

  // 重新显示引导（供帮助菜单调用）
  const handleShowOnboarding = () => {
    resetOnboarding();
    setShowOnboarding(true);
  };

  // 保存 API Key（从设置或引导中）
  const handleSaveApiKey = (key: string) => {
    if (key) {
      setApiKey(key);
      setGlobalApiKey(key);
      localStorage.setItem('antsk_api_key', key);
    } else {
      setApiKey('');
      setGlobalApiKey('');
      localStorage.removeItem('antsk_api_key');
    }
  };

  // 显示模型配置弹窗
  const handleShowModelConfig = () => {
    setShowModelConfig(true);
  };

  // Global error handler to catch API Key errors
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      // Check if error is related to API Key
      if (event.error?.name === 'ApiKeyError' || 
          event.error?.message?.includes('API Key missing') ||
          event.error?.message?.includes('AntSK API Key')) {
        console.warn('🔐 检测到 API Key 错误，请配置 API Key...');
        setShowModelConfig(true); // 打开模型配置弹窗让用户配置
        event.preventDefault(); // Prevent default error display
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      // Check if rejection is related to API Key
      if (event.reason?.name === 'ApiKeyError' ||
          event.reason?.message?.includes('API Key missing') ||
          event.reason?.message?.includes('AntSK API Key')) {
        console.warn('🔐 检测到 API Key 错误，请配置 API Key...');
        setShowModelConfig(true); // 打开模型配置弹窗让用户配置
        event.preventDefault(); // Prevent default error display
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Setup render log callback
  useEffect(() => {
    if (project) {
      setLogCallback((log) => {
        setProject(prev => {
          if (!prev) return null;
          return {
            ...prev,
            renderLogs: [...(prev.renderLogs || []), log]
          };
        });
      });
    } else {
      clearLogCallback();
    }
    
    return () => clearLogCallback();
  }, [project?.id]); // Re-setup when project changes

  // Auto-save logic
  useEffect(() => {
    if (!project) return;

    setSaveStatus('unsaved');
    setShowSaveStatus(true);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        await saveProjectToDB(project);
        setSaveStatus('saved');
      } catch (e) {
        console.error("Auto-save failed", e);
      }
    }, 1000); // Debounce 1s

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [project]);

  // Auto-hide save status after 2 seconds
  useEffect(() => {
    if (saveStatus === 'saved') {
      if (hideStatusTimeoutRef.current) clearTimeout(hideStatusTimeoutRef.current);
      hideStatusTimeoutRef.current = setTimeout(() => {
        setShowSaveStatus(false);
      }, 2000);
    } else if (saveStatus === 'saving') {
      setShowSaveStatus(true);
      if (hideStatusTimeoutRef.current) clearTimeout(hideStatusTimeoutRef.current);
    }

    return () => {
      if (hideStatusTimeoutRef.current) clearTimeout(hideStatusTimeoutRef.current);
    };
  }, [saveStatus]);


  const updateProject = (updates: Partial<ProjectState> | ((prev: ProjectState) => ProjectState)) => {
    if (!project) return;
    setProject(prev => {
      if (!prev) return null;
      // 支持函数式更新
      if (typeof updates === 'function') {
        return updates(prev);
      }
      return { ...prev, ...updates };
    });
  };

  const setStage = (stage: 'script' | 'assets' | 'director' | 'export' | 'prompts') => {
    if (isGenerating) {
      showAlert('当前正在执行生成任务（剧本分镜 / 首帧 / 视频等），切换页面会导致生成数据丢失，且已扣除的费用无法恢复。\n\n确定要离开当前页面吗？', {
        title: '生成任务进行中',
        type: 'warning',
        showCancel: true,
        confirmText: '确定离开',
        cancelText: '继续等待',
        onConfirm: () => {
          setIsGenerating(false);
          updateProject({ stage });
        }
      });
      return;
    }
    updateProject({ stage });
  };

  const handleOpenProject = (proj: ProjectState) => {
    setProject(proj);
  };

  const handleExitProject = async () => {
    if (isGenerating) {
      showAlert('当前正在执行生成任务（剧本分镜 / 首帧 / 视频等），退出项目会导致生成数据丢失，且已扣除的费用无法恢复。\n\n确定要退出吗？', {
        title: '生成任务进行中',
        type: 'warning',
        showCancel: true,
        confirmText: '确定退出',
        cancelText: '继续等待',
        onConfirm: async () => {
          setIsGenerating(false);
          if (project) {
            await saveProjectToDB(project);
          }
          setProject(null);
        }
      });
      return;
    }
    // Force save before exiting
    if (project) {
        await saveProjectToDB(project);
    }
    setProject(null);
  };

  const renderStage = () => {
    if (!project) return null;
    switch (project.stage) {
      case 'script':
        return (
          <StageScript
            project={project}
            updateProject={updateProject}
            onShowModelConfig={handleShowModelConfig}
            onGeneratingChange={setIsGenerating}
          />
        );
      case 'assets':
        return <StageAssets project={project} updateProject={updateProject} onGeneratingChange={setIsGenerating} />;
      case 'director':
        return <StageDirector project={project} updateProject={updateProject} onGeneratingChange={setIsGenerating} />;
      case 'export':
        return <StageExport project={project} />;
      case 'prompts':
        return <StagePrompts project={project} updateProject={updateProject} />;
      default:
        return <div className="text-[var(--text-primary)]">未知阶段</div>;
    }
  };

  // Auth Loading Screen
  if (isSupabaseConfigured && authLoading) {
    return (
      <div className="h-screen bg-[var(--bg-base)] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 text-[var(--text-muted)] animate-spin mx-auto" />
          <p className="text-sm text-[var(--text-tertiary)]">加载中...</p>
        </div>
      </div>
    );
  }

  // Auth Gate: require login when Supabase is configured
  if (isSupabaseConfigured && !user) {
    return <LoginPage />;
  }

  // Mobile Warning Screen
  if (isMobile) {
    return (
      <div className="h-screen bg-[var(--bg-base)] flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-6">
          <img src={logoImg} alt="Logo" className="w-20 h-20 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">BigBanana AI Director</h1>
          <div className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl p-8">
            <p className="text-[var(--text-tertiary)] text-base leading-relaxed mb-4">
              为了获得最佳体验，请使用 PC 端浏览器访问。
            </p>
            <p className="text-[var(--text-muted)] text-sm">
              本应用需要较大的屏幕空间和桌面级浏览器环境才能正常运行。
            </p>
          </div>
          <div className="text-xs text-[var(--text-muted)]">
            <a href="https://director.tree456.com/" target="_blank" rel="noreferrer" className="hover:text-[var(--accent-text)] transition-colors">
              访问产品首页了解更多
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard View
  if (!project) {
    return (
       <>
         <Dashboard 
           onOpenProject={handleOpenProject} 
           onShowOnboarding={handleShowOnboarding}
           onShowModelConfig={handleShowModelConfig}
         />
         {showOnboarding && (
           <Onboarding 
             onComplete={handleOnboardingComplete}
             onQuickStart={handleOnboardingQuickStart}
             currentApiKey={apiKey}
             onSaveApiKey={handleSaveApiKey}
           />
         )}
         <ModelConfigModal
           isOpen={showModelConfig}
           onClose={() => setShowModelConfig(false)}
         />
       </>
    );
  }

  // Workspace View
  return (
    <div className="flex h-screen bg-[var(--bg-secondary)] font-sans text-[var(--text-secondary)] selection:bg-[var(--accent-bg)]">
      <Sidebar 
        currentStage={project.stage} 
        setStage={setStage} 
        onExit={handleExitProject} 
        projectName={project.title}
        onShowOnboarding={handleShowOnboarding}
        onShowModelConfig={() => setShowModelConfig(true)}
        isNavigationLocked={isGenerating}
      />
      
      <main className="ml-72 flex-1 h-screen overflow-hidden relative">
        {renderStage()}
        
        {/* Save Status Indicator */}
        {showSaveStatus && (
          <div className="absolute top-4 right-6 pointer-events-none flex items-center gap-2 text-xs font-mono text-[var(--text-tertiary)] bg-[var(--overlay-medium)] px-2 py-1 rounded-full backdrop-blur-sm z-50 animate-in fade-in slide-in-from-top-2 duration-200">
             {saveStatus === 'saving' ? (
               <>
                 <Save className="w-3 h-3 animate-pulse" />
                 保存中...
               </>
             ) : (
               <>
                 <CheckCircle className="w-3 h-3 text-[var(--success)]" />
                 已保存
               </>
             )}
          </div>
        )}
      </main>

      {/* Onboarding Modal */}
      {showOnboarding && (
        <Onboarding 
          onComplete={handleOnboardingComplete}
          onQuickStart={handleOnboardingQuickStart}
          currentApiKey={apiKey}
          onSaveApiKey={handleSaveApiKey}
        />
      )}

      {/* Model Config Modal */}
      <ModelConfigModal
        isOpen={showModelConfig}
        onClose={() => setShowModelConfig(false)}
      />
    </div>
  );
}

export default App;