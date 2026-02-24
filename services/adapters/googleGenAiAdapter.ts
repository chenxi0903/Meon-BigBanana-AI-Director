/**
 * Google GenAI SDK 适配器
 * 使用 @google/generative-ai SDK 调用 Google Gemini 模型
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { ChatModelDefinition, ChatOptions, ChatModelParams } from '../../types/model';
import { getApiKeyForModel, getApiBaseUrlForModel } from '../modelRegistry';
import { ApiKeyError } from './chatAdapter';

/**
 * 重试操作
 */
const retryOperation = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
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

/**
 * 清理 JSON 响应
 */
const cleanJsonResponse = (response: string): string => {
  let cleaned = response.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
  cleaned = cleaned.replace(/```\s*$/, '');
  return cleaned.trim();
};

/**
 * 调用 Google GenAI SDK 对话模型 API
 */
export const callGoogleGenAiChatApi = async (
  options: ChatOptions,
  model?: ChatModelDefinition
): Promise<string> => {
  // 获取当前激活的模型
  const activeModel = model;
  if (!activeModel) {
    throw new Error('没有可用的对话模型');
  }

  // 获取 API 配置
  const apiKey = getApiKeyForModel(activeModel.id);
  if (!apiKey) {
    throw new ApiKeyError('API Key 缺失，请在设置中配置 API Key');
  }
  
  const apiModel = activeModel.apiModel || activeModel.id;
  
  // 合并参数
  const params: ChatModelParams = {
    ...activeModel.params,
    ...options.overrideParams,
  };
  
  // 初始化 Google GenAI 客户端
  const genAI = new GoogleGenerativeAI(apiKey);
  const genModel = genAI.getGenerativeModel({ model: apiModel });
  
  // 构建消息内容
  let prompt = '';
  if (options.systemPrompt) {
    prompt = `${options.systemPrompt}\n\n${options.prompt}`;
  } else {
    prompt = options.prompt;
  }
  
  // 构建生成配置
  const generationConfig: any = {
    temperature: params.temperature,
  };
  
  if (params.maxTokens !== undefined) {
    generationConfig.maxOutputTokens = params.maxTokens;
  }
  
  if (params.topP !== undefined) {
    generationConfig.topP = params.topP;
  }
  
  // JSON 格式响应
  if (options.responseFormat === 'json') {
    generationConfig.responseMimeType = 'application/json';
  }
  
  // 超时控制
  const timeout = options.timeout || 600000; // 默认 10 分钟
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const result = await retryOperation(async () => {
      const response = await genModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig,
      });
      
      return response;
    });
    
    clearTimeout(timeoutId);
    
    const responseText = result.response.text();
    
    // 如果是 JSON 格式，清理响应
    if (options.responseFormat === 'json') {
      return cleanJsonResponse(responseText);
    }
    
    return responseText;
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error(`请求超时 (${timeout / 1000}秒)`);
    }
    
    // 处理 Google GenAI SDK 的错误
    if (error.message) {
      throw new Error(error.message);
    }
    
    throw error;
  }
};
