import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import StageScript from './components/StageScript';
import StageAssets from './components/StageAssets';
import StageDirector from './components/StageDirector';
import StageExport from './components/StageExport';
import StagePrompts from './components/StagePrompts';
import StageSeries from './components/StageSeries';
import Dashboard from './components/Dashboard';
import Onboarding, { shouldShowOnboarding, resetOnboarding } from './components/Onboarding';
import ModelConfigModal from './components/ModelConfig';
import LoginPage from './components/Auth/LoginPage';
import { ProjectStage, ProjectState, WorkflowStage } from './types';
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
  const migrationPromptedProjectIdRef = useRef<string | null>(null);

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
          if (prev.formatVersion === 'v2' && prev.series?.activeEpisodeId) {
            const episodeId = prev.series.activeEpisodeId;
            const episode = prev.series.episodes[episodeId];
            if (!episode) return prev;
            return {
              ...prev,
              series: {
                ...prev.series,
                episodes: {
                  ...prev.series.episodes,
                  [episodeId]: {
                    ...episode,
                    renderLogs: [...(episode.renderLogs || []), log],
                    lastModified: Date.now(),
                  },
                },
              },
              lastModified: Date.now(),
            };
          }
          return { ...prev, renderLogs: [...(prev.renderLogs || []), log], lastModified: Date.now() };
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

  const setStage = (stage: ProjectStage) => {
    if (isGenerating) {
      showAlert('当前正在执行生成任务（剧本分镜 / 首帧 / 视频等），切换页面会导致生成数据丢失，且已扣除的费用无法恢复。\n\n确定要离开当前页面吗？', {
        title: '生成任务进行中',
        type: 'warning',
        showCancel: true,
        confirmText: '确定离开',
        cancelText: '继续等待',
        onConfirm: () => {
          setIsGenerating(false);
          updateProject((prev) => {
            if (prev.formatVersion === 'v2' && prev.series?.activeEpisodeId && stage !== 'series') {
              const episodeId = prev.series.activeEpisodeId;
              const episode = prev.series.episodes[episodeId];
              if (!episode) return { ...prev, stage: 'series' };
              return {
                ...prev,
                stage,
                series: {
                  ...prev.series,
                  episodes: {
                    ...prev.series.episodes,
                    [episodeId]: { ...episode, stage, lastModified: Date.now() },
                  },
                },
                lastModified: Date.now(),
              };
            }
            if (prev.formatVersion === 'v2' && stage !== 'series' && !prev.series?.activeEpisodeId) {
              return { ...prev, stage: 'series', lastModified: Date.now() };
            }
            return { ...prev, stage, lastModified: Date.now() };
          });
        }
      });
      return;
    }
    updateProject((prev) => {
      if (prev.formatVersion === 'v2' && prev.series?.activeEpisodeId && stage !== 'series') {
        const episodeId = prev.series.activeEpisodeId;
        const episode = prev.series.episodes[episodeId];
        if (!episode) return { ...prev, stage: 'series' };
        return {
          ...prev,
          stage,
          series: {
            ...prev.series,
            episodes: { ...prev.series.episodes, [episodeId]: { ...episode, stage, lastModified: Date.now() } },
          },
          lastModified: Date.now(),
        };
      }
      if (prev.formatVersion === 'v2' && stage !== 'series' && !prev.series?.activeEpisodeId) {
        return { ...prev, stage: 'series', lastModified: Date.now() };
      }
      return { ...prev, stage, lastModified: Date.now() };
    });
  };

  const handleOpenProject = (proj: ProjectState) => {
    setProject(proj);
  };

  useEffect(() => {
    if (!project) return;
    if (project.formatVersion === 'v2') return;
    if (project.migrationPreference === 'stay_legacy' || project.migrationPreference === 'migrated') return;
    if (migrationPromptedProjectIdRef.current === project.id) return;
    migrationPromptedProjectIdRef.current = project.id;

    showAlert('是否将现有项目迁移到新版大项目管理功能？\n\n迁移后会自动创建第一季与第一集，并保留你迁移前的编辑器内容。', {
      title: '升级提示',
      type: 'info',
      showCancel: true,
      confirmText: '是',
      cancelText: '留在旧版',
      onConfirm: () => {
        setProject((prev) => {
          if (!prev) return prev;
          if (prev.formatVersion === 'v2') return prev;
          const now = Date.now();
          const seasonId = 'season_' + now.toString(36) + '_' + Math.random().toString(36).slice(2, 8);
          const episodeId = 'ep_' + now.toString(36) + '_' + Math.random().toString(36).slice(2, 8);
          const sharedLibrary = prev.scriptData
            ? { characters: prev.scriptData.characters || [], scenes: prev.scriptData.scenes || [], props: prev.scriptData.props || [] }
            : { characters: [], scenes: [], props: [] };
          const episode = {
            id: episodeId,
            title: '第1集',
            createdAt: now,
            lastModified: now,
            stage: prev.stage === 'series' ? 'script' : (prev.stage as WorkflowStage),
            rawScript: prev.rawScript,
            targetDuration: prev.targetDuration,
            language: prev.language,
            visualStyle: prev.visualStyle,
            shotGenerationModel: prev.shotGenerationModel,
            scriptData: prev.scriptData,
            shots: prev.shots,
            isParsingScript: prev.isParsingScript,
            renderLogs: prev.renderLogs || [],
            usedCharacterIds: sharedLibrary.characters.map((c) => c.id),
            usedSceneIds: sharedLibrary.scenes.map((s) => s.id),
            usedPropIds: sharedLibrary.props.map((p) => p.id),
          };
          return {
            ...prev,
            stage: 'series',
            formatVersion: 'v2',
            migrationPreference: 'migrated',
            sharedLibrary,
            series: {
              seasons: [{ id: seasonId, title: '第一季', createdAt: now, episodeIds: [episodeId] }],
              episodes: { [episodeId]: episode },
              activeEpisodeId: episodeId,
              expandedSeasonIds: [seasonId],
            },
            lastModified: now,
          };
        });
      },
      onCancel: () => {
        setProject((prev) => {
          if (!prev) return prev;
          if (prev.formatVersion === 'v2') return prev;
          return { ...prev, migrationPreference: 'stay_legacy', lastModified: Date.now() };
        });
      },
    });
  }, [project?.id]);

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
    const isV2 = project.formatVersion === 'v2' && !!project.series;
    const activeEpisodeId = project.series?.activeEpisodeId;
    const activeEpisode = isV2 && activeEpisodeId ? project.series?.episodes[activeEpisodeId] : undefined;
    const sharedLibrary = project.sharedLibrary || { characters: [], scenes: [], props: [] };
    const effectiveProject: ProjectState =
      isV2 && project.stage !== 'series' && activeEpisode
        ? {
            ...project,
            stage: activeEpisode.stage,
            rawScript: activeEpisode.rawScript,
            targetDuration: activeEpisode.targetDuration,
            language: activeEpisode.language,
            visualStyle: activeEpisode.visualStyle,
            shotGenerationModel: activeEpisode.shotGenerationModel,
            scriptData: activeEpisode.scriptData
              ? {
                  ...activeEpisode.scriptData,
                  characters: sharedLibrary.characters,
                  scenes: sharedLibrary.scenes,
                  props: sharedLibrary.props,
                }
              : {
                  title: activeEpisode.title,
                  genre: '',
                  logline: '',
                  targetDuration: activeEpisode.targetDuration,
                  language: activeEpisode.language,
                  visualStyle: activeEpisode.visualStyle,
                  shotGenerationModel: activeEpisode.shotGenerationModel,
                  characters: sharedLibrary.characters,
                  scenes: sharedLibrary.scenes,
                  props: sharedLibrary.props,
                  storyParagraphs: [],
                },
            shots: activeEpisode.shots,
            isParsingScript: activeEpisode.isParsingScript,
            renderLogs: activeEpisode.renderLogs,
          }
        : project;

    const updateEffectiveProject = (updates: Partial<ProjectState> | ((prev: ProjectState) => ProjectState)) => {
      if (!isV2 || project.stage === 'series' || !activeEpisodeId || !activeEpisode) {
        updateProject(updates);
        return;
      }
      updateProject((prev) => {
        if (prev.formatVersion !== 'v2' || !prev.series) return prev;
        const episode = prev.series.episodes[activeEpisodeId];
        if (!episode) return { ...prev, stage: 'series', lastModified: Date.now() };

        const baseEffective: ProjectState = {
          ...prev,
          stage: episode.stage,
          rawScript: episode.rawScript,
          targetDuration: episode.targetDuration,
          language: episode.language,
          visualStyle: episode.visualStyle,
          shotGenerationModel: episode.shotGenerationModel,
          scriptData: episode.scriptData
            ? {
                ...episode.scriptData,
                characters: (prev.sharedLibrary || { characters: [], scenes: [], props: [] }).characters,
                scenes: (prev.sharedLibrary || { characters: [], scenes: [], props: [] }).scenes,
                props: (prev.sharedLibrary || { characters: [], scenes: [], props: [] }).props,
              }
            : {
                title: episode.title,
                genre: '',
                logline: '',
                targetDuration: episode.targetDuration,
                language: episode.language,
                visualStyle: episode.visualStyle,
                shotGenerationModel: episode.shotGenerationModel,
                characters: (prev.sharedLibrary || { characters: [], scenes: [], props: [] }).characters,
                scenes: (prev.sharedLibrary || { characters: [], scenes: [], props: [] }).scenes,
                props: (prev.sharedLibrary || { characters: [], scenes: [], props: [] }).props,
                storyParagraphs: [],
              },
          shots: episode.shots,
          isParsingScript: episode.isParsingScript,
          renderLogs: episode.renderLogs,
        };

        const nextEffective =
          typeof updates === 'function' ? updates(baseEffective) : ({ ...baseEffective, ...updates } as ProjectState);

        const prevLibrary = prev.sharedLibrary || { characters: [], scenes: [], props: [] };
        const incomingScriptData = nextEffective.scriptData;

        const charIdMap: Record<string, string> = {};
        const sceneIdMap: Record<string, string> = {};
        const propIdMap: Record<string, string> = {};

        const mergedCharacters = [...prevLibrary.characters];
        const charIndexById = new Map(mergedCharacters.map((c, i) => [c.id, i]));
        const charByName = new Map(mergedCharacters.map((c) => [c.name?.trim(), c] as const).filter(([k]) => !!k));

        const mergedScenes = [...prevLibrary.scenes];
        const sceneIndexById = new Map(mergedScenes.map((s, i) => [s.id, i]));
        const sceneByKey = new Map(
          mergedScenes
            .map((s) => [`${s.location?.trim() || ''}__${s.time?.trim() || ''}`, s] as const)
            .filter(([k]) => k !== '__')
        );

        const mergedProps = [...prevLibrary.props];
        const propIndexById = new Map(mergedProps.map((p, i) => [p.id, i]));
        const propByName = new Map(mergedProps.map((p) => [p.name?.trim(), p] as const).filter(([k]) => !!k));

        if (incomingScriptData) {
          for (const c of incomingScriptData.characters || []) {
            const existingIndex = charIndexById.get(c.id);
            if (existingIndex !== undefined) {
              mergedCharacters[existingIndex] = c;
              charIdMap[c.id] = c.id;
              continue;
            }
            const key = c.name?.trim();
            const byName = key ? charByName.get(key) : undefined;
            if (byName) {
              charIdMap[c.id] = byName.id;
              continue;
            }
            mergedCharacters.push(c);
            charIndexById.set(c.id, mergedCharacters.length - 1);
            if (key) charByName.set(key, c);
            charIdMap[c.id] = c.id;
          }

          for (const s of incomingScriptData.scenes || []) {
            const existingIndex = sceneIndexById.get(s.id);
            if (existingIndex !== undefined) {
              mergedScenes[existingIndex] = s;
              sceneIdMap[s.id] = s.id;
              continue;
            }
            const key = `${s.location?.trim() || ''}__${s.time?.trim() || ''}`;
            const byKey = key !== '__' ? sceneByKey.get(key) : undefined;
            if (byKey) {
              sceneIdMap[s.id] = byKey.id;
              continue;
            }
            mergedScenes.push(s);
            sceneIndexById.set(s.id, mergedScenes.length - 1);
            if (key !== '__') sceneByKey.set(key, s);
            sceneIdMap[s.id] = s.id;
          }

          for (const p of incomingScriptData.props || []) {
            const existingIndex = propIndexById.get(p.id);
            if (existingIndex !== undefined) {
              mergedProps[existingIndex] = p;
              propIdMap[p.id] = p.id;
              continue;
            }
            const key = p.name?.trim();
            const byName = key ? propByName.get(key) : undefined;
            if (byName) {
              propIdMap[p.id] = byName.id;
              continue;
            }
            mergedProps.push(p);
            propIndexById.set(p.id, mergedProps.length - 1);
            if (key) propByName.set(key, p);
            propIdMap[p.id] = p.id;
          }
        }

        const nextSharedLibrary = { characters: mergedCharacters, scenes: mergedScenes, props: mergedProps };
        const nextEpisodeScriptData = incomingScriptData
          ? {
              ...incomingScriptData,
              characters: mergedCharacters,
              scenes: mergedScenes,
              props: mergedProps,
              storyParagraphs: (incomingScriptData.storyParagraphs || []).map((p) => ({
                ...p,
                sceneRefId: sceneIdMap[p.sceneRefId] || p.sceneRefId,
              })),
            }
          : episode.scriptData;

        const nextShots = (nextEffective.shots || []).map((shot) => {
          const nextSceneId = sceneIdMap[shot.sceneId] || shot.sceneId;
          const nextCharacters = Array.from(
            new Set((shot.characters || []).map((id) => charIdMap[id] || id).filter(Boolean))
          );
          const nextProps = shot.props ? Array.from(new Set(shot.props.map((id) => propIdMap[id] || id).filter(Boolean))) : undefined;
          const nextVariations = shot.characterVariations
            ? Object.fromEntries(
                Object.entries(shot.characterVariations).map(([k, v]) => [charIdMap[k] || k, v] as const)
              )
            : undefined;
          return {
            ...shot,
            sceneId: nextSceneId,
            characters: nextCharacters,
            props: nextProps,
            characterVariations: nextVariations,
          };
        });

        return {
          ...prev,
          title: nextEffective.title,
          stage: nextEffective.stage,
          sharedLibrary: nextSharedLibrary,
          series: {
            ...prev.series,
            episodes: {
              ...prev.series.episodes,
              [activeEpisodeId]: {
                ...episode,
                stage: nextEffective.stage as WorkflowStage,
                rawScript: nextEffective.rawScript,
                targetDuration: nextEffective.targetDuration,
                language: nextEffective.language,
                visualStyle: nextEffective.visualStyle,
                shotGenerationModel: nextEffective.shotGenerationModel,
                scriptData: nextEpisodeScriptData,
                shots: nextShots,
                isParsingScript: nextEffective.isParsingScript,
                renderLogs: nextEffective.renderLogs,
                lastModified: Date.now(),
              },
            },
          },
          lastModified: Date.now(),
        };
      });
    };

    switch (project.stage) {
      case 'series':
        return (
          <StageSeries
            project={project}
            updateProject={updateProject}
            onOpenEpisode={(episodeId) => {
              setProject((prev) => {
                if (!prev || !prev.series) return prev;
                const ep = prev.series.episodes[episodeId];
                if (!ep) return prev;
                return {
                  ...prev,
                  stage: ep.stage as WorkflowStage,
                  series: { ...prev.series, activeEpisodeId: episodeId },
                  lastModified: Date.now(),
                };
              });
            }}
          />
        );
      case 'script':
        return (
          <StageScript
            project={effectiveProject}
            updateProject={updateEffectiveProject}
            onShowModelConfig={handleShowModelConfig}
            onGeneratingChange={setIsGenerating}
          />
        );
      case 'assets':
        return <StageAssets project={effectiveProject} updateProject={updateEffectiveProject} onGeneratingChange={setIsGenerating} />;
      case 'director':
        return <StageDirector project={effectiveProject} updateProject={updateEffectiveProject} onGeneratingChange={setIsGenerating} />;
      case 'export':
        return <StageExport project={effectiveProject} />;
      case 'prompts':
        return <StagePrompts project={effectiveProject} updateProject={updateEffectiveProject} />;
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
        showSeries={project.formatVersion === 'v2'}
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
