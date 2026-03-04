import { AssetLibraryItem, EpisodeState, ProjectState } from '../types';

const DB_NAME = 'MeonDB';
const DB_VERSION = 2;
const STORE_NAME = 'projects';
const ASSET_STORE_NAME = 'assetLibrary';
const EXPORT_SCHEMA_VERSION = 1;

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
    throw new Error('导入文件格式不正确');
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
  return localProjects;
};

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
  console.log(`开始删除项目: ${id}`);
  
  const db = await openDB();
  
  // 鍏堣幏鍙栭」鐩俊鎭互渚胯褰曞垹闄ょ殑璧勬簮缁熻
  let project: ProjectState | null = null;
  try {
    project = await loadProjectFromDB(id);
  } catch (e) {
    console.warn('无法加载项目信息，直接删除');
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
        
        console.log(`项目已删除: ${project.title}`);
        console.log('清理的资源统计:', resourceCount);
        console.log(`   - 角色参考图: ${resourceCount.characters} 个`);
        console.log(`   - 角色变体图: ${resourceCount.characterVariations} 个`);
        console.log(`   - 场景参考图: ${resourceCount.scenes} 个`);
        console.log(`   - 道具参考图: ${resourceCount.props} 个`);
        console.log(`   - 关键帧图像: ${resourceCount.keyframes} 个`);
        console.log(`   - 视频片段: ${resourceCount.videos} 个`);
        console.log(`   - 渲染日志: ${resourceCount.renderLogs} 条`);
      } else {
        console.log(`项目已删除: ${id}`);
      }
      
      resolve();
    };
    
    request.onerror = () => {
      console.error(`删除项目失败: ${id}`, request.error);
      reject(request.error);
    };
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
      reject(new Error('只支持图片文件'));
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      reject(new Error('图片大小不能超过 10MB'));
      return;
    }

    const reader = new FileReader();
    
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    
    reader.onerror = () => {
      reject(new Error('图片读取失败'));
    };
    
    reader.readAsDataURL(file);
  });
};

// Initial template for new projects
export const createNewProjectState = (): ProjectState => {
  const id = 'proj_' + Date.now().toString(36);
  return {
    id,
    title: '未命名项目',
    createdAt: Date.now(),
    lastModified: Date.now(),
    stage: 'script',
    targetDuration: '60s', // Default duration now 60s
    language: '中文', // Default language
    visualStyle: 'live-action', // Default visual style
    shotGenerationModel: 'gpt-5.1', // Default model
    rawScript: `标题：示例剧本

场景 1
外景·夜晚·街道 - 雨夜
霓虹灯在水坑中反射出斑驳的光斑。
侦探（30岁，穿着风衣）站在街角，点燃了一支烟。

侦探
这雨什么时候才会停？`,
    scriptData: null,
    shots: [],
    isParsingScript: false,
    renderLogs: [], // Initialize empty render logs array
  };
};

const createNewEpisodeState = (episodeTitle: string): EpisodeState => {
  const id = 'ep_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  return {
    id,
    title: episodeTitle,
    createdAt: Date.now(),
    lastModified: Date.now(),
    stage: 'script',
    targetDuration: '60s',
    language: '中文',
    visualStyle: 'live-action',
    shotGenerationModel: 'gpt-5.1',
    rawScript: '',
    scriptData: null,
    shots: [],
    isParsingScript: false,
    renderLogs: [],
    usedCharacterIds: [],
    usedSceneIds: [],
    usedPropIds: [],
  };
};

export const createNewProjectStateV2 = (): ProjectState => {
  const id = 'proj_' + Date.now().toString(36);
  return {
    id,
    title: '未命名项目',
    createdAt: Date.now(),
    lastModified: Date.now(),
    stage: 'series',
    formatVersion: 'v2',
    migrationPreference: 'migrated',
    sharedLibrary: { characters: [], scenes: [], props: [] },
    series: {
      seasons: [],
      episodes: {},
      activeEpisodeId: undefined,
      expandedSeasonIds: [],
    },
    targetDuration: '60s',
    language: '中文',
    visualStyle: 'live-action',
    shotGenerationModel: 'gpt-5.1',
    rawScript: '',
    scriptData: null,
    shots: [],
    isParsingScript: false,
    renderLogs: [],
  };
};

export const createFirstEpisodeForSeason = (project: ProjectState, seasonId: string, seasonTitle?: string): ProjectState => {
  const episode = createNewEpisodeState('第1集');
  const season = {
    id: seasonId,
    title: seasonTitle || '第一季',
    createdAt: Date.now(),
    episodeIds: [episode.id],
  };
  return {
    ...project,
    stage: 'series',
    formatVersion: 'v2',
    migrationPreference: project.migrationPreference || 'migrated',
    sharedLibrary: project.sharedLibrary || { characters: [], scenes: [], props: [] },
    series: {
      seasons: [season],
      episodes: { [episode.id]: episode },
      activeEpisodeId: episode.id,
      expandedSeasonIds: [season.id],
    },
    lastModified: Date.now(),
  };
};


