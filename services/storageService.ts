import { ProjectState, AssetLibraryItem } from '../types';
import { isSupabaseConfigured } from './supabase/client';
import {
  markProjectDirty,
  markAssetDirty,
  fetchAllProjectsFromCloud,
  fetchProjectFromCloud,
  deleteProjectFromCloud,
  deleteAssetFromCloud,
  mergeProjectLists,
  mergeProjectPreservingLocalMedia,
  syncProjectToCloud,
} from './supabase/syncService';

const DB_NAME = 'MeonDB';
const DB_VERSION = 2;
const STORE_NAME = 'projects';
const ASSET_STORE_NAME = 'assetLibrary';
const EXPORT_SCHEMA_VERSION = 1;

import { supabase } from './supabase/client';

/**
 * 鑾峰彇褰撳墠鐧诲綍鐨勭敤鎴?ID锛堜粠 Supabase auth锛?
 * 杩斿洖 null 琛ㄧず鏈櫥褰曟垨 Supabase 鏈厤缃?
 */
async function _getCurrentUserId(): Promise<string | null> {
  if (!isSupabaseConfigured() || !supabase) return null;
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id || null;
  } catch {
    return null;
  }
}

export interface IndexedDBExportPayload {
  schemaVersion: number;
  exportedAt: number;
  scope?: 'all' | 'project';
  dbName: string;
  dbVersion: number;
  stores: {
    projects: ProjectState[];
    assetLibrary: AssetLibraryItem[];
  };
}

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(ASSET_STORE_NAME)) {
        db.createObjectStore(ASSET_STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

const isValidExportPayload = (data: unknown): data is IndexedDBExportPayload => {
  const payload = data as IndexedDBExportPayload;
  return !!(
    payload &&
    payload.stores &&
    Array.isArray(payload.stores.projects) &&
    Array.isArray(payload.stores.assetLibrary)
  );
};

export const exportIndexedDBData = async (): Promise<IndexedDBExportPayload> => {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME, ASSET_STORE_NAME], 'readonly');
    const projectStore = tx.objectStore(STORE_NAME);
    const assetStore = tx.objectStore(ASSET_STORE_NAME);

    const projectsRequest = projectStore.getAll();
    const assetsRequest = assetStore.getAll();

    projectsRequest.onerror = () => reject(projectsRequest.error);
    assetsRequest.onerror = () => reject(assetsRequest.error);

    tx.oncomplete = () => {
      resolve({
        schemaVersion: EXPORT_SCHEMA_VERSION,
        exportedAt: Date.now(),
        scope: 'all',
        dbName: DB_NAME,
        dbVersion: DB_VERSION,
        stores: {
          projects: (projectsRequest.result as ProjectState[]) || [],
          assetLibrary: (assetsRequest.result as AssetLibraryItem[]) || []
        }
      });
    };

    tx.onerror = () => reject(tx.error);
  });
};

export const exportProjectData = async (project: ProjectState): Promise<IndexedDBExportPayload> => {
  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: Date.now(),
    scope: 'project',
    dbName: DB_NAME,
    dbVersion: DB_VERSION,
    stores: {
      projects: [project],
      assetLibrary: []
    }
  };
};

export const importIndexedDBData = async (
  payload: unknown,
  options?: { mode?: 'merge' | 'replace' }
): Promise<{ projects: number; assets: number }> => {
  if (!isValidExportPayload(payload)) {
    throw new Error('瀵煎叆鏂囦欢鏍煎紡涓嶆纭?);
  }

  const mode = options?.mode || 'merge';
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME, ASSET_STORE_NAME], 'readwrite');
    const projectStore = tx.objectStore(STORE_NAME);
    const assetStore = tx.objectStore(ASSET_STORE_NAME);

    if (mode === 'replace') {
      projectStore.clear();
      assetStore.clear();
    }

    let projectsWritten = 0;
    let assetsWritten = 0;

    payload.stores.projects.forEach(project => {
      // Migration: veo-r2v 妯″瀷宸蹭笅绾匡紝杩佺Щ涓?veo
      if (project.shots) {
        project.shots.forEach((shot: any) => {
          if (shot.videoModel === 'veo-r2v') {
            shot.videoModel = 'veo';
          }
        });
      }
      const request = projectStore.put(project);
      request.onsuccess = () => {
        projectsWritten += 1;
      };
      request.onerror = () => reject(request.error);
    });

    payload.stores.assetLibrary.forEach(item => {
      const request = assetStore.put(item);
      request.onsuccess = () => {
        assetsWritten += 1;
      };
      request.onerror = () => reject(request.error);
    });

    tx.oncomplete = () => resolve({ projects: projectsWritten, assets: assetsWritten });
    tx.onerror = () => reject(tx.error);
  });
};

export const saveProjectToDB = async (project: ProjectState): Promise<void> => {
  const db = await openDB();
  const p = { ...project, lastModified: Date.now() };

  // 1. 绔嬪嵆鍐欏叆 IndexedDB锛堝揩閫燂級
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(p);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

  // 2. 鍚庡彴瑙﹀彂浜戠鍚屾锛坉ebounced锛屼笉闃诲锛?
  _getCurrentUserId().then((userId) => {
    if (userId) {
      markProjectDirty(p.id, p, userId);
    }
  }).catch(() => {
    // 鍚屾澶辫触涓嶅奖鍝嶆湰鍦颁繚瀛?
  });
};

export const loadProjectFromDB = async (id: string): Promise<ProjectState> => {
  const db = await openDB();
  const project = await new Promise<ProjectState>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onsuccess = () => {
      if (request.result) {
        const project = request.result;
        // Migration: ensure renderLogs exists for old projects
        if (!project.renderLogs) {
          project.renderLogs = [];
        }
        // Migration: ensure scriptData.props exists for old projects
        if (project.scriptData && !project.scriptData.props) {
          project.scriptData.props = [];
        }
        // Migration: veo-r2v 妯″瀷宸蹭笅绾匡紝杩佺Щ涓?veo
        let migrated = false;
        if (project.shots) {
          project.shots.forEach((shot: any) => {
            if (shot.videoModel === 'veo-r2v') {
              shot.videoModel = 'veo';
              migrated = true;
            }
          });
        }
        // 濡傛灉鍙戠敓浜嗚縼绉伙紝寮傛鍥炲啓 IndexedDB锛岄伩鍏嶆瘡娆″姞杞介兘閲嶅鎵ц
        if (migrated) {
          openDB().then(writeDb => {
            const writeTx = writeDb.transaction(STORE_NAME, 'readwrite');
            writeTx.objectStore(STORE_NAME).put(project);
            console.log(`馃攧 椤圭洰 "${project.title}" 宸茶縼绉诲簾寮冪殑瑙嗛妯″瀷`);
          }).catch(() => { /* 鍥炲啓澶辫触涓嶅奖鍝嶈繍琛?*/ });
        }
        resolve(project);
      }
      else reject(new Error("Project not found"));
    };
    request.onerror = () => reject(request.error);
  });

  // 鍚庡彴妫€鏌ヤ簯绔槸鍚︽湁鏇存柊鐗堟湰锛堜笉闃诲杩斿洖锛?
  _getCurrentUserId().then(async (userId) => {
    if (!userId) return;
    try {
      const cloudProject = await fetchProjectFromCloud(id, userId);
      if (cloudProject && cloudProject.lastModified > project.lastModified) {
        // 浜戠鐗堟湰鏇存柊锛屽啓鍏ユ湰鍦扮紦瀛?
        const writeDb = await openDB();
        const writeTx = writeDb.transaction(STORE_NAME, 'readwrite');
        const mergedProject = mergeProjectPreservingLocalMedia(project, cloudProject);
        writeTx.objectStore(STORE_NAME).put(mergedProject);
        console.log(`鈽侊笍 浜戠鏈夋洿鏂扮増鏈紝宸叉洿鏂版湰鍦扮紦瀛? ${mergedProject.title}`);
      }
    } catch {
      // 浜戠妫€鏌ュけ璐ヤ笉褰卞搷鏈湴浣跨敤
    }
  }).catch(() => {});

  return project;
};

export const getAllProjectsMetadata = async (): Promise<ProjectState[]> => {
  const db = await openDB();
  const localProjects = await new Promise<ProjectState[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll(); 
    request.onsuccess = () => {
       const projects = request.result as ProjectState[];
       // Sort by last modified descending
       projects.sort((a, b) => b.lastModified - a.lastModified);
       resolve(projects);
    };
    request.onerror = () => reject(request.error);
  });

  // 灏濊瘯鍚堝苟浜戠椤圭洰鍒楄〃锛堜笉闃诲锛屽揩閫熻繑鍥炴湰鍦版暟鎹級
  try {
    const userId = await _getCurrentUserId();
    if (userId) {
      const cloudProjects = await fetchAllProjectsFromCloud(userId);
      if (cloudProjects.length > 0) {
        const merged = mergeProjectLists(localProjects, cloudProjects);
        // 灏嗕簯绔嫭鏈夌殑椤圭洰涔熺紦瀛樺埌鏈湴 IndexedDB
        _cacheCloudOnlyProjects(localProjects, cloudProjects).catch(() => {});
        return merged;
      }
    }
  } catch {
    // 浜戠鑾峰彇澶辫触锛岃繑鍥炴湰鍦版暟鎹?
  }

  return localProjects;
};

/**
 * 灏嗕簯绔嫭鏈夌殑椤圭洰缂撳瓨鍒版湰鍦?IndexedDB
 */
async function _cacheCloudOnlyProjects(
  localProjects: ProjectState[],
  cloudProjects: ProjectState[]
): Promise<void> {
  const localIds = new Set(localProjects.map((p) => p.id));
  const cloudOnly = cloudProjects.filter((p) => !localIds.has(p.id));

  if (cloudOnly.length === 0) return;

  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);

  for (const project of cloudOnly) {
    store.put(project);
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      console.log(`鈽侊笍 宸茬紦瀛?${cloudOnly.length} 涓簯绔」鐩埌鏈湴`);
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

// =========================
// Asset Library Operations
// =========================

export const saveAssetToLibrary = async (item: AssetLibraryItem): Promise<void> => {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(ASSET_STORE_NAME, 'readwrite');
    const store = tx.objectStore(ASSET_STORE_NAME);
    const request = store.put(item);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

  // 鍚庡彴鍚屾鍒颁簯绔?
  _getCurrentUserId().then((userId) => {
    if (userId) {
      markAssetDirty(item, userId);
    }
  }).catch(() => {});
};

export const getAllAssetLibraryItems = async (): Promise<AssetLibraryItem[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ASSET_STORE_NAME, 'readonly');
    const store = tx.objectStore(ASSET_STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      const items = (request.result as AssetLibraryItem[]) || [];
      items.sort((a, b) => b.updatedAt - a.updatedAt);
      resolve(items);
    };
    request.onerror = () => reject(request.error);
  });
};

export const deleteAssetFromLibrary = async (id: string): Promise<void> => {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(ASSET_STORE_NAME, 'readwrite');
    const store = tx.objectStore(ASSET_STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

  // 鍚庡彴鍒犻櫎浜戠
  _getCurrentUserId().then(async (userId) => {
    if (userId) {
      await deleteAssetFromCloud(id, userId);
    }
  }).catch(() => {});
};

/**
 * 浠嶪ndexedDB涓垹闄ら」鐩強鍏舵墍鏈夊叧鑱旇祫婧?
 * 鐢变簬鎵€鏈夊獟浣撹祫婧愶紙鍥剧墖銆佽棰戯級閮戒互Base64鏍煎紡瀛樺偍鍦ㄩ」鐩璞″唴閮紝
 * 鍒犻櫎椤圭洰璁板綍鏃朵細鑷姩娓呯悊鎵€鏈夌浉鍏宠祫婧愶細
 * - 瑙掕壊鍙傝€冨浘 (Character.referenceImage)
 * - 瑙掕壊鍙樹綋鍙傝€冨浘 (CharacterVariation.referenceImage)
 * - 鍦烘櫙鍙傝€冨浘 (Scene.referenceImage)
 * - 鍏抽敭甯у浘鍍?(Keyframe.imageUrl)
 * - 瑙嗛鐗囨 (VideoInterval.videoUrl)
 * - 娓叉煋鏃ュ織 (RenderLog[])
 * @param id - 椤圭洰ID
 */
export const deleteProjectFromDB = async (id: string): Promise<void> => {
  console.log(`馃棏锔?寮€濮嬪垹闄ら」鐩? ${id}`);
  
  const db = await openDB();
  
  // 鍏堣幏鍙栭」鐩俊鎭互渚胯褰曞垹闄ょ殑璧勬簮缁熻
  let project: ProjectState | null = null;
  try {
    project = await loadProjectFromDB(id);
  } catch (e) {
    console.warn('鏃犳硶鍔犺浇椤圭洰淇℃伅锛岀洿鎺ュ垹闄?);
  }
  
  // 鍒犻櫎鏈湴 IndexedDB
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    
    request.onsuccess = () => {
      if (project) {
        // 缁熻琚垹闄ょ殑璧勬簮
        let resourceCount = {
          characters: 0,
          characterVariations: 0,
          scenes: 0,
          props: 0,
          keyframes: 0,
          videos: 0,
          renderLogs: project.renderLogs?.length || 0
        };
        
        if (project.scriptData) {
          resourceCount.characters = project.scriptData.characters.filter(c => c.referenceImage).length;
          resourceCount.scenes = project.scriptData.scenes.filter(s => s.referenceImage).length;
          resourceCount.props = (project.scriptData.props || []).filter(p => p.referenceImage).length;
          
          // 缁熻瑙掕壊鍙樹綋
          project.scriptData.characters.forEach(c => {
            if (c.variations) {
              resourceCount.characterVariations += c.variations.filter(v => v.referenceImage).length;
            }
          });
        }
        
        if (project.shots) {
          project.shots.forEach(shot => {
            if (shot.keyframes) {
              resourceCount.keyframes += shot.keyframes.filter(kf => kf.imageUrl).length;
            }
            if (shot.interval?.videoUrl) {
              resourceCount.videos++;
            }
          });
        }
        
        console.log(`鉁?椤圭洰宸插垹闄? ${project.title}`);
        console.log(`馃搳 娓呯悊鐨勮祫婧愮粺璁?`, resourceCount);
        console.log(`   - 瑙掕壊鍙傝€冨浘: ${resourceCount.characters}涓猔);
        console.log(`   - 瑙掕壊鍙樹綋鍥? ${resourceCount.characterVariations}涓猔);
        console.log(`   - 鍦烘櫙鍙傝€冨浘: ${resourceCount.scenes}涓猔);
        console.log(`   - 閬撳叿鍙傝€冨浘: ${resourceCount.props}涓猔);
        console.log(`   - 鍏抽敭甯у浘鍍? ${resourceCount.keyframes}涓猔);
        console.log(`   - 瑙嗛鐗囨: ${resourceCount.videos}涓猔);
        console.log(`   - 娓叉煋鏃ュ織: ${resourceCount.renderLogs}鏉);
      } else {
        console.log(`鉁?椤圭洰宸插垹闄? ${id}`);
      }
      
      resolve();
    };
    
    request.onerror = () => {
      console.error(`鉂?鍒犻櫎椤圭洰澶辫触: ${id}`, request.error);
      reject(request.error);
    };
  });

  // 鍚庡彴鍒犻櫎浜戠鏁版嵁锛堜笉闃诲锛?
  _getCurrentUserId().then(async (userId) => {
    if (userId) {
      await deleteProjectFromCloud(id, userId);
      console.log(`鈽侊笍 浜戠椤圭洰宸插垹闄? ${id}`);
    }
  }).catch(() => {
    console.warn('浜戠椤圭洰鍒犻櫎澶辫触锛屼笉褰卞搷鏈湴鎿嶄綔');
  });
};

/**
 * Convert a File object (image) to Base64 data URL
 * @param file - Image file to convert
 * @returns Promise<string> - Base64 data URL (e.g., "data:image/png;base64,...")
 */
export const convertImageToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      reject(new Error('鍙敮鎸佸浘鐗囨枃浠?));
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      reject(new Error('鍥剧墖澶у皬涓嶈兘瓒呰繃 10MB'));
      return;
    }

    const reader = new FileReader();
    
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    
    reader.onerror = () => {
      reject(new Error('鍥剧墖璇诲彇澶辫触'));
    };
    
    reader.readAsDataURL(file);
  });
};

// Initial template for new projects
export const createNewProjectState = (): ProjectState => {
  const id = 'proj_' + Date.now().toString(36);
  return {
    id,
    title: '鏈懡鍚嶉」鐩?,
    createdAt: Date.now(),
    lastModified: Date.now(),
    stage: 'script',
    targetDuration: '60s', // Default duration now 60s
    language: '涓枃', // Default language
    visualStyle: 'live-action', // Default visual style
    shotGenerationModel: 'gpt-5.1', // Default model
    rawScript: `鏍囬锛氱ず渚嬪墽鏈?

鍦烘櫙 1
澶栨櫙銆傚鏅氳閬?- 闆ㄥ
闇撹櫣鐏湪姘村潙涓弽灏勫嚭鐮寸鐨勫厜鑺掋€?
渚︽帰锛?0宀?绌跨潃椋庤。锛夌珯鍦ㄨ瑙?鐐圭噧浜嗕竴鏀儫銆?

渚︽帰
杩欓洦浠€涔堟椂鍊欐墠浼氬仠锛焋,
    scriptData: null,
    shots: [],
    isParsingScript: false,
    renderLogs: [], // Initialize empty render logs array
  };
};


