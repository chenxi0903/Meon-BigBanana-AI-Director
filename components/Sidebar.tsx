import React from 'react';
import { FileText, Users, Clapperboard, Film, ChevronLeft, ListTree, HelpCircle, Cpu, Sun, Moon, Loader2 } from 'lucide-react';
import logoImg from '../meon_logo.svg';
import { useTheme } from '../contexts/ThemeContext';

interface SidebarProps {
  currentStage: string;
  setStage: (stage: 'script' | 'assets' | 'director' | 'export' | 'prompts') => void;
  onExit: () => void;
  projectName?: string;
  // Added props for series info
  seasonName?: string;
  episodeName?: string;
  onShowOnboarding?: () => void;
  onShowModelConfig?: () => void;
  isNavigationLocked?: boolean;
  onUpgradeProject?: () => void; // New prop for upgrade action
  enableFixedSceneMode?: boolean; // 新增：是否开启固定场景模式
  onToggleFixedSceneSidebar?: () => void; // 新增：打开固定场景侧边栏
}

const Sidebar: React.FC<SidebarProps> = ({ 
  currentStage, 
  setStage, 
  onExit, 
  projectName, 
  seasonName, 
  episodeName, 
  onShowOnboarding, 
  onShowModelConfig, 
  isNavigationLocked, 
  onUpgradeProject,
  enableFixedSceneMode,
  onToggleFixedSceneSidebar
}) => {
  const { theme, toggleTheme } = useTheme();
  const navItems = [
    { id: 'script', label: '剧本与故事', icon: FileText, sub: 'Phase 01' },
    // 根据固定场景模式开关决定是否显示“空间与状态”
    ...(enableFixedSceneMode ? [{ id: 'fixed-scene', label: '空间与状态 (BETA)', icon: ListTree, sub: 'Phase 01.5' }] : []),
    { id: 'assets', label: '角色与场景', icon: Users, sub: 'Phase 02' },
    { id: 'director', label: '导演工作台', icon: Clapperboard, sub: 'Phase 03' },
    { id: 'export', label: '成片与导出', icon: Film, sub: 'Phase 04' },
    { id: 'prompts', label: '提示词管理', icon: ListTree, sub: 'Advanced' },
  ];

  const handleUpgradeProject = () => {
    if (onExit) {
      // Trigger the upgrade flow by "opening" the current project again
      // The parent component (App.tsx) handles the migration check in handleOpenProject
      // But here we need a way to trigger that. 
      // Since Sidebar doesn't have direct access to handleOpenProject, we can simulate it 
      // or we might need to add a specific prop for upgrade.
      // Alternatively, we can just use onExit to go back to dashboard and let user re-open it.
      // But for a better UX, we should probably add an onUpgrade prop.
      // For now, let's assume the user needs to go back to dashboard to upgrade.
      // Wait, the requirement says "Upgrade your project to the new workbench".
      // Let's add a specific prop for this action.
    }
  };

  // Check if project is in legacy mode (single project type or undefined type)
  // We can infer this if seasonName and episodeName are undefined, but that's not 100% accurate.
  // Ideally, we should pass 'isLegacyProject' prop.
  // For this task, I'll add the button unconditionally if it's a legacy project context,
  // but since I don't have isLegacyProject prop, I'll assume if season/episode are missing it MIGHT be legacy,
  // OR we can just add the button and let the parent handle visibility.
  // The user request says "In the project location that has not been upgraded to the new classification".
  // This implies we should show it when the project is NOT a series.
  
  return (
    <aside className="w-72 bg-[var(--bg-base)] border-r border-[var(--border-primary)] h-screen fixed left-0 top-0 flex flex-col z-50 select-none">
      {/* Header */}
      <div className="p-6 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-3 mb-6 group cursor-default">
          <img src="/logo.ico" alt="Logo" className="w-8 h-8 flex-shrink-0 transition-transform group-hover:scale-110" />
        </div>

        <button 
          onClick={onExit}
          className={`flex items-center gap-2 transition-colors text-xs font-mono uppercase tracking-wide group ${
            isNavigationLocked 
              ? 'text-[var(--text-muted)] opacity-50 cursor-not-allowed' 
              : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
          }`}
          title={isNavigationLocked ? '生成任务进行中，退出将导致数据丢失' : undefined}
        >
          <ChevronLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" />
          返回项目列表
        </button>
      </div>

      {/* Project Status */}
      <div className="px-6 py-4 border-b border-[var(--border-subtle)]">
         <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest mb-1">当前项目</div>
         <div className="text-sm font-medium text-[var(--text-secondary)] truncate font-mono mb-1">{projectName || '未命名项目'}</div>
         {(seasonName || episodeName) ? (
            <div className="flex items-center gap-2 text-[10px] text-[var(--text-tertiary)] font-mono">
               {seasonName && <span className="bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded border border-[var(--border-primary)]">{seasonName}</span>}
               {episodeName && <span className="bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded border border-[var(--border-primary)]">{episodeName}</span>}
            </div>
         ) : (
            onUpgradeProject && (
              <button 
                onClick={onUpgradeProject}
                className="mt-2 text-[10px] text-[#FF9422] hover:text-[#FF9422]/80 font-bold uppercase tracking-widest flex items-center gap-1.5 transition-colors group/upgrade"
              >
                升级至新版工作台
                <ChevronLeft className="w-3 h-3 rotate-180 group-hover/upgrade:translate-x-0.5 transition-transform" />
              </button>
            )
         )}
      </div>

      {/* Generation Lock Indicator */}
      {isNavigationLocked && (
        <div className="mx-4 mt-4 px-3 py-2.5 rounded-lg bg-[var(--warning)]/10 border border-[var(--warning)]/30">
          <div className="flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 text-[var(--warning)] animate-spin flex-shrink-0" />
            <span className="text-[10px] font-medium text-[var(--warning)] uppercase tracking-wide">生成任务进行中</span>
          </div>
          <p className="text-[10px] text-[var(--text-muted)] mt-1 leading-relaxed">
            切换页面将导致数据丢失
          </p>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 py-6 space-y-1">
        {navItems.map((item) => {
          const isActive = currentStage === item.id;
          const isLocked = isNavigationLocked && !isActive;
          
          if (item.id === 'fixed-scene') {
            return (
              <button
                key={item.id}
                onClick={onToggleFixedSceneSidebar}
                className={`w-full flex items-center justify-between px-6 py-4 transition-all duration-200 group relative border-l-2 border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--nav-hover-bg)]`}
              >
                <div className="flex items-center gap-3">
                  <item.icon className={`w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]`} />
                  <span className="font-medium text-xs tracking-wider uppercase">{item.label}</span>
                </div>
                <span className={`text-[10px] font-mono text-[var(--text-muted)]`}>{item.sub}</span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => setStage(item.id as any)}
              className={`w-full flex items-center justify-between px-6 py-4 transition-all duration-200 group relative border-l-2 ${
                isActive 
                  ? 'border-[var(--text-primary)] bg-[var(--nav-active-bg)] text-[var(--text-primary)]'
                  : isLocked
                    ? 'border-transparent text-[var(--text-muted)] opacity-50 cursor-not-allowed'
                    : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--nav-hover-bg)]'
              }`}
              title={isLocked ? '生成任务进行中，切换页面将导致数据丢失' : undefined}
            >
              <div className="flex items-center gap-3">
                <item.icon className={`w-4 h-4 ${isActive ? 'text-[var(--text-primary)]' : isLocked ? 'text-[var(--text-muted)]' : 'text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]'}`} />
                <span className="font-medium text-xs tracking-wider uppercase">{item.label}</span>
              </div>
              <span className={`text-[10px] font-mono ${isActive ? 'text-[var(--text-tertiary)]' : 'text-[var(--text-muted)]'}`}>{item.sub}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-6 border-t border-[var(--border-subtle)] space-y-4">
        <button 
          onClick={toggleTheme}
          className="w-full flex items-center justify-between text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
          title={theme === 'dark' ? '切换亮色主题' : '切换暗色主题'}
        >
          <span className="font-mono text-[10px] uppercase tracking-widest">{theme === 'dark' ? '亮色主题' : '暗色主题'}</span>
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        {onShowOnboarding && (
          <button 
            onClick={onShowOnboarding}
            className="w-full flex items-center justify-between text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
          >
            <span className="font-mono text-[10px] uppercase tracking-widest">新手引导</span>
            <HelpCircle className="w-4 h-4" />
          </button>
        )}
        {onShowModelConfig && (
          <button 
            onClick={onShowModelConfig}
            className="w-full flex items-center justify-between text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
          >
            <span className="font-mono text-[10px] uppercase tracking-widest">模型配置</span>
            <Cpu className="w-4 h-4" />
          </button>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;