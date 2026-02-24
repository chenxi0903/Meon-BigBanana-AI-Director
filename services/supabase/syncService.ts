/**
 * 同步引擎
 * 实现 IndexedDB ↔ Supabase 的混合同步：
 * - 正常在线时实时同步（debounced）
 * - 离线时本地保存，上线后自动合并
 * 
 * 减压策略：
 * - Debounced Write: 2 秒防抖
 * - Dirty Tracking: 只同步变更的数据
 * - 增量媒体同步: 只上传新增/变更的媒体文件
 * - lastModified 比较: 跳过未变化的数据
 * - 离线队列: 离线操作进队列
 * - 指数退避: 同步失败时退避重试
 */

import { ProjectState, AssetLibraryItem, Character, Scene, Prop, Shot, Keyframe } from '../../types';
import { supabase, isSupabaseConfigured } from './client';
import {
  uploadMedia,
  deleteProjectMedia,
  isBase64DataUrl,
  MediaType,
  clearUploadCache,
} from './mediaStorage';

// ============================================
// 类型定义
// ============================================

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

type SyncListener = (status: SyncStatus) => void;

interface PendingSync {
  type: 'upsert_project' | 'delete_project' | 'upsert_asset' | 'delete_asset';
  id: string;
  data?: any;
  timestamp: number;
}

// ============================================
// 状态管理
// ============================================

let currentStatus: SyncStatus = 'idle';
let isOnline = navigator.onLine;
const listeners: Set<SyncListener> = new Set();
const dirtyProjects: Set<string> = new Set();
const pendingQueue: PendingSync[] = [];
const syncTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

// 退避状态
let consecutiveErrors = 0;
const MAX_RETRIES = 5;
const BASE_DELAY = 2000;

// ============================================
// 事件监听
// ============================================

/**
 * 订阅同步状态变化
 */
export function subscribeSyncStatus(listener: SyncListener): () => void {
  listeners.add(listener);
  listener(currentStatus); // 立即通知当前状态
  return () => listeners.delete(listener);
}

function setStatus(status: SyncStatus) {
  currentStatus = status;
  listeners.forEach((l) => l(status));
}

export function getSyncStatus(): SyncStatus {
  return currentStatus;
}

// 网络状态监听
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    isOnline = true;
    console.log('[Sync] 网络恢复，开始处理离线队列...');
    flushPendingQueue();
  });

  window.addEventListener('offline', () => {
    isOnline = false;
    setStatus('offline');
    console.log('[Sync] 网络断开，切换到离线模式');
  });
}

// ============================================
// 媒体提取与替换
// ============================================

/**
 * 从 ProjectState 中提取所有 base64 媒体字段，
 * 上传到 Storage 后替换为 URL。
 * 返回处理后的 ProjectState（不修改原对象）。
 */
async function extractAndUploadMedia(
  project: ProjectState,
  userId: string
): Promise<ProjectState> {
  const clone: ProjectState = JSON.parse(JSON.stringify(project));
  const uploads: Array<Promise<void>> = [];

  // 角色参考图
  if (clone.scriptData?.characters) {
    for (const char of clone.scriptData.characters) {
      if (isBase64DataUrl(char.referenceImage)) {
        uploads.push(
          uploadMedia(userId, project.id, 'characters', char.id, char.referenceImage!)
            .then((result) => {
              if (result) char.referenceImage = result.url;
            })
        );
      }
      // 角色变体图
      if (char.variations) {
        for (const variation of char.variations) {
          if (isBase64DataUrl(variation.referenceImage)) {
            uploads.push(
              uploadMedia(userId, project.id, 'characters', `${char.id}_var_${variation.id}`, variation.referenceImage!)
                .then((result) => {
                  if (result) variation.referenceImage = result.url;
                })
            );
          }
        }
      }
      // 角色九宫格
      if (char.turnaround?.imageUrl && isBase64DataUrl(char.turnaround.imageUrl)) {
        uploads.push(
          uploadMedia(userId, project.id, 'turnarounds', `${char.id}_turnaround`, char.turnaround.imageUrl)
            .then((result) => {
              if (result && char.turnaround) char.turnaround.imageUrl = result.url;
            })
        );
      }
    }
  }

  // 场景参考图
  if (clone.scriptData?.scenes) {
    for (const scene of clone.scriptData.scenes) {
      if (isBase64DataUrl(scene.referenceImage)) {
        uploads.push(
          uploadMedia(userId, project.id, 'scenes', scene.id, scene.referenceImage!)
            .then((result) => {
              if (result) scene.referenceImage = result.url;
            })
        );
      }
    }
  }

  // 道具参考图
  if (clone.scriptData?.props) {
    for (const prop of clone.scriptData.props) {
      if (isBase64DataUrl(prop.referenceImage)) {
        uploads.push(
          uploadMedia(userId, project.id, 'props', prop.id, prop.referenceImage!)
            .then((result) => {
              if (result) prop.referenceImage = result.url;
            })
        );
      }
    }
  }

  // 关键帧图像和视频
  if (clone.shots) {
    for (const shot of clone.shots) {
      if (shot.keyframes) {
        for (const kf of shot.keyframes) {
          if (isBase64DataUrl(kf.imageUrl)) {
            uploads.push(
              uploadMedia(userId, project.id, 'keyframes', `${shot.id}_${kf.id}`, kf.imageUrl!)
                .then((result) => {
                  if (result) kf.imageUrl = result.url;
                })
            );
          }
        }
      }
      if (shot.interval?.videoUrl && isBase64DataUrl(shot.interval.videoUrl)) {
        uploads.push(
          uploadMedia(userId, project.id, 'videos', `${shot.id}_video`, shot.interval.videoUrl)
            .then((result) => {
              if (result && shot.interval) shot.interval.videoUrl = result.url;
            })
        );
      }
      // 九宫格
      if (shot.nineGrid?.imageUrl && isBase64DataUrl(shot.nineGrid.imageUrl)) {
        uploads.push(
          uploadMedia(userId, project.id, 'ninegrid', `${shot.id}_ninegrid`, shot.nineGrid.imageUrl)
            .then((result) => {
              if (result && shot.nineGrid) shot.nineGrid.imageUrl = result.url;
            })
        );
      }
    }
  }

  // 并发上传（每批 5 个）
  const BATCH_SIZE = 5;
  for (let i = 0; i < uploads.length; i += BATCH_SIZE) {
    await Promise.all(uploads.slice(i, i + BATCH_SIZE));
  }

  return clone;
}

// ============================================
// 数据库操作
// ============================================

/**
 * 将项目同步到 Supabase（含媒体上传）
 */
export async function syncProjectToCloud(
  project: ProjectState,
  userId: string
): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured()) return false;

  try {
    setStatus('syncing');

    // 提取并上传媒体
    const cloudProject = await extractAndUploadMedia(project, userId);

    // 写入数据库
    const { error } = await supabase.from('projects').upsert({
      id: cloudProject.id,
      user_id: userId,
      title: cloudProject.title,
      created_at: cloudProject.createdAt,
      last_modified: cloudProject.lastModified,
      stage: cloudProject.stage,
      raw_script: cloudProject.rawScript,
      target_duration: cloudProject.targetDuration,
      language: cloudProject.language,
      visual_style: cloudProject.visualStyle,
      shot_generation_model: cloudProject.shotGenerationModel,
      script_data: cloudProject.scriptData,
      shots: cloudProject.shots,
      render_logs: cloudProject.renderLogs,
      is_parsing_script: cloudProject.isParsingScript,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error('[Sync] 同步项目失败:', error);
      setStatus('error');
      consecutiveErrors++;
      return false;
    }

    dirtyProjects.delete(project.id);
    consecutiveErrors = 0;
    setStatus('synced');
    return true;
  } catch (err) {
    console.error('[Sync] 同步项目异常:', err);
    setStatus('error');
    consecutiveErrors++;
    return false;
  }
}

/**
 * 从 Supabase 加载项目
 */
export async function fetchProjectFromCloud(
  projectId: string,
  userId: string
): Promise<ProjectState | null> {
  if (!supabase || !isSupabaseConfigured()) return null;

  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();

    if (error || !data) return null;

    return cloudRowToProjectState(data);
  } catch {
    return null;
  }
}

/**
 * 从 Supabase 获取所有项目元数据
 */
export async function fetchAllProjectsFromCloud(
  userId: string
): Promise<ProjectState[]> {
  if (!supabase || !isSupabaseConfigured()) return [];

  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .order('last_modified', { ascending: false });

    if (error || !data) return [];

    return data.map(cloudRowToProjectState);
  } catch {
    return [];
  }
}

/**
 * 从 Supabase 删除项目
 */
export async function deleteProjectFromCloud(
  projectId: string,
  userId: string
): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured()) return false;

  try {
    // 先删除 Storage 中的媒体
    await deleteProjectMedia(userId, projectId);

    // 再删除数据库记录
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId)
      .eq('user_id', userId);

    if (error) {
      console.error('[Sync] 删除云端项目失败:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[Sync] 删除云端项目异常:', err);
    return false;
  }
}

// ============================================
// 资产库同步
// ============================================

/**
 * 同步资产到 Supabase
 */
export async function syncAssetToCloud(
  item: AssetLibraryItem,
  userId: string
): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured()) return false;

  try {
    const { error } = await supabase.from('asset_library').upsert({
      id: item.id,
      user_id: userId,
      type: item.type,
      name: item.name,
      project_id: item.projectId || null,
      project_name: item.projectName || null,
      created_at: item.createdAt,
      updated_at: item.updatedAt,
      data: item.data,
    });

    if (error) {
      console.error('[Sync] 同步资产失败:', error);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * 从 Supabase 获取所有资产
 */
export async function fetchAllAssetsFromCloud(
  userId: string
): Promise<AssetLibraryItem[]> {
  if (!supabase || !isSupabaseConfigured()) return [];

  try {
    const { data, error } = await supabase
      .from('asset_library')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error || !data) return [];

    return data.map((row: any) => ({
      id: row.id,
      type: row.type,
      name: row.name,
      projectId: row.project_id,
      projectName: row.project_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      data: row.data,
    }));
  } catch {
    return [];
  }
}

/**
 * 从 Supabase 删除资产
 */
export async function deleteAssetFromCloud(
  assetId: string,
  userId: string
): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured()) return false;

  try {
    const { error } = await supabase
      .from('asset_library')
      .delete()
      .eq('id', assetId)
      .eq('user_id', userId);

    return !error;
  } catch {
    return false;
  }
}

// ============================================
// Dirty Tracking & Debounced Sync
// ============================================

/**
 * 标记项目为脏（需要同步）
 * 使用 debounce 延迟 2 秒后触发同步
 */
export function markProjectDirty(projectId: string, project: ProjectState, userId: string): void {
  dirtyProjects.add(projectId);

  if (!isOnline || !isSupabaseConfigured()) {
    // 离线：加入待处理队列
    addToPendingQueue({
      type: 'upsert_project',
      id: projectId,
      data: project,
      timestamp: Date.now(),
    });
    return;
  }

  // 清除之前的 timer
  const existingTimer = syncTimers.get(projectId);
  if (existingTimer) clearTimeout(existingTimer);

  // 退避延迟
  const delay = consecutiveErrors > 0
    ? Math.min(BASE_DELAY * Math.pow(2, consecutiveErrors), 60000)
    : BASE_DELAY;

  const timer = setTimeout(async () => {
    syncTimers.delete(projectId);
    if (dirtyProjects.has(projectId)) {
      await syncProjectToCloud(project, userId);
    }
  }, delay);

  syncTimers.set(projectId, timer);
}

/**
 * 标记资产为脏
 */
export function markAssetDirty(item: AssetLibraryItem, userId: string): void {
  if (!isOnline || !isSupabaseConfigured()) {
    addToPendingQueue({
      type: 'upsert_asset',
      id: item.id,
      data: item,
      timestamp: Date.now(),
    });
    return;
  }

  // 资产更新频率低，直接同步
  syncAssetToCloud(item, userId);
}

// ============================================
// 离线队列
// ============================================

function addToPendingQueue(item: PendingSync): void {
  // 去重：如果已有同 ID 的操作，替换为最新的
  const existingIndex = pendingQueue.findIndex(
    (p) => p.id === item.id && p.type === item.type
  );
  if (existingIndex >= 0) {
    pendingQueue[existingIndex] = item;
  } else {
    pendingQueue.push(item);
  }
}

/**
 * 处理离线队列中所有待同步操作
 */
export async function flushPendingQueue(): Promise<void> {
  if (!isOnline || !isSupabaseConfigured()) return;

  const items = [...pendingQueue];
  pendingQueue.length = 0;

  setStatus('syncing');

  for (const item of items) {
    try {
      switch (item.type) {
        case 'upsert_project':
          if (item.data) {
            // 需要获取 userId - 从 Supabase auth 获取
            const userId = await getCurrentUserId();
            if (userId) {
              await syncProjectToCloud(item.data, userId);
            }
          }
          break;
        case 'delete_project': {
          const uid = await getCurrentUserId();
          if (uid) {
            await deleteProjectFromCloud(item.id, uid);
          }
          break;
        }
        case 'upsert_asset':
          if (item.data) {
            const uid = await getCurrentUserId();
            if (uid) {
              await syncAssetToCloud(item.data, uid);
            }
          }
          break;
        case 'delete_asset': {
          const uid = await getCurrentUserId();
          if (uid) {
            await deleteAssetFromCloud(item.id, uid);
          }
          break;
        }
      }
    } catch (err) {
      console.error('[Sync] 处理离线队列项失败:', err);
      // 失败的操作放回队列
      pendingQueue.push(item);
    }
  }

  if (pendingQueue.length === 0) {
    setStatus('synced');
  }
}

// ============================================
// 冲突解决
// ============================================

/**
 * 解决本地和云端版本冲突
 * 策略：lastModified 时间戳大的为准
 */
export function resolveConflict(
  local: ProjectState,
  remote: ProjectState
): ProjectState {
  if (local.lastModified >= remote.lastModified) {
    return local;
  }
  return remote;
}

/**
 * 合并项目列表（本地 + 云端去重）
 * 同 ID 的项目取 lastModified 更大的版本
 */
export function mergeProjectLists(
  localProjects: ProjectState[],
  cloudProjects: ProjectState[]
): ProjectState[] {
  const merged = new Map<string, ProjectState>();

  // 先加入本地
  for (const p of localProjects) {
    merged.set(p.id, p);
  }

  // 合并云端
  for (const p of cloudProjects) {
    const existing = merged.get(p.id);
    if (!existing || p.lastModified > existing.lastModified) {
      merged.set(p.id, p);
    }
  }

  // 按 lastModified 降序排列
  return Array.from(merged.values()).sort(
    (a, b) => b.lastModified - a.lastModified
  );
}

// ============================================
// 辅助函数
// ============================================

async function getCurrentUserId(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id || null;
  } catch {
    return null;
  }
}

/**
 * 将 Supabase 数据库行转换为 ProjectState
 */
function cloudRowToProjectState(row: any): ProjectState {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    lastModified: row.last_modified,
    stage: row.stage || 'script',
    rawScript: row.raw_script || '',
    targetDuration: row.target_duration || '60s',
    language: row.language || '中文',
    visualStyle: row.visual_style || 'live-action',
    shotGenerationModel: row.shot_generation_model || 'gpt-5.1',
    scriptData: row.script_data || null,
    shots: row.shots || [],
    isParsingScript: row.is_parsing_script || false,
    renderLogs: row.render_logs || [],
  };
}

/**
 * 重置同步状态（登出时调用）
 */
export function resetSyncState(): void {
  dirtyProjects.clear();
  pendingQueue.length = 0;
  syncTimers.forEach((timer) => clearTimeout(timer));
  syncTimers.clear();
  consecutiveErrors = 0;
  clearUploadCache();
  setStatus('idle');
}

/**
 * 检查是否有未同步的变更
 */
export function hasPendingChanges(): boolean {
  return dirtyProjects.size > 0 || pendingQueue.length > 0;
}
