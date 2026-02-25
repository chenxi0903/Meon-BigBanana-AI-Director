/**
 * 鍚屾寮曟搸
 * 瀹炵幇 IndexedDB 鈫?Supabase 鐨勬贩鍚堝悓姝ワ細
 * - 姝ｅ父鍦ㄧ嚎鏃跺疄鏃跺悓姝ワ紙debounced锛?
 * - 绂荤嚎鏃舵湰鍦颁繚瀛橈紝涓婄嚎鍚庤嚜鍔ㄥ悎骞?
 * 
 * 鍑忓帇绛栫暐锛?
 * - Debounced Write: 2 绉掗槻鎶?
 * - Dirty Tracking: 鍙悓姝ュ彉鏇寸殑鏁版嵁
 * - 澧為噺濯掍綋鍚屾: 鍙笂浼犳柊澧?鍙樻洿鐨勫獟浣撴枃浠?
 * - lastModified 姣旇緝: 璺宠繃鏈彉鍖栫殑鏁版嵁
 * - 绂荤嚎闃熷垪: 绂荤嚎鎿嶄綔杩涢槦鍒?
 * - 鎸囨暟閫€閬? 鍚屾澶辫触鏃堕€€閬块噸璇?
 */

import { ProjectState, AssetLibraryItem, Character } from '../../types';
import { supabase, isSupabaseConfigured } from './client';

// ============================================
// 绫诲瀷瀹氫箟
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
// 鐘舵€佺鐞?
// ============================================

let currentStatus: SyncStatus = 'idle';
let isOnline = navigator.onLine;
const listeners: Set<SyncListener> = new Set();
const dirtyProjects: Set<string> = new Set();
const pendingQueue: PendingSync[] = [];
const syncTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

// 閫€閬跨姸鎬?
let consecutiveErrors = 0;
const MAX_RETRIES = 5;
const BASE_DELAY = 2000;

// ============================================
// 浜嬩欢鐩戝惉
// ============================================

/**
 * 璁㈤槄鍚屾鐘舵€佸彉鍖?
 */
export function subscribeSyncStatus(listener: SyncListener): () => void {
  listeners.add(listener);
  listener(currentStatus); // 绔嬪嵆閫氱煡褰撳墠鐘舵€?
  return () => listeners.delete(listener);
}

function setStatus(status: SyncStatus) {
  currentStatus = status;
  listeners.forEach((l) => l(status));
}

export function getSyncStatus(): SyncStatus {
  return currentStatus;
}

// 缃戠粶鐘舵€佺洃鍚?
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    isOnline = true;
    console.log('[Sync] 缃戠粶鎭㈠锛屽紑濮嬪鐞嗙绾块槦鍒?..');
    flushPendingQueue();
  });

  window.addEventListener('offline', () => {
    isOnline = false;
    setStatus('offline');
    console.log('[Sync] 缃戠粶鏂紑锛屽垏鎹㈠埌绂荤嚎妯″紡');
  });
}

// ============================================
// 濯掍綋鎻愬彇涓庢浛鎹?
// ============================================

/**
 * 浠?ProjectState 涓彁鍙栨墍鏈?base64 濯掍綋瀛楁锛?
 * 涓婁紶鍒?Storage 鍚庢浛鎹负 URL銆?
 * 杩斿洖澶勭悊鍚庣殑 ProjectState锛堜笉淇敼鍘熷璞★級銆?
 */
function stripCharacterMedia(character: Character): Character {
  return {
    ...character,
    referenceImage: undefined,
    variations: (character.variations || []).map((variation) => ({
      ...variation,
      referenceImage: undefined,
    })),
    turnaround: character.turnaround
      ? {
          ...character.turnaround,
          imageUrl: undefined,
        }
      : undefined,
  };
}

function stripProjectMediaForCloud(project: ProjectState): ProjectState {
  const clone: ProjectState = JSON.parse(JSON.stringify(project));

  if (clone.scriptData) {
    clone.scriptData = {
      ...clone.scriptData,
      characters: (clone.scriptData.characters || []).map(stripCharacterMedia),
      scenes: (clone.scriptData.scenes || []).map((scene) => ({
        ...scene,
        referenceImage: undefined,
      })),
      props: (clone.scriptData.props || []).map((prop) => ({
        ...prop,
        referenceImage: undefined,
      })),
    };
  }

  clone.shots = (clone.shots || []).map((shot) => ({
    ...shot,
    keyframes: (shot.keyframes || []).map((kf) => ({
      ...kf,
      imageUrl: undefined,
    })),
    interval: shot.interval
      ? {
          ...shot.interval,
          videoUrl: undefined,
        }
      : shot.interval,
    nineGrid: shot.nineGrid
      ? {
          ...shot.nineGrid,
          imageUrl: undefined,
        }
      : shot.nineGrid,
  }));

  return clone;
}

function stripAssetMediaForCloud(item: AssetLibraryItem): AssetLibraryItem | null {
  if (item.type !== 'character') return null;
  return {
    ...item,
    data: stripCharacterMedia(item.data as Character),
  };
}

export function mergeProjectPreservingLocalMedia(
  local: ProjectState,
  remote: ProjectState
): ProjectState {
  const merged: ProjectState = JSON.parse(JSON.stringify(remote));

  const localCharacters = new Map((local.scriptData?.characters || []).map((c) => [String(c.id), c]));
  const localScenes = new Map((local.scriptData?.scenes || []).map((s) => [String(s.id), s]));
  const localProps = new Map((local.scriptData?.props || []).map((p) => [String(p.id), p]));
  const localShots = new Map((local.shots || []).map((shot) => [String(shot.id), shot]));

  if (merged.scriptData) {
    merged.scriptData.characters = (merged.scriptData.characters || []).map((remoteChar) => {
      const localChar = localCharacters.get(String(remoteChar.id));
      if (!localChar) return remoteChar;
      return {
        ...remoteChar,
        referenceImage: localChar.referenceImage || remoteChar.referenceImage,
        turnaround: remoteChar.turnaround
          ? {
              ...remoteChar.turnaround,
              imageUrl: localChar.turnaround?.imageUrl || remoteChar.turnaround?.imageUrl,
            }
          : remoteChar.turnaround,
        variations: (remoteChar.variations || []).map((remoteVar) => {
          const localVar = (localChar.variations || []).find((v) => String(v.id) === String(remoteVar.id));
          return {
            ...remoteVar,
            referenceImage: localVar?.referenceImage || remoteVar.referenceImage,
          };
        }),
      };
    });

    merged.scriptData.scenes = (merged.scriptData.scenes || []).map((remoteScene) => {
      const localScene = localScenes.get(String(remoteScene.id));
      return {
        ...remoteScene,
        referenceImage: localScene?.referenceImage || remoteScene.referenceImage,
      };
    });

    merged.scriptData.props = (merged.scriptData.props || []).map((remoteProp) => {
      const localProp = localProps.get(String(remoteProp.id));
      return {
        ...remoteProp,
        referenceImage: localProp?.referenceImage || remoteProp.referenceImage,
      };
    });
  }

  merged.shots = (merged.shots || []).map((remoteShot) => {
    const localShot = localShots.get(String(remoteShot.id));
    if (!localShot) return remoteShot;
    const localKeyframes = new Map((localShot.keyframes || []).map((kf) => [String(kf.id), kf]));
    return {
      ...remoteShot,
      keyframes: (remoteShot.keyframes || []).map((remoteKf) => {
        const localKf = localKeyframes.get(String(remoteKf.id));
        return {
          ...remoteKf,
          imageUrl: localKf?.imageUrl || remoteKf.imageUrl,
        };
      }),
      interval: remoteShot.interval
        ? {
            ...remoteShot.interval,
            videoUrl: localShot.interval?.videoUrl || remoteShot.interval.videoUrl,
          }
        : remoteShot.interval,
      nineGrid: remoteShot.nineGrid
        ? {
            ...remoteShot.nineGrid,
            imageUrl: localShot.nineGrid?.imageUrl || remoteShot.nineGrid.imageUrl,
          }
        : remoteShot.nineGrid,
    };
  });

  return merged;
}

// ============================================
// 鏁版嵁搴撴搷浣?
// ============================================

/**
 * 灏嗛」鐩悓姝ュ埌 Supabase锛堝惈濯掍綋涓婁紶锛?
 */
export async function syncProjectToCloud(
  project: ProjectState,
  userId: string
): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured()) return false;

  try {
    setStatus('syncing');

    // 鎻愬彇骞朵笂浼犲獟浣?
    const cloudProject = stripProjectMediaForCloud(project);

    // 鍐欏叆鏁版嵁搴?
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
      console.error('[Sync] 鍚屾椤圭洰澶辫触:', error);
      setStatus('error');
      consecutiveErrors++;
      return false;
    }

    dirtyProjects.delete(project.id);
    consecutiveErrors = 0;
    setStatus('synced');
    return true;
  } catch (err) {
    console.error('[Sync] 鍚屾椤圭洰寮傚父:', err);
    setStatus('error');
    consecutiveErrors++;
    return false;
  }
}

/**
 * 浠?Supabase 鍔犺浇椤圭洰
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
 * 浠?Supabase 鑾峰彇鎵€鏈夐」鐩厓鏁版嵁
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
 * 浠?Supabase 鍒犻櫎椤圭洰
 */
export async function deleteProjectFromCloud(
  projectId: string,
  userId: string
): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured()) return false;

  try {
    // 鍐嶅垹闄ゆ暟鎹簱璁板綍
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId)
      .eq('user_id', userId);

    if (error) {
      console.error('[Sync] 鍒犻櫎浜戠椤圭洰澶辫触:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[Sync] 鍒犻櫎浜戠椤圭洰寮傚父:', err);
    return false;
  }
}

// ============================================
// 璧勪骇搴撳悓姝?
// ============================================

/**
 * 鍚屾璧勪骇鍒?Supabase
 */
export async function syncAssetToCloud(
  item: AssetLibraryItem,
  userId: string
): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured()) return false;

  try {
    const cloudAsset = stripAssetMediaForCloud(item);
    if (!cloudAsset) {
      return true;
    }

    const { error } = await supabase.from('asset_library').upsert({
      id: cloudAsset.id,
      user_id: userId,
      type: cloudAsset.type,
      name: cloudAsset.name,
      project_id: cloudAsset.projectId || null,
      project_name: cloudAsset.projectName || null,
      created_at: cloudAsset.createdAt,
      updated_at: cloudAsset.updatedAt,
      data: cloudAsset.data,
    });

    if (error) {
      console.error('[Sync] 鍚屾璧勪骇澶辫触:', error);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * 浠?Supabase 鑾峰彇鎵€鏈夎祫浜?
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
 * 浠?Supabase 鍒犻櫎璧勪骇
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
 * 鏍囪椤圭洰涓鸿剰锛堥渶瑕佸悓姝ワ級
 * 浣跨敤 debounce 寤惰繜 2 绉掑悗瑙﹀彂鍚屾
 */
export function markProjectDirty(projectId: string, project: ProjectState, userId: string): void {
  dirtyProjects.add(projectId);

  if (!isOnline || !isSupabaseConfigured()) {
    // 绂荤嚎锛氬姞鍏ュ緟澶勭悊闃熷垪
    addToPendingQueue({
      type: 'upsert_project',
      id: projectId,
      data: project,
      timestamp: Date.now(),
    });
    return;
  }

  // 娓呴櫎涔嬪墠鐨?timer
  const existingTimer = syncTimers.get(projectId);
  if (existingTimer) clearTimeout(existingTimer);

  // 閫€閬垮欢杩?
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
 * 鏍囪璧勪骇涓鸿剰
 */
export function markAssetDirty(item: AssetLibraryItem, userId: string): void {
  if (item.type !== 'character') {
    return;
  }
  if (!isOnline || !isSupabaseConfigured()) {
    addToPendingQueue({
      type: 'upsert_asset',
      id: item.id,
      data: item,
      timestamp: Date.now(),
    });
    return;
  }

  // 璧勪骇鏇存柊棰戠巼浣庯紝鐩存帴鍚屾
  syncAssetToCloud(item, userId);
}

// ============================================
// 绂荤嚎闃熷垪
// ============================================

function addToPendingQueue(item: PendingSync): void {
  // 鍘婚噸锛氬鏋滃凡鏈夊悓 ID 鐨勬搷浣滐紝鏇挎崲涓烘渶鏂扮殑
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
 * 澶勭悊绂荤嚎闃熷垪涓墍鏈夊緟鍚屾鎿嶄綔
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
            // 闇€瑕佽幏鍙?userId - 浠?Supabase auth 鑾峰彇
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
      console.error('[Sync] 澶勭悊绂荤嚎闃熷垪椤瑰け璐?', err);
      // 澶辫触鐨勬搷浣滄斁鍥為槦鍒?
      pendingQueue.push(item);
    }
  }

  if (pendingQueue.length === 0) {
    setStatus('synced');
  }
}

// ============================================
// 鍐茬獊瑙ｅ喅
// ============================================

/**
 * 瑙ｅ喅鏈湴鍜屼簯绔増鏈啿绐?
 * 绛栫暐锛歭astModified 鏃堕棿鎴冲ぇ鐨勪负鍑?
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
 * 鍚堝苟椤圭洰鍒楄〃锛堟湰鍦?+ 浜戠鍘婚噸锛?
 * 鍚?ID 鐨勯」鐩彇 lastModified 鏇村ぇ鐨勭増鏈?
 */
export function mergeProjectLists(
  localProjects: ProjectState[],
  cloudProjects: ProjectState[]
): ProjectState[] {
  const merged = new Map<string, ProjectState>();

  // 鍏堝姞鍏ユ湰鍦?
  for (const p of localProjects) {
    merged.set(p.id, p);
  }

  // 鍚堝苟浜戠
  for (const p of cloudProjects) {
    const existing = merged.get(p.id);
    if (!existing) {
      merged.set(p.id, p);
      continue;
    }
    if (p.lastModified > existing.lastModified) {
      merged.set(p.id, mergeProjectPreservingLocalMedia(existing, p));
    }
  }

  // 鎸?lastModified 闄嶅簭鎺掑垪
  return Array.from(merged.values()).sort(
    (a, b) => b.lastModified - a.lastModified
  );
}

// ============================================
// 杈呭姪鍑芥暟
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
 * 灏?Supabase 鏁版嵁搴撹杞崲涓?ProjectState
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
    language: row.language || '涓枃',
    visualStyle: row.visual_style || 'live-action',
    shotGenerationModel: row.shot_generation_model || 'gpt-5.1',
    scriptData: row.script_data || null,
    shots: row.shots || [],
    isParsingScript: row.is_parsing_script || false,
    renderLogs: row.render_logs || [],
  };
}

/**
 * 閲嶇疆鍚屾鐘舵€侊紙鐧诲嚭鏃惰皟鐢級
 */
export function resetSyncState(): void {
  dirtyProjects.clear();
  pendingQueue.length = 0;
  syncTimers.forEach((timer) => clearTimeout(timer));
  syncTimers.clear();
  consecutiveErrors = 0;  setStatus('idle');
}

/**
 * 妫€鏌ユ槸鍚︽湁鏈悓姝ョ殑鍙樻洿
 */
export function hasPendingChanges(): boolean {
  return dirtyProjects.size > 0 || pendingQueue.length > 0;
}

