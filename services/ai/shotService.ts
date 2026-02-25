/**
 * 分镜辅助服务
 * 包含关键帧优化、动作生成、镜头拆分、九宫格分镜等功能
 */

import { AspectRatio, NineGridPanel } from "../../types";
import { addRenderLogWithTokens } from '../renderLogService';
import {
  retryOperation,
  cleanJsonString,
  chatCompletion,
  getActiveChatModel,
} from './apiCore';
import { generateImage } from './visualService';
import {
  buildOptimizeBothKeyframesPrompt,
  buildDetailedKeyframeOptimizationPrompt,
  buildDetailedActionSuggestionPrompt,
  buildDetailedShotSplitPrompt,
  buildKeyframeEnhancementPrompt,
  buildNineGridPanelsPrompt,
  buildNineGridImagePrompt
} from './prompts';

// ============================================
// 关键帧优化
// ============================================

/**
 * AI一次性优化起始帧和结束帧视觉描述（推荐使用）
 */
export const optimizeBothKeyframes = async (
  actionSummary: string,
  cameraMovement: string,
  sceneInfo: { location: string; time: string; atmosphere: string },
  characterInfo: string[],
  visualStyle: string,
  model: string = 'gpt-5.1'
): Promise<{ startPrompt: string; endPrompt: string }> => {
  console.log('🎨 optimizeBothKeyframes 调用 - 同时优化起始帧和结束帧 - 使用模型:', model);
  const startTime = Date.now();

  const prompt = buildOptimizeBothKeyframesPrompt(
    sceneInfo,
    actionSummary,
    cameraMovement,
    characterInfo,
    visualStyle
  );

  try {
    const result = await retryOperation(() => chatCompletion(prompt, model, 0.7, 2048, 'json_object'));
    const duration = Date.now() - startTime;

    const cleaned = cleanJsonString(result);
    const parsed = JSON.parse(cleaned);

    if (!parsed.startFrame || !parsed.endFrame) {
      throw new Error('AI返回的JSON格式不正确');
    }

    console.log('✅ AI同时优化起始帧和结束帧成功，耗时:', duration, 'ms');

    return {
      startPrompt: parsed.startFrame.trim(),
      endPrompt: parsed.endFrame.trim()
    };
  } catch (error: any) {
    console.error('❌ AI关键帧优化失败:', error);
    throw new Error(`AI关键帧优化失败: ${error.message}`);
  }
};

/**
 * AI优化单个关键帧视觉描述（兼容旧版，建议使用 optimizeBothKeyframes）
 */
export const optimizeKeyframePrompt = async (
  frameType: 'start' | 'end',
  actionSummary: string,
  cameraMovement: string,
  sceneInfo: { location: string; time: string; atmosphere: string },
  characterInfo: string[],
  visualStyle: string,
  model: string = 'gpt-5.1'
): Promise<string> => {
  console.log(`🎨 optimizeKeyframePrompt 调用 - ${frameType === 'start' ? '起始帧' : '结束帧'} - 使用模型:`, model);
  const startTime = Date.now();

  const frameLabel = frameType === 'start' ? '起始帧' : '结束帧';
  
  const prompt = buildDetailedKeyframeOptimizationPrompt(
    frameType,
    actionSummary,
    cameraMovement,
    sceneInfo,
    characterInfo,
    visualStyle
  );

  try {
    const result = await retryOperation(() => chatCompletion(prompt, model, 0.7, 1024));
    const duration = Date.now() - startTime;

    console.log(`✅ AI ${frameLabel}优化成功，耗时:`, duration, 'ms');

    return result.trim();
  } catch (error: any) {
    console.error(`❌ AI ${frameLabel}优化失败:`, error);
    throw new Error(`AI ${frameLabel}优化失败: ${error.message}`);
  }
};

// ============================================
// 动作生成
// ============================================

/**
 * AI生成叙事动作建议
 */
export const generateActionSuggestion = async (
  startFramePrompt: string,
  endFramePrompt: string,
  cameraMovement: string,
  model: string = 'gpt-5.1'
): Promise<string> => {
  console.log('🎬 generateActionSuggestion 调用 - 使用模型:', model);
  const startTime = Date.now();

  const prompt = buildDetailedActionSuggestionPrompt(
    startFramePrompt,
    endFramePrompt,
    cameraMovement
  );

  try {
    const result = await retryOperation(() => chatCompletion(prompt, model, 0.8, 2048));
    const duration = Date.now() - startTime;

    console.log('✅ AI动作生成成功，耗时:', duration, 'ms');

    return result.trim();
  } catch (error: any) {
    console.error('❌ AI动作生成失败:', error);
    throw new Error(`AI动作生成失败: ${error.message}`);
  }
};

// ============================================
// 镜头拆分
// ============================================

/**
 * AI镜头拆分功能 - 将单个镜头拆分为多个细致的子镜头
 */
export const splitShotIntoSubShots = async (
  shot: any,
  sceneInfo: { location: string; time: string; atmosphere: string },
  characterNames: string[],
  visualStyle: string,
  model: string = 'gpt-5.1'
): Promise<{ subShots: any[] }> => {
  console.log('✂️ splitShotIntoSubShots 调用 - 使用模型:', model);
  const startTime = Date.now();

  const prompt = buildDetailedShotSplitPrompt(
    shot,
    sceneInfo,
    characterNames,
    visualStyle
  );

  try {
    const result = await retryOperation(() => chatCompletion(prompt, model, 0.7, 4096, 'json_object'));
    const duration = Date.now() - startTime;

    const cleaned = cleanJsonString(result);
    const parsed = JSON.parse(cleaned);

    if (!parsed.subShots || !Array.isArray(parsed.subShots) || parsed.subShots.length === 0) {
      throw new Error('AI返回的JSON格式不正确或子镜头数组为空');
    }

    // 验证每个子镜头
    for (const subShot of parsed.subShots) {
      if (!subShot.shotSize || !subShot.cameraMovement || !subShot.actionSummary || !subShot.visualFocus) {
        throw new Error('子镜头缺少必需字段（shotSize、cameraMovement、actionSummary、visualFocus）');
      }
      if (!subShot.keyframes || !Array.isArray(subShot.keyframes) || subShot.keyframes.length === 0) {
        throw new Error('子镜头缺少关键帧数组（keyframes）');
      }
      for (const kf of subShot.keyframes) {
        if (!kf.type || !kf.visualPrompt) {
          throw new Error('关键帧缺少必需字段（type、visualPrompt）');
        }
        if (kf.type !== 'start' && kf.type !== 'end') {
          throw new Error('关键帧type必须是"start"或"end"');
        }
      }
    }

    console.log(`✅ 镜头拆分成功，生成 ${parsed.subShots.length} 个子镜头，耗时:`, duration, 'ms');

    addRenderLogWithTokens({
      type: 'script-parsing',
      resourceId: `shot-split-${shot.id}-${Date.now()}`,
      resourceName: `镜头拆分 - ${shot.actionSummary.substring(0, 30)}...`,
      status: 'success',
      model: model,
      prompt: prompt.substring(0, 200) + '...',
      duration: duration
    });

    return parsed;
  } catch (error: any) {
    console.error('❌ 镜头拆分失败:', error);

    addRenderLogWithTokens({
      type: 'script-parsing',
      resourceId: `shot-split-${shot.id}-${Date.now()}`,
      resourceName: `镜头拆分 - ${shot.actionSummary.substring(0, 30)}...`,
      status: 'failed',
      model: model,
      prompt: prompt.substring(0, 200) + '...',
      error: error.message,
      duration: Date.now() - startTime
    });

    throw new Error(`镜头拆分失败: ${error.message}`);
  }
};

// ============================================
// 关键帧增强
// ============================================

/**
 * AI增强关键帧提示词 - 添加详细的技术规格和视觉细节
 */
export const enhanceKeyframePrompt = async (
  basePrompt: string,
  visualStyle: string,
  cameraMovement: string,
  frameType: 'start' | 'end',
  model: string = 'gpt-5.1'
): Promise<string> => {
  console.log(`🎨 enhanceKeyframePrompt 调用 - ${frameType === 'start' ? '起始帧' : '结束帧'} - 使用模型:`, model);
  const startTime = Date.now();

  const frameLabel = frameType === 'start' ? '起始帧' : '结束帧';

  const prompt = buildKeyframeEnhancementPrompt(
    basePrompt,
    visualStyle,
    cameraMovement,
    frameType
  );

  try {
    const result = await retryOperation(() => chatCompletion(prompt, model, 0.7, 3072));
    const duration = Date.now() - startTime;

    console.log(`✅ AI ${frameLabel}增强成功，耗时:`, duration, 'ms');

    return `${basePrompt}

${result.trim()}`;
  } catch (error: any) {
    console.error(`❌ AI ${frameLabel}增强失败:`, error);
    console.warn('⚠️ 回退到基础提示词');
    return basePrompt;
  }
};

// ============================================
// 九宫格分镜预览
// ============================================

/**
 * 使用 Chat 模型将镜头动作拆分为 9 个不同的摄影视角
 */
export const generateNineGridPanels = async (
  actionSummary: string,
  cameraMovement: string,
  sceneInfo: { location: string; time: string; atmosphere: string },
  characterNames: string[],
  visualStyle: string,
  model?: string
): Promise<NineGridPanel[]> => {
  const startTime = Date.now();
  console.log('🎬 九宫格分镜 - 开始AI拆分视角...');

  const resolvedModel = model || getActiveChatModel()?.id || 'gpt-5.1';

  const fullPrompt = buildNineGridPanelsPrompt(
    actionSummary,
    cameraMovement,
    sceneInfo,
    characterNames,
    visualStyle
  );

  try {
    const responseText = await retryOperation(() => chatCompletion(fullPrompt, resolvedModel, 0.7, 4096, 'json_object'));
    const duration = Date.now() - startTime;

    const cleaned = cleanJsonString(responseText);
    const parsed = JSON.parse(cleaned);

    let panels: NineGridPanel[] = parsed.panels || [];

    if (panels.length < 9) {
      for (let i = panels.length; i < 9; i++) {
        panels.push({
          index: i,
          shotSize: '中景',
          cameraAngle: '平视',
          description: `${actionSummary} - alternate angle ${i + 1}`
        });
      }
    } else if (panels.length > 9) {
      panels = panels.slice(0, 9);
    }

    panels = panels.map((p, idx) => ({ ...p, index: idx }));

    console.log(`✅ 九宫格分镜 - AI拆分完成，耗时: ${duration}ms`);
    return panels;
  } catch (error: any) {
    console.error('❌ 九宫格分镜 - AI拆分失败:', error);
    throw new Error(`九宫格视角拆分失败: ${error.message}`);
  }
};

/**
 * 使用图像模型生成九宫格分镜图片
 */
export const generateNineGridImage = async (
  panels: NineGridPanel[],
  referenceImages: string[] = [],
  visualStyle: string,
  aspectRatio: AspectRatio = '16:9'
): Promise<string> => {
  const startTime = Date.now();
  console.log('🎬 九宫格分镜 - 开始生成九宫格图片...');

  const positionLabels = [
    'Top-Left', 'Top-Center', 'Top-Right',
    'Middle-Left', 'Center', 'Middle-Right',
    'Bottom-Left', 'Bottom-Center', 'Bottom-Right'
  ];

  const panelDescriptions = panels.map((panel, idx) =>
    `Panel ${idx + 1} (${positionLabels[idx]}): [${panel.shotSize} / ${panel.cameraAngle}] - ${panel.description}`
  ).join('\n');

  const nineGridPrompt = buildNineGridImagePrompt(
    panelDescriptions,
    visualStyle
  );

  try {
    const imageUrl = await generateImage(nineGridPrompt, referenceImages, aspectRatio);
    const duration = Date.now() - startTime;

    console.log(`✅ 九宫格分镜 - 图片生成完成，耗时: ${duration}ms`);
    return imageUrl;
  } catch (error: any) {
    console.error('❌ 九宫格分镜 - 图片生成失败:', error);
    throw new Error(`九宫格图片生成失败: ${error.message}`);
  }
};
