import React, { useMemo, useState } from 'react';
import { ChevronDown, Plus, Trash2, X, AlertTriangle, ChevronRight } from 'lucide-react';
import { EpisodeState, ProjectState, SeriesSeason } from '../../types';

interface Props {
  project: ProjectState;
  updateProject: (updates: Partial<ProjectState> | ((prev: ProjectState) => ProjectState)) => void;
  onOpenEpisode: (episodeId: string) => void;
}

type DeleteModalState =
  | { isOpen: false }
  | {
      isOpen: true;
      type: 'season' | 'episode';
      seasonId: string;
      episodeId?: string;
      title: string;
    };

const formatDate = (ts: number) => {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${day}`;
};

const createSeason = (title: string): SeriesSeason => {
  return {
    id: 'season_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8),
    title,
    createdAt: Date.now(),
    episodeIds: [],
  };
};

const createEpisode = (episodeTitle: string): EpisodeState => {
  return {
    id: 'ep_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8),
    title: episodeTitle,
    createdAt: Date.now(),
    lastModified: Date.now(),
    stage: 'script',
    rawScript: '',
    targetDuration: '60s',
    language: '中文',
    visualStyle: 'live-action',
    shotGenerationModel: 'gpt-5.1',
    scriptData: null,
    shots: [],
    isParsingScript: false,
    renderLogs: [],
    usedCharacterIds: [],
    usedSceneIds: [],
    usedPropIds: [],
  };
};

const StageSeries: React.FC<Props> = ({ project, updateProject, onOpenEpisode }) => {
  const series = project.series;
  const seasons = series?.seasons || [];
  const episodes = series?.episodes || {};
  const expandedSeasonIds = series?.expandedSeasonIds || [];

  const [isCreatingSeason, setIsCreatingSeason] = useState(false);
  const [newSeasonTitle, setNewSeasonTitle] = useState('');
  const [deleteModal, setDeleteModal] = useState<DeleteModalState>({ isOpen: false });

  const totalEpisodes = useMemo(() => {
    return seasons.reduce((acc, s) => acc + (s.episodeIds?.length || 0), 0);
  }, [seasons]);

  const toggleExpand = (seasonId: string) => {
    updateProject((prev) => {
      if (!prev.series) return prev;
      const nextExpanded = prev.series.expandedSeasonIds || [];
      const isExpanded = nextExpanded.includes(seasonId);
      return {
        ...prev,
        series: {
          ...prev.series,
          expandedSeasonIds: isExpanded ? nextExpanded.filter((id) => id !== seasonId) : [...nextExpanded, seasonId],
        },
        lastModified: Date.now(),
      };
    });
  };

  const handleCreateSeason = () => {
    const title = newSeasonTitle.trim();
    if (!title) return;
    const season = createSeason(title);
    updateProject((prev) => {
      const prevSeries = prev.series || { seasons: [], episodes: {}, expandedSeasonIds: [], activeEpisodeId: undefined };
      return {
        ...prev,
        stage: 'series',
        formatVersion: 'v2',
        migrationPreference: prev.migrationPreference || 'migrated',
        sharedLibrary: prev.sharedLibrary || { characters: [], scenes: [], props: [] },
        series: {
          ...prevSeries,
          seasons: [...prevSeries.seasons, season],
          expandedSeasonIds: [...(prevSeries.expandedSeasonIds || []), season.id],
        },
        lastModified: Date.now(),
      };
    });
    setNewSeasonTitle('');
    setIsCreatingSeason(false);
  };

  const handleAddEpisode = (seasonId: string) => {
    updateProject((prev) => {
      if (!prev.series) return prev;
      const seasonIndex = prev.series.seasons.findIndex((s) => s.id === seasonId);
      if (seasonIndex === -1) return prev;
      const season = prev.series.seasons[seasonIndex];
      const nextIndex = (season.episodeIds?.length || 0) + 1;
      const episode = createEpisode(`第${nextIndex}集`);
      const nextSeasons = [...prev.series.seasons];
      nextSeasons[seasonIndex] = {
        ...season,
        episodeIds: [...(season.episodeIds || []), episode.id],
      };
      const nextExpanded = prev.series.expandedSeasonIds || [];
      return {
        ...prev,
        series: {
          ...prev.series,
          seasons: nextSeasons,
          episodes: { ...prev.series.episodes, [episode.id]: episode },
          expandedSeasonIds: nextExpanded.includes(seasonId) ? nextExpanded : [...nextExpanded, seasonId],
        },
        lastModified: Date.now(),
      };
    });
  };

  const requestDeleteSeason = (e: React.MouseEvent, season: SeriesSeason) => {
    e.stopPropagation();
    setDeleteModal({ isOpen: true, type: 'season', seasonId: season.id, title: season.title });
  };

  const requestDeleteEpisode = (e: React.MouseEvent, seasonId: string, episode: EpisodeState) => {
    e.stopPropagation();
    setDeleteModal({ isOpen: true, type: 'episode', seasonId, episodeId: episode.id, title: episode.title });
  };

  const confirmDelete = () => {
    if (!deleteModal.isOpen) return;
    updateProject((prev) => {
      if (!prev.series) return prev;
      const nextSeries = { ...prev.series };
      if (deleteModal.type === 'season') {
        const season = nextSeries.seasons.find((s) => s.id === deleteModal.seasonId);
        const deleteEpisodeIds = season?.episodeIds || [];
        nextSeries.seasons = nextSeries.seasons.filter((s) => s.id !== deleteModal.seasonId);
        nextSeries.expandedSeasonIds = (nextSeries.expandedSeasonIds || []).filter((id) => id !== deleteModal.seasonId);
        const nextEpisodes = { ...nextSeries.episodes };
        for (const epId of deleteEpisodeIds) {
          delete nextEpisodes[epId];
        }
        nextSeries.episodes = nextEpisodes;
        if (deleteEpisodeIds.includes(nextSeries.activeEpisodeId || '')) {
          nextSeries.activeEpisodeId = undefined;
          return { ...prev, stage: 'series', series: nextSeries, lastModified: Date.now() };
        }
      } else {
        const seasonIndex = nextSeries.seasons.findIndex((s) => s.id === deleteModal.seasonId);
        if (seasonIndex !== -1) {
          const season = nextSeries.seasons[seasonIndex];
          nextSeries.seasons = [...nextSeries.seasons];
          nextSeries.seasons[seasonIndex] = {
            ...season,
            episodeIds: (season.episodeIds || []).filter((id) => id !== deleteModal.episodeId),
          };
        }
        const nextEpisodes = { ...nextSeries.episodes };
        if (deleteModal.episodeId) {
          delete nextEpisodes[deleteModal.episodeId];
        }
        nextSeries.episodes = nextEpisodes;
        if (deleteModal.episodeId && nextSeries.activeEpisodeId === deleteModal.episodeId) {
          nextSeries.activeEpisodeId = undefined;
          return { ...prev, stage: 'series', series: nextSeries, lastModified: Date.now() };
        }
      }
      return { ...prev, series: nextSeries, lastModified: Date.now() };
    });
    setDeleteModal({ isOpen: false });
  };

  const closeDeleteModal = () => setDeleteModal({ isOpen: false });

  const renderDeleteModal = () => {
    if (!deleteModal.isOpen) return null;
    const isSeason = deleteModal.type === 'season';
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
        <div className="w-full max-w-md bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[var(--warning)]" />
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">警告</h3>
            </div>
            <button
              onClick={closeDeleteModal}
              className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4 space-y-3">
            <p className="text-sm text-[var(--text-secondary)]">
              确定要删除「{deleteModal.title}」吗？
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              {isSeason ? '删除剧集将同时删除其所有集数，且无法恢复。' : '删除集数后无法恢复。'}
            </p>
            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={closeDeleteModal}
                className="px-3 py-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                取消
              </button>
              <button
                onClick={confirmDelete}
                className="px-3 py-2 rounded-lg bg-[var(--error)] text-xs text-white hover:opacity-90 transition-opacity"
              >
                确定删除
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full overflow-y-auto bg-[var(--bg-secondary)]">
      <div className="max-w-6xl mx-auto px-8 py-10">
        <div className="flex items-start justify-between gap-6 mb-8">
          <div>
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-mono mb-2">项目管理</div>
            <h2 className="text-2xl font-semibold text-[var(--text-primary)]">大项目管理</h2>
            <p className="text-sm text-[var(--text-tertiary)] mt-2">创建剧集与集数，并进入每一集独立创作。</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCreatingSeason(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--accent-bg)] text-[var(--accent-text)] text-xs font-medium hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" />
              新建剧集
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl p-5">
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-mono">剧集</div>
            <div className="text-2xl font-semibold text-[var(--text-primary)] mt-2">{seasons.length}</div>
          </div>
          <div className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl p-5">
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-mono">总集数</div>
            <div className="text-2xl font-semibold text-[var(--text-primary)] mt-2">{totalEpisodes}</div>
          </div>
        </div>

        <div className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl p-6 mb-8">
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-mono mb-4">快速开始</div>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
              <div className="text-xs font-medium text-[var(--text-primary)] mb-2">1. 创建剧集</div>
              <div className="text-xs text-[var(--text-tertiary)]">先给你的剧集起一个名字。</div>
            </div>
            <div className="p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
              <div className="text-xs font-medium text-[var(--text-primary)] mb-2">2. 创建集数</div>
              <div className="text-xs text-[var(--text-tertiary)]">点击“创建第一集”或“+”添加集。</div>
            </div>
            <div className="p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
              <div className="text-xs font-medium text-[var(--text-primary)] mb-2">3. 开始创作</div>
              <div className="text-xs text-[var(--text-tertiary)]">点击集数进入编辑器开始创作。</div>
            </div>
          </div>
        </div>

        {isCreatingSeason && (
          <div className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl p-6 mb-8">
            <div className="text-sm font-semibold text-[var(--text-primary)] mb-4">新建剧集</div>
            <div className="flex gap-3">
              <input
                value={newSeasonTitle}
                onChange={(e) => setNewSeasonTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateSeason();
                  if (e.key === 'Escape') {
                    setIsCreatingSeason(false);
                    setNewSeasonTitle('');
                  }
                }}
                placeholder="输入剧集名称..."
                className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-secondary)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
                autoFocus
              />
              <button
                onClick={handleCreateSeason}
                className="px-4 py-2 rounded-lg bg-[var(--accent-bg)] text-[var(--accent-text)] text-sm font-medium hover:opacity-90 transition-opacity"
              >
                创建
              </button>
              <button
                onClick={() => {
                  setIsCreatingSeason(false);
                  setNewSeasonTitle('');
                }}
                className="px-4 py-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        )}

        <div className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl overflow-hidden">
          <div className="p-6 border-b border-[var(--border-subtle)]">
            <div className="text-sm font-semibold text-[var(--text-primary)]">剧集管理</div>
          </div>
          <div className="divide-y divide-[var(--border-subtle)]">
            {seasons.length === 0 ? (
              <div className="p-10 text-center">
                <div className="text-sm text-[var(--text-tertiary)] mb-3">还没有剧集</div>
                <button
                  onClick={() => setIsCreatingSeason(true)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  新建第一个剧集
                </button>
              </div>
            ) : (
              seasons.map((season) => {
                const isExpanded = expandedSeasonIds.includes(season.id);
                const seasonEpisodes = (season.episodeIds || []).map((id) => episodes[id]).filter(Boolean) as EpisodeState[];
                return (
                  <div key={season.id}>
                    <button
                      onClick={() => toggleExpand(season.id)}
                      className="w-full flex items-center justify-between px-6 py-4 hover:bg-[var(--bg-secondary)] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <ChevronDown
                          className={`w-4 h-4 text-[var(--text-muted)] transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`}
                        />
                        <div className="text-sm font-medium text-[var(--text-primary)]">{season.title}</div>
                        <div className="text-xs text-[var(--text-muted)] font-mono">{seasonEpisodes.length} 集</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddEpisode(season.id);
                          }}
                          className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                          title="添加新集"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => requestDeleteSeason(e, season)}
                          className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--bg-hover)] transition-colors"
                          title="删除剧集"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-6 pb-5">
                        {seasonEpisodes.length === 0 ? (
                          <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl p-6 text-center">
                            <div className="text-sm text-[var(--text-tertiary)] mb-3">暂无集数</div>
                            <button
                              onClick={() => handleAddEpisode(season.id)}
                              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--accent-bg)] text-[var(--accent-text)] text-xs font-medium hover:opacity-90 transition-opacity"
                            >
                              <Plus className="w-4 h-4" />
                              创建第一集
                            </button>
                          </div>
                        ) : (
                          <div className="mt-2 space-y-2">
                            {seasonEpisodes.map((ep, idx) => {
                              const isActive = series?.activeEpisodeId === ep.id && project.stage !== 'series';
                              return (
                                <button
                                  key={ep.id}
                                  onClick={() => onOpenEpisode(ep.id)}
                                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
                                    isActive
                                      ? 'bg-[var(--nav-active-bg)] border-[var(--border-primary)]'
                                      : 'bg-[var(--bg-secondary)] border-[var(--border-subtle)] hover:bg-[var(--bg-hover)]'
                                  }`}
                                >
                                  <div className="flex items-center gap-4 min-w-0">
                                    <div className="w-10 h-10 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] flex items-center justify-center text-xs font-mono text-[var(--text-tertiary)] flex-shrink-0">
                                      {idx + 1}
                                    </div>
                                    <div className="min-w-0 text-left">
                                      <div className="text-sm font-medium text-[var(--text-primary)] truncate">{ep.title}</div>
                                      <div className="text-xs text-[var(--text-muted)] font-mono mt-1">
                                        {ep.stage === 'script'
                                          ? '剧本阶段'
                                          : ep.stage === 'assets'
                                            ? '资产阶段'
                                            : ep.stage === 'director'
                                              ? '导演阶段'
                                              : ep.stage === 'export'
                                                ? '导出阶段'
                                                : '提示词阶段'}
                                        <span className="mx-2 opacity-50">·</span>
                                        {formatDate(ep.lastModified || ep.createdAt)}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={(e) => requestDeleteEpisode(e, season.id, ep)}
                                      className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--bg-primary)] transition-colors"
                                      title="删除集数"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                    <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                                  </div>
                                </button>
                              );
                            })}
                            <button
                              onClick={() => handleAddEpisode(season.id)}
                              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-[var(--border-primary)] bg-transparent text-xs text-[var(--text-tertiary)] hover:bg-[var(--bg-secondary)] transition-colors"
                            >
                              <Plus className="w-4 h-4" />
                              添加新集
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
      {renderDeleteModal()}
    </div>
  );
};

export default StageSeries;

