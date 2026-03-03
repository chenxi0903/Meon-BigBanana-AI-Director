/**
 * 图片模型适配器
 * 处理 Gemini Image API，支持即梦反代路由分发
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { ImageModelDefinition, ImageGenerateOptions, AspectRatio } from '../../types/model';
import { getApiKeyForModel, getApiBaseUrlForModel, getActiveImageModel } from '../modelRegistry';
import { ApiKeyError } from './chatAdapter';
import { isJimengImageModel, callJimengImageApi } from './jimengImageAdapter';

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
      if (error.message?.includes('400') || 
          error.message?.includes('401') || 
          error.message?.includes('403')) {
        throw error;
      }
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
  }
  
  throw lastError;
};

const buildImageGenerationRequest = (
  options: ImageGenerateOptions,
  model: ImageModelDefinition
) => {
  const aspectRatio = options.aspectRatio || model.params.defaultAspectRatio;
  let finalPrompt = options.prompt;

  if (options.referenceImages && options.referenceImages.length > 0) {
    finalPrompt = `
      ⚠️⚠️⚠️ CRITICAL REQUIREMENTS - CHARACTER CONSISTENCY ⚠️⚠️⚠️
      
      Reference Images Information:
      - The FIRST image is the Scene/Environment reference.
      - Any subsequent images are Character references (Base Look or Variation).
      
      Task:
      Generate a cinematic shot matching this prompt: "${options.prompt}".
      
      ⚠️ ABSOLUTE REQUIREMENTS (NON-NEGOTIABLE):
      1. Scene Consistency:
         - STRICTLY maintain the visual style, lighting, and environment from the scene reference.
      
      2. Character Consistency - HIGHEST PRIORITY:
         If characters are present in the prompt, they MUST be IDENTICAL to the character reference images:
         • Facial Features: Eyes (color, shape, size), nose structure, mouth shape, facial contours must be EXACTLY the same
         • Hairstyle & Hair Color: Length, color, texture, and style must be PERFECTLY matched
         • Clothing & Outfit: Style, color, material, and accessories must be IDENTICAL
         • Body Type: Height, build, proportions must remain consistent
         
      ⚠️ DO NOT create variations or interpretations of the character - STRICT REPLICATION ONLY!
      ⚠️ Character appearance consistency is THE MOST IMPORTANT requirement!
    `;
  }

  const parts: any[] = [{ text: finalPrompt }];

  if (options.referenceImages) {
    options.referenceImages.forEach((imgUrl) => {
      const match = imgUrl.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
      if (match) {
        parts.push({
          inlineData: {
            mimeType: match[1],
            data: match[2],
          },
        });
      }
    });
  }

  const generationConfig: any = {
    responseModalities: ['TEXT', 'IMAGE'],
  };

  if (aspectRatio !== '16:9') {
    generationConfig.imageConfig = {
      aspectRatio: aspectRatio,
    };
  }

  return { parts, generationConfig };
};

const extractInlineImage = (response: any): string | null => {
  const candidates = response?.candidates || [];
  for (const candidate of candidates) {
    const parts = candidate?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData?.data) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
  }
  return null;
};

const callGoogleGenAiImageApi = async (
  options: ImageGenerateOptions,
  model: ImageModelDefinition,
  apiKey: string
): Promise<string> => {
  const apiModel = model.apiModel || model.id;
  if (options.signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  const genModel = genAI.getGenerativeModel({ model: apiModel });
  const { parts, generationConfig } = buildImageGenerationRequest(options, model);

  try {
    const result = await retryOperation(async () => {
      return await genModel.generateContent({
        contents: [{ role: 'user', parts }],
        generationConfig,
      });
    });

    if (options.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    const imageData = extractInlineImage(result.response);
    if (imageData) {
      return imageData;
    }
  } catch (error: any) {
    if (error?.message) {
      throw new Error(error.message);
    }
    throw error;
  }

  throw new Error('图片生成失败：未能从响应中提取图片数据');
};

/**
 * 调用图片生成 API
 * 自动根据模型提供商路由到对应的适配器
 */
export const callImageApi = async (
  options: ImageGenerateOptions,
  model?: ImageModelDefinition
): Promise<string> => {
  // 获取当前激活的模型
  const activeModel = model || getActiveImageModel();
  if (!activeModel) {
    throw new Error('没有可用的图片模型');
  }

  // 即梦模型路由
  if (isJimengImageModel(activeModel)) {
    return callJimengImageApi(options, activeModel);
  }

  // 获取 API 配置
  const apiKey = getApiKeyForModel(activeModel.id);
  if (!apiKey) {
    throw new ApiKeyError('API Key 缺失，请在设置中配置 API Key');
  }
  
  if (activeModel.providerId === 'google') {
    return callGoogleGenAiImageApi(options, activeModel, apiKey);
  }

  const apiBase = getApiBaseUrlForModel(activeModel.id);
  const apiModel = activeModel.apiModel || activeModel.id;
  const endpoint = activeModel.endpoint || `/v1beta/models/${apiModel}:generateContent`;
  const { parts, generationConfig } = buildImageGenerationRequest(options, activeModel);
  const requestBody: any = {
    contents: [{
      role: 'user',
      parts: parts,
    }],
    generationConfig: generationConfig,
  };

  // 调用 API
  const response = await retryOperation(async () => {
    const res = await fetch(`${apiBase}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Accept': '*/*',
      },
      body: JSON.stringify(requestBody),
      signal: options.signal,
    });

    if (!res.ok) {
      if (res.status === 400) {
        throw new Error('提示词可能包含不安全或违规内容，未能处理。请修改后重试。');
      }
      if (res.status === 500) {
        throw new Error('当前请求较多，暂时未能处理成功，请稍后重试。');
      }
      
      let errorMessage = `HTTP 错误: ${res.status}`;
      try {
        const errorData = await res.json();
        errorMessage = errorData.error?.message || errorMessage;
      } catch (e) {
        const errorText = await res.text();
        if (errorText) errorMessage = errorText;
      }
      throw new Error(errorMessage);
    }

    return await res.json();
  });

  const imageData = extractInlineImage(response);
  if (imageData) {
    return imageData;
  }

  throw new Error('图片生成失败：未能从响应中提取图片数据');
};

/**
 * 检查宽高比是否支持
 */
export const isAspectRatioSupported = (
  aspectRatio: AspectRatio,
  model?: ImageModelDefinition
): boolean => {
  const activeModel = model || getActiveImageModel();
  if (!activeModel) return false;
  
  return activeModel.params.supportedAspectRatios.includes(aspectRatio);
};
