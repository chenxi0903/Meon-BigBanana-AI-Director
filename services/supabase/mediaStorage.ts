/**
 * 媒体文件存储服务
 * 处理 base64 数据与 Supabase Storage 之间的上传/下载
 * 
 * Storage 路径规则：{user_id}/{project_id}/{type}/{filename}
 * type: characters / scenes / props / keyframes / videos
 */

import { supabase, isSupabaseConfigured } from './client';

const BUCKET_NAME = 'project-media';

// ============================================
// 类型定义
// ============================================

export type MediaType = 'characters' | 'scenes' | 'props' | 'keyframes' | 'videos' | 'turnarounds' | 'ninegrid';

export interface UploadResult {
  /** Storage 中的完整路径 */
  path: string;
  /** 公开访问的 URL */
  url: string;
}

// ============================================
// 工具函数
// ============================================

/**
 * 将 base64 data URL 转换为 Blob
 */
function base64ToBlob(base64DataUrl: string): Blob {
  // 格式: data:image/png;base64,xxxx 或 data:video/mp4;base64,xxxx
  const parts = base64DataUrl.split(',');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const binaryString = atob(parts[1]);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

/**
 * 从 base64 data URL 获取文件扩展名
 */
function getExtensionFromBase64(base64DataUrl: string): string {
  if (base64DataUrl.startsWith('data:image/png')) return '.png';
  if (base64DataUrl.startsWith('data:image/jpeg') || base64DataUrl.startsWith('data:image/jpg')) return '.jpg';
  if (base64DataUrl.startsWith('data:image/webp')) return '.webp';
  if (base64DataUrl.startsWith('data:image/gif')) return '.gif';
  if (base64DataUrl.startsWith('data:video/mp4')) return '.mp4';
  if (base64DataUrl.startsWith('data:video/webm')) return '.webm';
  return '.bin';
}

/**
 * 判断字符串是否是 base64 data URL
 */
export function isBase64DataUrl(str: string | undefined): boolean {
  if (!str) return false;
  return str.startsWith('data:');
}

/**
 * 判断字符串是否是 Supabase Storage URL
 */
export function isStorageUrl(str: string | undefined): boolean {
  if (!str) return false;
  return str.includes('/storage/v1/object/') || str.startsWith('https://');
}

/**
 * 生成存储路径
 */
function buildStoragePath(
  userId: string,
  projectId: string,
  type: MediaType,
  resourceId: string,
  extension: string
): string {
  return `${userId}/${projectId}/${type}/${resourceId}${extension}`;
}

/**
 * 生成内容哈希（简化版：使用数据长度+头部作为快速指纹）
 * 用于判断内容是否变化，避免重复上传
 */
function quickFingerprint(base64DataUrl: string): string {
  const data = base64DataUrl.split(',')[1] || '';
  // 取长度 + 前100字符 + 后100字符作为指纹
  const head = data.slice(0, 100);
  const tail = data.slice(-100);
  return `${data.length}:${head}:${tail}`;
}

// ============================================
// 上传缓存（避免同一内容重复上传）
// ============================================

/** 缓存: fingerprint → storage URL */
const uploadCache = new Map<string, string>();

// ============================================
// 核心操作
// ============================================

/**
 * 上传媒体文件到 Supabase Storage
 * @param userId 用户 ID
 * @param projectId 项目 ID
 * @param type 资源类型
 * @param resourceId 资源 ID（如 character ID、keyframe ID 等）
 * @param base64DataUrl base64 格式数据（data:image/png;base64,...）
 * @returns UploadResult 或 null（如果上传失败或 Supabase 未配置）
 */
export async function uploadMedia(
  userId: string,
  projectId: string,
  type: MediaType,
  resourceId: string,
  base64DataUrl: string
): Promise<UploadResult | null> {
  if (!supabase || !isSupabaseConfigured()) {
    return null;
  }

  // 检查缓存：如果内容没变则跳过上传
  const fingerprint = quickFingerprint(base64DataUrl);
  const cachedUrl = uploadCache.get(fingerprint);
  if (cachedUrl) {
    return {
      path: `${userId}/${projectId}/${type}/${resourceId}${getExtensionFromBase64(base64DataUrl)}`,
      url: cachedUrl,
    };
  }

  try {
    const blob = base64ToBlob(base64DataUrl);
    const extension = getExtensionFromBase64(base64DataUrl);
    const path = buildStoragePath(userId, projectId, type, resourceId, extension);

    // upsert: 如果文件已存在则覆盖
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(path, blob, {
        contentType: blob.type,
        upsert: true,
      });

    if (uploadError) {
      console.error(`[MediaStorage] 上传失败 (${path}):`, uploadError);
      return null;
    }

    // 获取公开 URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(path);

    const url = urlData.publicUrl;

    // 缓存
    uploadCache.set(fingerprint, url);

    return { path, url };
  } catch (err) {
    console.error('[MediaStorage] 上传异常:', err);
    return null;
  }
}

/**
 * 批量上传媒体文件
 * 并发控制，避免同时发起过多请求
 */
export async function uploadMediaBatch(
  items: Array<{
    userId: string;
    projectId: string;
    type: MediaType;
    resourceId: string;
    base64DataUrl: string;
  }>,
  concurrency: number = 3
): Promise<Map<string, UploadResult>> {
  const results = new Map<string, UploadResult>();

  // 分批处理
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const promises = batch.map(async (item) => {
      const result = await uploadMedia(
        item.userId,
        item.projectId,
        item.type,
        item.resourceId,
        item.base64DataUrl
      );
      if (result) {
        results.set(item.resourceId, result);
      }
    });
    await Promise.all(promises);
  }

  return results;
}

/**
 * 删除 Storage 中的文件
 */
export async function deleteMedia(path: string): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured()) {
    return false;
  }

  try {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([path]);

    if (error) {
      console.error(`[MediaStorage] 删除失败 (${path}):`, error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[MediaStorage] 删除异常:', err);
    return false;
  }
}

/**
 * 删除项目下所有媒体文件
 */
export async function deleteProjectMedia(userId: string, projectId: string): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured()) {
    return false;
  }

  try {
    const prefix = `${userId}/${projectId}/`;
    const { data: files, error: listError } = await supabase.storage
      .from(BUCKET_NAME)
      .list(prefix, { limit: 1000 });

    if (listError || !files) {
      console.error('[MediaStorage] 列出项目文件失败:', listError);
      return false;
    }

    if (files.length === 0) return true;

    // 递归列出子目录中的所有文件
    const allFiles: string[] = [];
    const types: MediaType[] = ['characters', 'scenes', 'props', 'keyframes', 'videos', 'turnarounds', 'ninegrid'];

    for (const type of types) {
      const subPrefix = `${prefix}${type}/`;
      const { data: subFiles } = await supabase.storage
        .from(BUCKET_NAME)
        .list(subPrefix, { limit: 1000 });

      if (subFiles) {
        subFiles.forEach((f) => allFiles.push(`${subPrefix}${f.name}`));
      }
    }

    if (allFiles.length > 0) {
      const { error: removeError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove(allFiles);

      if (removeError) {
        console.error('[MediaStorage] 批量删除失败:', removeError);
        return false;
      }
    }

    return true;
  } catch (err) {
    console.error('[MediaStorage] 删除项目媒体异常:', err);
    return false;
  }
}

/**
 * 获取带签名的临时 URL（适用于 Private bucket）
 * @param path Storage 中的路径
 * @param expiresIn 有效期（秒），默认 1 小时
 */
export async function getSignedUrl(path: string, expiresIn: number = 3600): Promise<string | null> {
  if (!supabase || !isSupabaseConfigured()) {
    return null;
  }

  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(path, expiresIn);

    if (error || !data) {
      console.error(`[MediaStorage] 获取签名 URL 失败 (${path}):`, error);
      return null;
    }

    return data.signedUrl;
  } catch (err) {
    console.error('[MediaStorage] 获取签名 URL 异常:', err);
    return null;
  }
}

/**
 * 获取公开 URL（适用于 Public bucket）
 */
export function getPublicUrl(path: string): string | null {
  if (!supabase || !isSupabaseConfigured()) {
    return null;
  }

  const { data } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(path);

  return data.publicUrl || null;
}

/**
 * 清空上传缓存（在切换用户或重新登录时调用）
 */
export function clearUploadCache(): void {
  uploadCache.clear();
}
