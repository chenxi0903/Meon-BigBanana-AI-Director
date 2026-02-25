/**
 * 模型服务统一入口
 * 应用层只需调用这些函数，无需关心底层模型
 */

import {
  ChatOptions,
  ImageGenerateOptions,
  VideoGenerateOptions,
  AspectRatio,
  VideoDuration,
} from '../types/model';

import { callChatApi, ApiKeyError } from './adapters/chatAdapter';
import { callImageApi } from './adapters/imageAdapter';
import { callVideoApi } from './adapters/videoAdapter';
import {
  getActiveVideoModel,
} from './modelRegistry';
import {
  buildSimpleScriptParsePrompt,
  buildSimpleShotGenerationPrompt,
  buildSimpleVisualPromptGenerationPrompt,
  buildKeyframeOptimizationPrompt,
  buildActionSuggestionPrompt,
  buildShotSplitPrompt
} from './ai/prompts';

// 导出 ApiKeyError 供外部使用
export { ApiKeyError };

// ============================================
// 基础模型调用
// ============================================

/**
 * 调用对话模型
 * @param options 调用参数
 * @returns AI 生成的文本
 */
export const chat = async (options: ChatOptions): Promise<string> => {
  return callChatApi(options);
};

/**
 * 调用对话模型（JSON 格式响应）
 * @param options 调用参数
 * @returns AI 生成的 JSON 字符串
 */
export const chatJson = async (options: Omit<ChatOptions, 'responseFormat'>): Promise<string> => {
  return callChatApi({ ...options, responseFormat: 'json' });
};

/**
 * 生成图片
 * @param options 生成参数
 * @returns Base64 格式的图片数据
 */
export const generateImage = async (options: ImageGenerateOptions): Promise<string> => {
  return callImageApi(options);
};

/**
 * 生成视频
 * @param options 生成参数
 * @returns Base64 格式的视频数据
 */
export const generateVideo = async (options: VideoGenerateOptions): Promise<string> => {
  return callVideoApi(options);
};

// ============================================
// 高级业务函数
// ============================================

/**
 * 解析剧本为结构化数据
 */
export const parseScript = async (options: {
  rawText: string;
  language: string;
  visualStyle: string;
}): Promise<any> => {
  const prompt = buildSimpleScriptParsePrompt(options.rawText, options.language, options.visualStyle);
  const result = await chatJson({ prompt, timeout: 600000 });
  return JSON.parse(result);
};

/**
 * 生成分镜列表
 */
export const generateShots = async (options: {
  scriptData: any;
}): Promise<any[]> => {
  const prompt = buildSimpleShotGenerationPrompt(options.scriptData);
  const result = await chatJson({ prompt, timeout: 600000 });
  const parsed = JSON.parse(result);
  return parsed.shots || [];
};

/**
 * 生成视觉提示词
 */
export const generateVisualPrompts = async (options: {
  type: 'character' | 'scene';
  data: any;
  genre: string;
  visualStyle: string;
  language: string;
}): Promise<{ visualPrompt: string; negativePrompt: string }> => {
  const prompt = buildSimpleVisualPromptGenerationPrompt(options);
  const result = await chatJson({ prompt });
  return JSON.parse(result);
};

/**
 * 优化关键帧提示词
 */
export const optimizeKeyframePrompt = async (options: {
  frameType: 'start' | 'end';
  actionSummary: string;
  cameraMovement: string;
  sceneInfo: string;
  characterInfo: string;
  visualStyle: string;
}): Promise<string> => {
  const prompt = buildKeyframeOptimizationPrompt(options);
  return chat({ prompt });
};

/**
 * 生成动作建议
 */
export const generateActionSuggestion = async (options: {
  startFramePrompt: string;
  endFramePrompt: string;
  cameraMovement: string;
}): Promise<string> => {
  const prompt = buildActionSuggestionPrompt(options);
  return chat({ prompt });
};

/**
 * 拆分镜头
 */
export const splitShot = async (options: {
  shot: any;
  sceneInfo: string;
  characterNames: string[];
  visualStyle: string;
}): Promise<{ subShots: any[] }> => {
  const prompt = buildShotSplitPrompt(options);
  const result = await chatJson({ prompt });
  return JSON.parse(result);
};

// ============================================
// 辅助函数
// ============================================

/**
 * 获取当前视频模型的支持参数
 */
export const getVideoModelCapabilities = (): {
  supportedAspectRatios: AspectRatio[];
  supportedDurations: VideoDuration[];
  defaultAspectRatio: AspectRatio;
  defaultDuration: VideoDuration;
} => {
  const model = getActiveVideoModel();
  if (!model) {
    return {
      supportedAspectRatios: ['16:9', '9:16', '1:1'],
      supportedDurations: [4, 8, 12],
      defaultAspectRatio: '16:9',
      defaultDuration: 8,
    };
  }
  
  return {
    supportedAspectRatios: model.params.supportedAspectRatios,
    supportedDurations: model.params.supportedDurations,
    defaultAspectRatio: model.params.defaultAspectRatio,
    defaultDuration: model.params.defaultDuration,
  };
};


