/**
 * 即梦（Jimeng）图片模型适配器
 * 处理即梦反代的文生图 / 图生图 API
 *
 * 文生图: POST /v1/images/generations
 * 图生图: POST /v1/images/compositions
 */

import { ImageModelDefinition, ImageGenerateOptions, AspectRatio } from '../../types/model';
import { getApiKeyForModel, getApiBaseUrlForModel, getActiveImageModel } from '../modelRegistry';
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
      // 400/401/403 错误不重试
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
 * 将即梦 AspectRatio 映射到即梦 API 接受的 ratio 字符串
 * 即梦支持: 1:1, 4:3, 3:4, 16:9, 9:16, 3:2, 2:3, 21:9
 */
const mapAspectRatioToJimeng = (ratio: AspectRatio): string => {
  // 即梦直接使用相同格式的比例字符串
  return ratio;
};

/**
 * 下载图片 URL 并转为 base64
 */
const downloadImageAsBase64 = async (url: string): Promise<string> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`图片下载失败: HTTP ${response.status}`);
  }
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      if (result && result.startsWith('data:')) {
        resolve(result);
      } else {
        reject(new Error('图片转换为 base64 失败'));
      }
    };
    reader.onerror = () => reject(new Error('图片读取失败'));
    reader.readAsDataURL(blob);
  });
};

/**
 * 调用即梦文生图 API
 * POST /v1/images/generations
 */
const callJimengTextToImage = async (
  options: ImageGenerateOptions,
  model: ImageModelDefinition,
  apiKey: string,
  apiBase: string
): Promise<string> => {
  const apiModel = model.apiModel || model.id;
  const ratio = mapAspectRatioToJimeng(options.aspectRatio || model.params.defaultAspectRatio);
  const initialResolution = model.params.resolution || '2k';

  const performRequest = async (currentResolution: string) => {
    const requestBody: any = {
      model: apiModel,
      prompt: options.prompt,
      ratio,
      resolution: currentResolution,
      response_format: 'url',
    };

    // 添加可选参数
    if (model.params.negativePrompt) {
      requestBody.negative_prompt = model.params.negativePrompt;
    }
    if (model.params.sampleStrength !== undefined) {
      requestBody.sample_strength = model.params.sampleStrength;
    }

    console.log(`🖼️ 即梦文生图请求: model=${apiModel}, ratio=${ratio}, resolution=${currentResolution}`);

    const response = await retryOperation(async () => {
      const res = await fetch(`${apiBase}/v1/images/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
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

    // 检查业务逻辑错误 (例如 ret="1000", errmsg="invalid parameter")
    if (response.ret && response.ret !== '0' && response.ret !== 0) {
      throw new Error(`即梦API错误: ${response.errmsg || '未知错误'} (${response.ret})`);
    }

    // 解析返回: { created, data: [{ url }] }
    const data = response.data;
    if (!data || data.length === 0 || !data[0].url) {
      throw new Error('即梦图片生成失败：未返回图片数据');
    }

    const imageUrl = data[0].url;
    console.log('✅ 即梦文生图成功，正在下载图片...');

    // 下载图片转 base64
    const base64 = await downloadImageAsBase64(imageUrl);
    console.log('✅ 即梦图片已转换为 base64');
    return base64;
  };

  try {
    return await performRequest(initialResolution);
  } catch (error: any) {
    // 自动降级重试：如果分辨率是 2k 且遇到参数错误，尝试降级到 1k
    // 错误码 1000 通常表示参数无效 (invalid parameter)
    if (initialResolution === '2k' && 
        (error.message?.includes('1000') || error.message?.includes('invalid parameter') || error.message?.includes('400'))) {
      console.warn(`⚠️ 2k 分辨率请求失败 (${error.message})，尝试降级到 1k...`);
      return await performRequest('1k');
    }
    
    // 如果是未返回图片数据，也可能是分辨率/参数问题导致的静默失败，尝试降级
    if (initialResolution === '2k' && error.message?.includes('未返回图片数据')) {
      console.warn(`⚠️ 2k 分辨率请求可能失败 (${error.message})，尝试降级到 1k...`);
      return await performRequest('1k');
    }

    throw error;
  }
};

/**
 * 调用即梦图生图 API
 * POST /v1/images/compositions
 * 支持 JSON (远程URL) 和 multipart/form-data (本地文件) 两种方式
 */
const callJimengImageToImage = async (
  options: ImageGenerateOptions,
  model: ImageModelDefinition,
  apiKey: string,
  apiBase: string
): Promise<string> => {
  const apiModel = model.apiModel || model.id;
  const ratio = mapAspectRatioToJimeng(options.aspectRatio || model.params.defaultAspectRatio);
  const resolution = model.params.resolution || '2k';
  const referenceImages = options.referenceImages || [];

  console.log(`🖼️ 即梦图生图请求: model=${apiModel}, ratio=${ratio}, images=${referenceImages.length}张`);

  // 检查参考图是否为 URL 或 base64
  const hasBase64Images = referenceImages.some(img => img.startsWith('data:'));

  let response: any;

  if (hasBase64Images) {
    // 使用 multipart/form-data 上传本地图片
    const formData = new FormData();
    formData.append('prompt', options.prompt);
    formData.append('model', apiModel);
    formData.append('ratio', ratio);
    formData.append('resolution', resolution);
    formData.append('response_format', 'url');

    if (model.params.negativePrompt) {
      formData.append('negative_prompt', model.params.negativePrompt);
    }
    if (model.params.sampleStrength !== undefined) {
      formData.append('sample_strength', String(model.params.sampleStrength));
    }

    // 添加图片
    referenceImages.forEach((img, index) => {
      if (img.startsWith('data:')) {
        const blob = base64ToBlob(img);
        formData.append('images', blob, `image_${index}.png`);
      }
    });

    response = await retryOperation(async () => {
      const res = await fetch(`${apiBase}/v1/images/compositions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: formData,
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
    // 使用 JSON + 远程 URL
    const requestBody: any = {
      model: apiModel,
      prompt: options.prompt,
      images: referenceImages,
      ratio,
      resolution,
      response_format: 'url',
    };

    if (model.params.negativePrompt) {
      requestBody.negative_prompt = model.params.negativePrompt;
    }
    if (model.params.sampleStrength !== undefined) {
      requestBody.sample_strength = model.params.sampleStrength;
    }

    response = await retryOperation(async () => {
      const res = await fetch(`${apiBase}/v1/images/compositions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
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

  // 解析返回: { created, data: [{ url }] }
  const data = response.data;
  if (!data || data.length === 0 || !data[0].url) {
    throw new Error('即梦图生图失败：未返回图片数据');
  }

  const imageUrl = data[0].url;
  console.log('✅ 即梦图生图成功，正在下载图片...');

  const base64 = await downloadImageAsBase64(imageUrl);
  console.log('✅ 即梦图片已转换为 base64');
  return base64;
};

/**
 * 判断模型是否为即梦图片模型
 */
export const isJimengImageModel = (model: ImageModelDefinition): boolean => {
  return model.providerId === 'jimeng' || model.id.startsWith('jimeng-');
};

/**
 * 调用即梦图片生成 API（统一入口）
 * 根据是否有参考图自动选择文生图或图生图
 */
export const callJimengImageApi = async (
  options: ImageGenerateOptions,
  model?: ImageModelDefinition
): Promise<string> => {
  // 获取当前激活的模型
  const activeModel = model || getActiveImageModel();
  if (!activeModel) {
    throw new Error('没有可用的即梦图片模型');
  }

  // 获取 API 配置
  const apiKey = getApiKeyForModel(activeModel.id);
  if (!apiKey) {
    throw new ApiKeyError('即梦 Session Token 缺失，请在模型配置中为即梦提供商设置 Session Token（作为 API Key）');
  }

  const apiBase = getApiBaseUrlForModel(activeModel.id);

  // 根据是否有参考图选择接口
  if (options.referenceImages && options.referenceImages.length > 0) {
    return callJimengImageToImage(options, activeModel, apiKey, apiBase);
  } else {
    return callJimengTextToImage(options, activeModel, apiKey, apiBase);
  }
};
