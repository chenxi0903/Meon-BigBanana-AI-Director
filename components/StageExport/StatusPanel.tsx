import React from 'react';
import { Film, CheckCircle, BarChart3 } from 'lucide-react';
import { ProjectState } from '../../types';
import { STYLES } from './constants';

interface Props {
  project: ProjectState;
  progress: number;
  estimatedDuration: number;
}

const StatusPanel: React.FC<Props> = ({ project, progress, estimatedDuration }) => {
  // Find Series Info if available
  const activeEpisodeId = project.activeEpisodeId;
  let seasonTitle = '';
  let episodeTitle = '';

  if (activeEpisodeId && project.seriesData) {
      for (const season of project.seriesData.seasons) {
          const ep = season.episodes.find(e => e.id === activeEpisodeId);
          if (ep) {
              seasonTitle = season.title;
              episodeTitle = ep.title;
              break;
          }
      }
  }

  return (
    <div className={STYLES.statusPanel.container}>
      {/* Background Decoration */}
      <div className={STYLES.statusPanel.decoration.top}></div>
      <div className={STYLES.statusPanel.decoration.bottom}></div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 relative z-10 gap-6">
        <div>
          <div className="flex flex-col gap-1 mb-2">
            <h3 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] tracking-tight flex items-baseline gap-3">
              {project.title || '未命名项目'}
              {seasonTitle && episodeTitle && (
                  <span className="text-sm font-normal text-[var(--text-tertiary)] font-mono tracking-wide">
                      {seasonTitle} {episodeTitle}
                  </span>
              )}
            </h3>
            <span className="inline-block px-2 py-0.5 w-fit bg-[var(--bg-elevated)] border border-[var(--border-secondary)] text-[var(--text-tertiary)] text-[10px] rounded uppercase font-mono tracking-wider">
              Master Sequence
            </span>
          </div>
          <div className="flex items-center gap-6 mt-3">
            <div className={STYLES.statusPanel.stat}>
              <span className={STYLES.statusPanel.statLabel}>Shots</span>
              <span className={STYLES.statusPanel.statValue}>{project.shots.length}</span>
            </div>
            <div className="w-px h-6 bg-[var(--bg-hover)]"></div>
            <div className={STYLES.statusPanel.stat}>
              <span className={STYLES.statusPanel.statLabel}>Est. Duration</span>
              <span className={STYLES.statusPanel.statValue}>~{estimatedDuration}s</span>
            </div>
            <div className="w-px h-6 bg-[var(--bg-hover)]"></div>
            <div className={STYLES.statusPanel.stat}>
              <span className={STYLES.statusPanel.statLabel}>Target</span>
              <span className={STYLES.statusPanel.statValue}>{project.targetDuration}</span>
            </div>
          </div>
        </div>
        
        <div className={STYLES.statusPanel.progressBadge}>
          <div className="flex items-baseline justify-end gap-1 mb-1">
            <span className="text-3xl font-mono font-bold text-[var(--accent-text)]">{progress}</span>
            <span className="text-sm text-[var(--text-tertiary)]">%</span>
          </div>
          <div className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-widest flex items-center justify-end gap-2">
            {progress === 100 ? <CheckCircle className="w-3 h-3 text-[var(--success)]" /> : <BarChart3 className="w-3 h-3" />}
            Render Status
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatusPanel;
