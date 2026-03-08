import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import StageScript from './components/StageScript';
import StageAssets from './components/StageAssets';
import StageDirector from './components/StageDirector';
import StageExport from './components/StageExport';
import StagePrompts from './components/StagePrompts';
import Dashboard from './components/Dashboard';
import SeriesManager from './components/SeriesManager';
import Onboarding, { shouldShowOnboarding, resetOnboarding } from './components/Onboarding';
import ModelConfigModal from './components/ModelConfig';
import LoginPage from './components/Auth/LoginPage';
import { ProjectState, Season, Episode } from './types';
import { Save, CheckCircle, X, Loader2 } from 'lucide-react';
import { saveProjectToDB } from './services/storageService';
import { setLogCallback, clearLogCallback } from './services/renderLogService';
import { useAlert } from './components/GlobalAlert';
import { useAuth } from './contexts/AuthContext';
import logoImg from './meon_logo.svg';
// Import prompt sync utility to make it available globally
import './services/supabase/promptSync';

function App() {
  const { user, loading: authLoading, isConfigured: isSupabaseConfigured } = useAuth();
  const { showAlert } = useAlert();
  const [project, setProject] = useState<ProjectState | null>(null);
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
    // 检查是否需要显示首次引导
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
      
      // Calculate new state
      const newState = typeof updates === 'function' ? updates(prev) : { ...prev, ...updates };

      // SYNC LOGIC: If in Series Mode and inside an Episode, sync changes back to the specific episode slot
      if (newState.type === 'series' && newState.activeEpisodeId && newState.seriesData) {
          const seasons = newState.seriesData.seasons.map(season => {
              const episodeIndex = season.episodes.findIndex(e => e.id === newState.activeEpisodeId);
              if (episodeIndex !== -1) {
                  const updatedEpisode: Episode = {
                      ...season.episodes[episodeIndex],
                      scriptData: newState.scriptData,
                      shots: newState.shots,
                      stage: newState.stage,
                      renderLogs: newState.renderLogs,
                      rawScript: newState.rawScript,
                      lastModified: Date.now()
                  };
                  return {
                      ...season,
                      episodes: [
                          ...season.episodes.slice(0, episodeIndex),
                          updatedEpisode,
                          ...season.episodes.slice(episodeIndex + 1)
                      ]
                  };
              }
              return season;
          });
          
          // Sync Shared Assets (Additive Only - Ensure independence)
          let newSharedAssets = { ...newState.seriesData.sharedAssets };
          if (newState.scriptData) {
               // Characters: Add new ones, don't overwrite existing
               const currentChars = newState.scriptData.characters || [];
               const sharedChars = [...(newSharedAssets.characters || [])];
               currentChars.forEach(c => {
                   // Check by ID first, then Name
                   if (!sharedChars.some(sc => sc.id === c.id || sc.name === c.name)) {
                       sharedChars.push(c);
                   }
               });
               newSharedAssets.characters = sharedChars;

               // Scenes: Add new ones
               const currentScenes = newState.scriptData.scenes || [];
               const sharedScenes = [...(newSharedAssets.scenes || [])];
               currentScenes.forEach(s => {
                   if (!sharedScenes.some(ss => ss.id === s.id || (ss.location === s.location && ss.time === s.time))) {
                       sharedScenes.push(s);
                   }
               });
               newSharedAssets.scenes = sharedScenes;
               
               // Props: Add new ones
               const currentProps = newState.scriptData.props || [];
               const sharedProps = [...(newSharedAssets.props || [])];
               currentProps.forEach(p => {
                   if (!sharedProps.some(sp => sp.id === p.id || sp.name === p.name)) {
                       sharedProps.push(p);
                   }
               });
               newSharedAssets.props = sharedProps;
          }

          return {
              ...newState,
              seriesData: {
                  ...newState.seriesData,
                  seasons: seasons,
                  sharedAssets: newSharedAssets
              }
          };
      }
      
      return newState;
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
    if (!proj.type) {
        // Migration Check
        showAlert('是否将现有项目迁移到新版大项目管理功能？', {
            title: '功能升级',
            type: 'info',
            showCancel: true,
            confirmText: '升级到多剧集模式',
            cancelText: '保持旧版',
            onConfirm: () => {
                // Migrate to Series
                const episode1: Episode = {
                    id: Date.now().toString(),
                    title: '第1集',
                    createdAt: proj.createdAt,
                    lastModified: proj.lastModified,
                    stage: proj.stage,
                    scriptData: proj.scriptData,
                    shots: proj.shots,
                    renderLogs: proj.renderLogs || [],
                    rawScript: proj.rawScript,
                    status: 'scripting'
                };
                
                const season1: Season = {
                    id: (Date.now() + 1).toString(),
                    title: '第一季',
                    episodes: [episode1],
                    createdAt: Date.now()
                };

                const sharedAssets = {
                    characters: proj.scriptData?.characters || [],
                    scenes: proj.scriptData?.scenes || [],
                    props: proj.scriptData?.props || []
                };

                const newProj: ProjectState = {
                    ...proj,
                    type: 'series',
                    seriesData: {
                        seasons: [season1],
                        sharedAssets: sharedAssets
                    },
                    // activeEpisodeId is undefined, so SeriesManager will show
                };
                setProject(newProj);
                saveProjectToDB(newProj);
            },
            onCancel: () => {
                // Keep as Single
                const newProj: ProjectState = { ...proj, type: 'single' };
                setProject(newProj);
                saveProjectToDB(newProj);
            }
        });
    } else {
        setProject(proj);
    }
  };

  const handleEnterEpisode = (episodeId: string) => {
    if (!project || !project.seriesData) return;

    // Find the episode
    let targetEpisode: Episode | undefined;
    for (const season of project.seriesData.seasons) {
        const ep = season.episodes.find(e => e.id === episodeId);
        if (ep) {
            targetEpisode = ep;
            break;
        }
    }

    if (targetEpisode) {
        // Hydrate root fields with episode data
        // NOTE: We do NOT automatically merge sharedAssets here to ensure episode independence.
        // Shared assets are only pulled in during script parsing or explicit import.
        
        const scriptData = targetEpisode.scriptData || {
            title: targetEpisode.title,
            genre: '',
            logline: '',
            characters: [], 
            scenes: [],
            props: [],
            storyParagraphs: []
        };

        setProject({
             ...project,
             activeEpisodeId: episodeId,
             stage: targetEpisode.stage,
             scriptData: scriptData,
             shots: targetEpisode.shots,
             renderLogs: targetEpisode.renderLogs,
             rawScript: targetEpisode.rawScript
         });
    }
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
          
          if (project?.type === 'series' && project.activeEpisodeId) {
             setProject(prev => prev ? ({ ...prev, activeEpisodeId: undefined }) : null);
          } else {
             setProject(null);
          }
        }
      });
      return;
    }
    // Force save before exiting
    if (project) {
        await saveProjectToDB(project);
    }
    
    if (project?.type === 'series' && project.activeEpisodeId) {
        setProject(prev => prev ? ({ ...prev, activeEpisodeId: undefined }) : null);
    } else {
        setProject(null);
    }
  };

  const handleUpgradeProject = () => {
    if (!project) return;
    
    showAlert('是否将现有项目迁移到新版大项目管理功能？', {
        title: '功能升级',
        type: 'info',
        showCancel: true,
        confirmText: '升级到多剧集模式',
        cancelText: '取消',
        onConfirm: () => {
            // Migrate to Series
            const episode1: Episode = {
                id: Date.now().toString(),
                title: '第1集',
                createdAt: project.createdAt,
                lastModified: project.lastModified,
                stage: project.stage,
                scriptData: project.scriptData,
                shots: project.shots,
                renderLogs: project.renderLogs || [],
                rawScript: project.rawScript,
                status: 'scripting'
            };
            
            const season1: Season = {
                id: (Date.now() + 1).toString(),
                title: '第一季',
                episodes: [episode1],
                createdAt: Date.now()
            };

            const sharedAssets = {
                characters: project.scriptData?.characters || [],
                scenes: project.scriptData?.scenes || [],
                props: project.scriptData?.props || []
            };

            const newProj: ProjectState = {
                ...project,
                type: 'series',
                seriesData: {
                    seasons: [season1],
                    sharedAssets: sharedAssets
                },
                activeEpisodeId: episode1.id // Stay in current episode context
            };
            
            setProject(newProj);
            saveProjectToDB(newProj);
            showAlert('项目已成功升级到多剧集模式！', { type: 'success' });
        }
    });
  };

  const renderStage = () => {
    if (!project) return null;
    
    // Series Manager View
    if (project.type === 'series' && !project.activeEpisodeId) {
        return (
            <SeriesManager 
                project={project} 
                updateProject={updateProject} 
                onEnterEpisode={handleEnterEpisode}
                onBackToDashboard={handleExitProject}
            />
        );
    }

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
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Meon</h1>
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
  const isSeriesManagerMode = project.type === 'series' && !project.activeEpisodeId;

  return (
    <div className="flex h-screen bg-[var(--bg-secondary)] font-sans text-[var(--text-secondary)] selection:bg-[var(--accent-bg)]">
      {!isSeriesManagerMode && (
          <Sidebar 
            currentStage={project.stage} 
            setStage={setStage} 
            onExit={handleExitProject} 
            projectName={project.title}
            seasonName={project.seriesData?.seasons.find(s => s.episodes.some(e => e.id === project.activeEpisodeId))?.title}
            episodeName={project.seriesData?.seasons.flatMap(s => s.episodes).find(e => e.id === project.activeEpisodeId)?.title}
            onShowOnboarding={handleShowOnboarding}
            onShowModelConfig={() => setShowModelConfig(true)}
            isNavigationLocked={isGenerating}
            onUpgradeProject={project.type !== 'series' ? handleUpgradeProject : undefined}
          />
      )}
      
      <main className={`flex-1 h-screen relative ${isSeriesManagerMode ? 'w-full overflow-y-auto' : 'ml-72 overflow-hidden'}`}>
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