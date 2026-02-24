/**
 * 即梦（Jimeng）视频模型适配器
 * 处理即梦反代的视频生成 API
 *
 * 视频生成: POST /v1/videos/generations
 * 支持: 文生视频、图生视频（首帧）、首尾帧视频
 */

import { VideoModelDefinition, VideoGenerateOptions, AspectRatio, VideoDuration } from '../../types/model';
import { getApiKeyForModel, getApiBaseUrlForModel, getActiveVideoModel } from '../modelRegistry';
import { ApiKeyError } from './chatAdapter';

/**
 * 重试操作
 */
const retryOperation = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 2000
): Promise<T> => {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      if (
        error.message?.includes('400') ||
        error.message?.includes('401') ||
        error.message?.includes('403')
      ) {
        throw error;
      }
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
  }

  throw lastError;
};

/**
 * 将 base64 图片数据转为 Blob
 */
const base64ToBlob = (base64: string, mimeType: string = 'image/png'): Blob => {
  const match = base64.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
  const actualMime = match ? match[1] : mimeType;
  const actualData = match ? match[2] : base64.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
  const byteCharacters = atob(actualData);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: actualMime });
};

/**
 * 下载视频 URL 并转为 base64
 */
const downloadVideoAsBase64 = async (url: string): Promise<string> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`视频下载失败: HTTP ${response.status}`);
  }
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      if (result && result.startsWith('data:')) {
        resolve(result);
      } else {
        reject(new Error('视频转换为 base64 失败'));
      }
    };
    reader.onerror = () => reject(new Error('视频读取失败'));
    reader.readAsDataURL(blob);
  });
};

/**
 * 判断模型是否为即梦视频模型
 */
export const isJimengVideoModel = (model: VideoModelDefinition): boolean => {
  return model.providerId === 'jimeng' || model.id.startsWith('jimeng-video-') || model.params.mode === 'jimeng';
};

/**
 * 调用即梦视频生成 API
 * POST /v1/videos/generations
 *
 * 支持模式：
 * 1. 纯文生视频 - 仅传 prompt
 * 2. 图生视频（首帧） - 传 prompt + startImage
 * 3. 首尾帧视频 - 传 prompt + startImage + endImage
 */
export const callJimengVideoApi = async (
  options: VideoGenerateOptions,
  model?: VideoModelDefinition
): Promise<string> => {
  // 获取当前激活的模型
  const activeModel = model || getActiveVideoModel();
  if (!activeModel) {
    throw new Error('没有可用的即梦视频模型');
  }

  // 获取 API 配置
  const apiKey = getApiKeyForModel(activeModel.id);
  if (!apiKey) {
    throw new ApiKeyError('即梦 Session Token 缺失，请在模型配置中为即梦提供商设置 Session Token（作为 API Key）');
  }

  const apiBase = getApiBaseUrlForModel(activeModel.id);
  const apiModel = activeModel.apiModel || activeModel.id;
  const ratio = options.aspectRatio || activeModel.params.defaultAspectRatio;
  const duration = options.duration || activeModel.params.defaultDuration;
  const resolution = activeModel.params.resolution || '1080p';
  const hasStartImage = !!options.startImage;
  const hasEndImage = !!options.endImage;

  console.log(`🎬 即梦视频生成请求: model=${apiModel}, ratio=${ratio}, duration=${duration}s, resolution=${resolution}`);
  console.log(`   输入: ${hasStartImage ? '首帧图' : '无图'}${hasEndImage ? ' + 尾帧图' : ''}`);

  // 即梦视频 API 超时较长（服务端内部轮询）
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1200000); // 20 分钟

  try {
    let response: any;

    if (hasStartImage || hasEndImage) {
      // 有图片参考 → 使用 multipart/form-data
      const formData = new FormData();
      formData.append('model', apiModel);
      formData.append('prompt', options.prompt);
      formData.append('ratio', ratio);
      formData.append('duration', String(duration));
      formData.append('resolution', resolution);

      // 添加首帧图
      if (options.startImage) {
        const blob = base64ToBlob(options.startImage);
        formData.append('image_file_1', blob, 'first-frame.png');
      }

      // 添加尾帧图
      if (options.endImage) {
        const blob = base64ToBlob(options.endImage);
        formData.append('image_file_2', blob, 'last-frame.png');
      }

      response = await retryOperation(async () => {
        const res = await fetch(`${apiBase}/v1/videos/generations`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
          body: formData,
          signal: controller.signal,
        });

        if (!res.ok) {
          let errorMessage = `HTTP 错误: ${res.status}`;
          try {
            const errorData = await res.json();
            errorMessage = errorData.error?.message || errorData.message || errorMessage;
          } catch (e) {
            const errorText = await res.text();
            if (errorText) errorMessage = errorText;
          }
          throw new Error(errorMessage);
        }

        return await res.json();
      });
    } else {
      // 纯文生视频 → 使用 JSON
      const requestBody: any = {
        model: apiModel,
        prompt: options.prompt,
        ratio,
        duration,
        resolution,
        response_format: 'url',
      };

      response = await retryOperation(async () => {
        const res = await fetch(`${apiBase}/v1/videos/generations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        if (!res.ok) {
          let errorMessage = `HTTP 错误: ${res.status}`;
          try {
            const errorData = await res.json();
            errorMessage = errorData.error?.message || errorData.message || errorMessage;
          } catch (e) {
            const errorText = await res.text();
            if (errorText) errorMessage = errorText;
          }
          throw new Error(errorMessage);
        }

        return await res.json();
      });
    }

    clearTimeout(timeoutId);

    // 解析返回结果
    // 即梦返回格式: { created, data: [{ url }] }
    const data = response.data;
    if (data && data.length > 0 && data[0].url) {
      const videoUrl = data[0].url;
      console.log('✅ 即梦视频生成成功，正在下载视频...');
      const videoBase64 = await downloadVideoAsBase64(videoUrl);
      console.log('✅ 即梦视频已转换为 base64');
      return videoBase64;
    }

    // 兼容其他返回格式（如直接返回 video_url）
    const videoUrl = response.video_url || response.videoUrl || response.url;
    if (videoUrl) {
      console.log('✅ 即梦视频生成成功（备用格式），正在下载视频...');
      const videoBase64 = await downloadVideoAsBase64(videoUrl);
      console.log('✅ 即梦视频已转换为 base64');
      return videoBase64;
    }

    throw new Error('即梦视频生成失败：未返回视频数据');
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('即梦视频生成超时 (20分钟)');
    }
    throw error;
  }
};

/**
 * 检查宽高比是否支持
 */
export const isJimengAspectRatioSupported = (
  aspectRatio: AspectRatio,
  model?: VideoModelDefinition
): boolean => {
  const activeModel = model || getActiveVideoModel();
  if (!activeModel) return false;

  return activeModel.params.supportedAspectRatios.includes(aspectRatio);
};

/**
 * 检查时长是否支持
 */
export const isJimengDurationSupported = (
  duration: VideoDuration,
  model?: VideoModelDefinition
): boolean => {
  const activeModel = model || getActiveVideoModel();
  if (!activeModel) return false;

  return activeModel.params.supportedDurations.includes(duration);
};
