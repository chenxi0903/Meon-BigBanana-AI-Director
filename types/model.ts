/**
 * 模型抽象层类型定义
 * 定义模型注册、配置、适配器相关的所有类型
 */

// ============================================
// 基础类型
// ============================================

/**
 * 模型类型
 */
export type ModelType = 'chat' | 'image' | 'video';

/**
 * 横竖屏比例类型
 * 包含即梦支持的额外比例
 */
export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '3:2' | '2:3' | '21:9';

/**
 * 视频时长类型
 * 包含即梦支持的额外时长 (5/10/12/15)
 */
export type VideoDuration = 4 | 5 | 8 | 10 | 12 | 15;

/**
 * 视频生成模式
 * jimeng = 即梦反代（同步等待服务端轮询）
 */
export type VideoMode = 'sync' | 'async' | 'jimeng';

// ============================================
// 模型参数配置
// ============================================

/**
 * 对话模型参数
 */
export interface ChatModelParams {
  temperature: number;           // 温度 0-2，默认 0.7
  maxTokens?: number;            // 最大 token，留空表示不限制
  topP?: number;                 // Top P，可选
  frequencyPenalty?: number;     // 频率惩罚，可选
  presencePenalty?: number;      // 存在惩罚，可选
}

/**
 * 图片模型参数
 */
export interface ImageModelParams {
  defaultAspectRatio: AspectRatio;
  supportedAspectRatios: AspectRatio[];
  // 即梦扩展参数（可选）
  resolution?: string;             // 即梦分辨率：'1k' | '2k' | '4k'
  negativePrompt?: string;         // 默认反向提示词
  sampleStrength?: number;         // 采样强度 0.0-1.0
}

/**
 * 视频模型参数
 */
export interface VideoModelParams {
  mode: VideoMode;                        // sync=Veo, async=Sora, jimeng=即梦反代
  defaultAspectRatio: AspectRatio;
  supportedAspectRatios: AspectRatio[];
  defaultDuration: VideoDuration;
  supportedDurations: VideoDuration[];
  // 即梦扩展参数（可选）
  resolution?: string;                    // 即梦视频分辨率：'720p' | '1080p'
}

/**
 * 模型参数联合类型
 */
export type ModelParams = ChatModelParams | ImageModelParams | VideoModelParams;

// ============================================
// 模型定义
// ============================================

/**
 * 模型定义基础接口
 */
export interface ModelDefinitionBase {
  id: string;                    // 唯一标识，如 'gpt-5.1'
  apiModel?: string;             // API 实际模型名（可与其他模型重复）
  name: string;                  // 显示名称，如 'GPT-5.1'
  type: ModelType;               // 模型类型
  providerId: string;            // 提供商 ID
  endpoint?: string;             // API 端点（可覆盖默认）
  description?: string;          // 描述
  isBuiltIn: boolean;            // 是否内置（内置模型不可删除）
  isEnabled: boolean;            // 是否启用
  apiKey?: string;               // 模型专属 API Key（可选，为空时使用全局 Key）
}

/**
 * 对话模型定义
 */
export interface ChatModelDefinition extends ModelDefinitionBase {
  type: 'chat';
  params: ChatModelParams;
}

/**
 * 图片模型定义
 */
export interface ImageModelDefinition extends ModelDefinitionBase {
  type: 'image';
  params: ImageModelParams;
}

/**
 * 视频模型定义
 */
export interface VideoModelDefinition extends ModelDefinitionBase {
  type: 'video';
  params: VideoModelParams;
}

/**
 * 模型定义联合类型
 */
export type ModelDefinition = ChatModelDefinition | ImageModelDefinition | VideoModelDefinition;

// ============================================
// 提供商定义
// ============================================

/**
 * 模型提供商配置
 */
export interface ModelProvider {
  id: string;                    // 唯一标识
  name: string;                  // 显示名称
  baseUrl: string;               // API 基础 URL
  apiKey?: string;               // 独立 API Key（可选）
  isBuiltIn: boolean;            // 是否内置
  isDefault: boolean;            // 是否为默认提供商
}

// ============================================
// 注册中心状态
// ============================================

/**
 * 激活的模型配置
 */
export interface ActiveModels {
  chat: string;                  // 当前激活的对话模型 ID
  image: string;                 // 当前激活的图片模型 ID
  video: string;                 // 当前激活的视频模型 ID
}

/**
 * 模型注册中心状态
 */
export interface ModelRegistryState {
  providers: ModelProvider[];
  models: ModelDefinition[];
  activeModels: ActiveModels;
}

// ============================================
// 服务调用参数
// ============================================

/**
 * 对话服务调用参数
 */
export interface ChatOptions {
  prompt: string;
  systemPrompt?: string;
  responseFormat?: 'text' | 'json';
  timeout?: number;
  // 可选覆盖模型参数
  overrideParams?: Partial<ChatModelParams>;
}

/**
 * 图片生成调用参数
 */
export interface ImageGenerateOptions {
  prompt: string;
  referenceImages?: string[];
  aspectRatio?: AspectRatio;
}

/**
 * 视频生成调用参数
 */
export interface VideoGenerateOptions {
  prompt: string;
  startImage?: string;
  endImage?: string;
  aspectRatio?: AspectRatio;
  duration?: VideoDuration;
}

// ============================================
// 默认值常量
// ============================================

/**
 * 默认对话模型参数
 */
export const DEFAULT_CHAT_PARAMS: ChatModelParams = {
  temperature: 0.7,
  maxTokens: undefined,
};

/**
 * 默认图片模型参数
 * 注意：Gemini 3 Pro Image 只支持横屏(16:9)和竖屏(9:16)，不支持方形(1:1)
 */
export const DEFAULT_IMAGE_PARAMS: ImageModelParams = {
  defaultAspectRatio: '16:9',
  supportedAspectRatios: ['16:9', '9:16'],
};

/**
 * 默认视频模型参数 (Veo 首尾帧模式)
 */
export const DEFAULT_VIDEO_PARAMS_VEO: VideoModelParams = {
  mode: 'sync',
  defaultAspectRatio: '16:9',
  supportedAspectRatios: ['16:9', '9:16'],  // Veo 不支持 1:1
  defaultDuration: 8,
  supportedDurations: [8],  // Veo 固定时长
};

/**
 * 默认视频模型参数 (Sora)
 */
export const DEFAULT_VIDEO_PARAMS_SORA: VideoModelParams = {
  mode: 'async',
  defaultAspectRatio: '16:9',
  supportedAspectRatios: ['16:9', '9:16', '1:1'],
  defaultDuration: 8,
  supportedDurations: [4, 8, 12],
};

/**
 * 默认视频模型参数 (Veo 3.1 Fast)
 */
export const DEFAULT_VIDEO_PARAMS_VEO_FAST: VideoModelParams = {
  mode: 'async',
  defaultAspectRatio: '16:9',
  supportedAspectRatios: ['16:9', '9:16'],
  defaultDuration: 8,
  supportedDurations: [8],
};

/**
 * 默认即梦图片模型参数
 */
export const DEFAULT_IMAGE_PARAMS_JIMENG: ImageModelParams = {
  defaultAspectRatio: '1:1',
  supportedAspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', '21:9'],
  resolution: '2k',
};

/**
 * 默认即梦视频模型参数
 */
export const DEFAULT_VIDEO_PARAMS_JIMENG: VideoModelParams = {
  mode: 'jimeng',
  defaultAspectRatio: '16:9',
  supportedAspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16', '21:9'],
  defaultDuration: 5,
  supportedDurations: [5, 10],
  resolution: '1080p',
};

/**
 * 即梦视频 Seedance 2.0 参数
 */
export const DEFAULT_VIDEO_PARAMS_JIMENG_SEEDANCE: VideoModelParams = {
  mode: 'jimeng',
  defaultAspectRatio: '16:9',
  supportedAspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16', '21:9'],
  defaultDuration: 5,
  supportedDurations: [4, 5, 8, 10, 12, 15],
  resolution: '1080p',
};

/**
 * 即梦视频 3.5-pro 参数
 */
export const DEFAULT_VIDEO_PARAMS_JIMENG_35PRO: VideoModelParams = {
  mode: 'jimeng',
  defaultAspectRatio: '16:9',
  supportedAspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16', '21:9'],
  defaultDuration: 5,
  supportedDurations: [5, 10, 12],
  resolution: '1080p',
};

// ============================================
// 内置模型定义
// ============================================

/**
 * 内置对话模型列表
 */
export const BUILTIN_CHAT_MODELS: ChatModelDefinition[] = [
  {
    id: 'gpt-5.1',
    name: 'GPT-5.1',
    type: 'chat',
    providerId: 'antsk',
    description: '剧情脚本切分首选：结构化输出稳定，适合分场/分镜、提取人物与事件',
    isBuiltIn: true,
    isEnabled: true,
    params: { ...DEFAULT_CHAT_PARAMS },
  },
  {
    id: 'gpt-5.2',
    name: 'GPT-5.2',
    type: 'chat',
    providerId: 'antsk',
    description: '创意增强型切分：更适合提供多种切分方案、改写节奏与镜头建议（一致性略弱）',
    isBuiltIn: true,
    isEnabled: true,
    params: { ...DEFAULT_CHAT_PARAMS },
  },
  {
    id: 'gpt-41',
    name: 'GPT-4.1',
    type: 'chat',
    providerId: 'antsk',
    description: '严谨切分：对复杂叙事与长文本更稳，适合时间线梳理、因果关系与要点校对',
    isBuiltIn: true,
    isEnabled: true,
    params: { ...DEFAULT_CHAT_PARAMS },
  },
  {
    id: 'claude-sonnet-4-5-20250929',
    name: 'Claude Sonnet 4.5',
    type: 'chat',
    providerId: 'antsk',
    description: '长文友好：适合长篇剧本的分段、摘要与角色弧线整理，文字表达更细腻',
    isBuiltIn: true,
    isEnabled: true,
    params: { ...DEFAULT_CHAT_PARAMS },
  },
];

/**
 * 内置图片模型列表
 */
export const BUILTIN_IMAGE_MODELS: ImageModelDefinition[] = [
  {
    id: 'gemini-3-pro-image-preview',
    name: 'Gemini 3 Pro Image',
    type: 'image',
    providerId: 'antsk',
    endpoint: '/v1beta/models/gemini-3-pro-image-preview:generateContent',
    description: 'Google Gemini 3 Pro 图片生成模型',
    isBuiltIn: true,
    isEnabled: true,
    params: { ...DEFAULT_IMAGE_PARAMS },
  },
  // ---- 即梦图片模型 ----
  {
    id: 'jimeng-5.0',
    apiModel: 'jimeng-5.0',
    name: '即梦 5.0',
    type: 'image',
    providerId: 'jimeng',
    endpoint: '/v1/images/generations',
    description: '即梦 5.0 文生图（需自行部署即梦反代服务）',
    isBuiltIn: true,
    isEnabled: false,
    params: { ...DEFAULT_IMAGE_PARAMS_JIMENG },
  },
  {
    id: 'jimeng-4.5',
    apiModel: 'jimeng-4.5',
    name: '即梦 4.5',
    type: 'image',
    providerId: 'jimeng',
    endpoint: '/v1/images/generations',
    description: '即梦 4.5 文生图（需自行部署即梦反代服务）',
    isBuiltIn: true,
    isEnabled: false,
    params: { ...DEFAULT_IMAGE_PARAMS_JIMENG },
  },
];

/**
 * 内置视频模型列表
 */
export const BUILTIN_VIDEO_MODELS: VideoModelDefinition[] = [
  {
    id: 'veo',
    name: 'Veo 3.1 首尾帧',
    type: 'video',
    providerId: 'antsk',
    endpoint: '/v1/chat/completions',
    description: 'Veo 3.1 首尾帧模式，需要起始帧和结束帧',
    isBuiltIn: true,
    isEnabled: true,
    params: { ...DEFAULT_VIDEO_PARAMS_VEO },
  },
  {
    id: 'veo_3_1-fast',
    name: 'Veo 3.1 Fast',
    type: 'video',
    providerId: 'antsk',
    endpoint: '/v1/videos',
    description: '异步模式，支持横屏/竖屏、支持单图和首尾帧，固定 8 秒时长,价格便宜速度快',
    isBuiltIn: true,
    isEnabled: true,
    params: { ...DEFAULT_VIDEO_PARAMS_VEO_FAST },
  },
  {
    id: 'sora-2',
    name: 'Sora-2',
    type: 'video',
    providerId: 'antsk',
    endpoint: '/v1/videos',
    description: 'OpenAI Sora 视频生成，异步模式，支持多种时长',
    isBuiltIn: true,
    isEnabled: true,
    params: { ...DEFAULT_VIDEO_PARAMS_SORA },
  },
  // ---- 即梦视频模型 ----
  {
    id: 'jimeng-video-seedance-2.0',
    apiModel: 'jimeng-video-seedance-2.0',
    name: '即梦 Seedance 2.0',
    type: 'video',
    providerId: 'jimeng',
    endpoint: '/v1/videos/generations',
    description: '即梦 Seedance 2.0 视频生成，支持全能模式（需自行部署即梦反代服务）',
    isBuiltIn: true,
    isEnabled: false,
    params: { ...DEFAULT_VIDEO_PARAMS_JIMENG_SEEDANCE },
  },
  {
    id: 'jimeng-video-3.5-pro',
    apiModel: 'jimeng-video-3.5-pro',
    name: '即梦视频 3.5 Pro',
    type: 'video',
    providerId: 'jimeng',
    endpoint: '/v1/videos/generations',
    description: '即梦视频 3.5 Pro（需自行部署即梦反代服务）',
    isBuiltIn: true,
    isEnabled: false,
    params: { ...DEFAULT_VIDEO_PARAMS_JIMENG_35PRO },
  },
  {
    id: 'jimeng-video-3.0',
    apiModel: 'jimeng-video-3.0',
    name: '即梦视频 3.0',
    type: 'video',
    providerId: 'jimeng',
    endpoint: '/v1/videos/generations',
    description: '即梦视频 3.0（需自行部署即梦反代服务）',
    isBuiltIn: true,
    isEnabled: false,
    params: { ...DEFAULT_VIDEO_PARAMS_JIMENG },
  },
];

/**
 * 内置提供商列表
 */
export const BUILTIN_PROVIDERS: ModelProvider[] = [
  {
    id: 'antsk',
    name: 'Meon API (api.antsk.cn)',
    baseUrl: 'https://api.antsk.cn',
    isBuiltIn: true,
    isDefault: true,
  },
  {
    id: 'jimeng',
    name: '即梦反代 (Jimeng API)',
    baseUrl: 'http://localhost:5100',
    isBuiltIn: true,
    isDefault: false,
  },
];

/**
 * 所有内置模型
 */
export const ALL_BUILTIN_MODELS: ModelDefinition[] = [
  ...BUILTIN_CHAT_MODELS,
  ...BUILTIN_IMAGE_MODELS,
  ...BUILTIN_VIDEO_MODELS,
];

/**
 * 默认激活模型
 */
export const DEFAULT_ACTIVE_MODELS: ActiveModels = {
  chat: 'gpt-5.1',
  image: 'gemini-3-pro-image-preview',
  video: 'sora-2',
};
