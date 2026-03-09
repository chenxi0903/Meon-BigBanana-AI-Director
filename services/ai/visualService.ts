/**
 * 视觉资产生成服务
 * 包含美术指导文档生成、角色/场景视觉提示词生成、图像生成
 */

import { Character, Scene, AspectRatio, ArtDirection, CharacterTurnaroundPanel } from "../../types";
import { addRenderLogWithTokens } from '../renderLogService';
import {
  retryOperation,
  cleanJsonString,
  chatCompletion,
  getActiveModel,
  resolveModel,
  logScriptProgress,
} from './apiCore';
import { isJimengImageModel, callJimengImageApi } from '../adapters/jimengImageAdapter';
import { callImageApi } from '../adapters/imageAdapter';
import { ImageModelDefinition } from '../../types/model';
import { getActiveChatModel, getChatModels, getActiveImageModel, getModelById, isModelAvailable } from '../modelRegistry';
import {
  getStylePrompt,
  getNegativePrompt,
  getSceneNegativePrompt,
} from './promptConstants';
import { 
  buildArtDirectionPrompt, 
  buildBatchCharacterPrompt, 
  buildCharacterPrompt, 
  buildScenePrompt,
  buildOutfitVariationPrompt,
  buildConsistencyPrompt,
  buildThreeViewPrompt,
  buildTurnaroundPanelPrompt,
  buildTurnaroundImagePrompt,
  buildQVersionThreeViewPrompt,
  buildQVersionEmotionGridPrompt
} from './prompts';

// ============================================
// 美术指导文档生成
// ============================================

/**
 * 生成全局美术指导文档（Art Direction Brief）
 * 在生成任何角色/场景提示词之前调用，为整个项目建立统一的视觉风格基准。
 */
export const generateArtDirection = async (
  title: string,
  genre: string,
  logline: string,
  characters: { name: string; gender: string; age: string; personality: string }[],
  scenes: { location: string; time: string; atmosphere: string }[],
  visualStyle: string,
  language: string = '中文',
  model: string = 'gpt-5.1'
): Promise<ArtDirection> => {
  console.log('🎨 generateArtDirection 调用 - 生成全局美术指导文档');
  logScriptProgress('正在生成全局美术指导文档（Art Direction）...');

  const stylePrompt = getStylePrompt(visualStyle);

  const prompt = buildArtDirectionPrompt(
    title,
    genre,
    logline,
    characters,
    scenes,
    visualStyle,
    stylePrompt,
    language
  );

  try {
    const responseText = await retryOperation(() => chatCompletion(prompt, model, 0.4, 4096, 'json_object'));
    const text = cleanJsonString(responseText);
    const parsed = JSON.parse(text);

    const artDirection: ArtDirection = {
      colorPalette: {
        primary: parsed.colorPalette?.primary || '',
        secondary: parsed.colorPalette?.secondary || '',
        accent: parsed.colorPalette?.accent || '',
        skinTones: parsed.colorPalette?.skinTones || '',
        saturation: parsed.colorPalette?.saturation || '',
        temperature: parsed.colorPalette?.temperature || '',
      },
      characterDesignRules: {
        proportions: parsed.characterDesignRules?.proportions || '',
        eyeStyle: parsed.characterDesignRules?.eyeStyle || '',
        lineWeight: parsed.characterDesignRules?.lineWeight || '',
        detailLevel: parsed.characterDesignRules?.detailLevel || '',
      },
      lightingStyle: parsed.lightingStyle || '',
      textureStyle: parsed.textureStyle || '',
      moodKeywords: Array.isArray(parsed.moodKeywords) ? parsed.moodKeywords : [],
      consistencyAnchors: parsed.consistencyAnchors || '',
    };

    console.log('✅ 全局美术指导文档生成完成:', artDirection.moodKeywords.join(', '));
    logScriptProgress('全局美术指导文档生成完成');
    return artDirection;
  } catch (error: any) {
    console.error('❌ 全局美术指导文档生成失败:', error);
    logScriptProgress('美术指导文档生成失败，将使用默认风格');
    return {
      colorPalette: { primary: '', secondary: '', accent: '', skinTones: '', saturation: '', temperature: '' },
      characterDesignRules: { proportions: '', eyeStyle: '', lineWeight: '', detailLevel: '' },
      lightingStyle: '',
      textureStyle: '',
      moodKeywords: [],
      consistencyAnchors: stylePrompt,
    };
  }
};

// ============================================
// 角色视觉提示词批量生成
// ============================================

/**
 * 批量生成所有角色的视觉提示词（Batch-Aware Generation）
 */
export const generateAllCharacterPrompts = async (
  characters: Character[],
  artDirection: ArtDirection,
  genre: string,
  visualStyle: string,
  language: string = '中文',
  model: string = 'gpt-5.1'
): Promise<{ visualPrompt: string; negativePrompt: string }[]> => {
  console.log(`🎭 generateAllCharacterPrompts 调用 - 批量生成 ${characters.length} 个角色的视觉提示词`);
  logScriptProgress(`正在批量生成 ${characters.length} 个角色的视觉提示词（风格统一模式）...`);

  const stylePrompt = getStylePrompt(visualStyle);
  const negativePrompt = getNegativePrompt(visualStyle);

  if (characters.length === 0) return [];

  const characterList = characters.map((c, i) =>
    `Character ${i + 1} (ID: ${c.id}):
  - Name: ${c.name}
  - Gender: ${c.gender}
  - Age: ${c.age}
  - Personality: ${c.personality}`
  ).join('\n\n');

  const prompt = buildBatchCharacterPrompt(
    visualStyle,
    characters,
    artDirection,
    genre,
    stylePrompt,
    language,
    characterList
  );

  try {
    const responseText = await retryOperation(() => chatCompletion(prompt, model, 0.4, 4096, 'json_object'));
    const text = cleanJsonString(responseText);
    const parsed = JSON.parse(text);

    const results: { visualPrompt: string; negativePrompt: string }[] = [];
    const charResults = Array.isArray(parsed.characters) ? parsed.characters : [];

    for (let i = 0; i < characters.length; i++) {
      const charResult = charResults[i];
      if (charResult && charResult.visualPrompt) {
        results.push({
          visualPrompt: charResult.visualPrompt.trim(),
          negativePrompt: negativePrompt,
        });
        console.log(`  ✅ 角色 ${characters[i].name} 提示词生成成功`);
      } else {
        console.warn(`  ⚠️ 角色 ${characters[i].name} 在批量结果中缺失，将使用后备方案`);
        results.push({
          visualPrompt: '',
          negativePrompt: negativePrompt,
        });
      }
    }

    console.log(`✅ 批量角色视觉提示词生成完成: ${results.filter(r => r.visualPrompt).length}/${characters.length} 成功`);
    logScriptProgress(`角色视觉提示词批量生成完成 (${results.filter(r => r.visualPrompt).length}/${characters.length})`);
    return results;
  } catch (error: any) {
    console.error('❌ 批量角色视觉提示词生成失败:', error);
    logScriptProgress('批量角色提示词生成失败，将回退到逐个生成模式');
    return characters.map(() => ({ visualPrompt: '', negativePrompt: negativePrompt }));
  }
};

// ============================================
// 单个角色/场景视觉提示词生成
// ============================================

/**
 * 生成角色或场景的视觉提示词
 */
export const generateVisualPrompts = async (
  type: 'character' | 'scene',
  data: Character | Scene,
  genre: string,
  model: string = 'gpt-5.1',
  visualStyle: string = 'live-action',
  language: string = '中文',
  artDirection?: ArtDirection,
  signal?: AbortSignal
): Promise<{ visualPrompt: string; negativePrompt: string }> => {
  const stylePrompt = getStylePrompt(visualStyle);
  const negativePrompt = type === 'scene'
    ? getSceneNegativePrompt(visualStyle)
    : getNegativePrompt(visualStyle);

  // 构建 Art Direction 注入段落
  const artDirectionBlock = artDirection ? `
## GLOBAL ART DIRECTION (MANDATORY - MUST follow this for visual consistency)
${artDirection.consistencyAnchors}

Color Palette: Primary=${artDirection.colorPalette.primary}, Secondary=${artDirection.colorPalette.secondary}, Accent=${artDirection.colorPalette.accent}
Color Temperature: ${artDirection.colorPalette.temperature}, Saturation: ${artDirection.colorPalette.saturation}
Lighting: ${artDirection.lightingStyle}
Texture: ${artDirection.textureStyle}
Mood Keywords: ${artDirection.moodKeywords.join(', ')}
` : '';

  let prompt: string;

  if (type === 'character') {
    const char = data as Character;
    prompt = buildCharacterPrompt(
      visualStyle,
      artDirectionBlock,
      char,
      language,
      genre,
      stylePrompt,
      artDirection
    );
  } else {
    const scene = data as Scene;
    prompt = buildScenePrompt(
      visualStyle,
      artDirectionBlock,
      scene,
      genre,
      language,
      stylePrompt,
      artDirection
    );
  }

  const visualPrompt = await retryOperation(() => chatCompletion(prompt, model, 0.5, 1024, undefined, 600000, signal));

  // 针对 Jimeng 等模型，限制提示词长度
  let finalVisualPrompt = visualPrompt.trim();
  if (type === 'scene' && finalVisualPrompt.length > 600) {
    console.warn(`⚠️ Scene prompt too long (${finalVisualPrompt.length}), truncating to 600 chars.`);
    finalVisualPrompt = finalVisualPrompt.substring(0, 600);
  }

  return {
    visualPrompt: finalVisualPrompt,
    negativePrompt: negativePrompt
  };
};

// ============================================
// 图像生成
// ============================================

/**
 * 生成图像
 * 使用图像生成API，支持参考图像确保角色和场景一致性
 */
export const generateImage = async (
  prompt: string,
  referenceImages: string[] = [],
  aspectRatio: AspectRatio = '16:9',
  isVariation: boolean = false,
  hasTurnaround: boolean = false,
  signal?: AbortSignal,
  resolution?: '1k' | '2k' | '4k'
): Promise<string> => {
  const startTime = Date.now();

  const activeImageModel = getActiveModel('image');

  // ---- 即梦图片模型路由 ----
  if (activeImageModel && isJimengImageModel(activeImageModel as ImageModelDefinition)) {
    const imageModelId = activeImageModel.apiModel || activeImageModel.id;
    try {
      const result = await callJimengImageApi(
        {
          prompt,
          referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
          aspectRatio,
          resolution,
          signal,
        },
        activeImageModel as ImageModelDefinition
      );

      addRenderLogWithTokens({
        type: 'keyframe',
        resourceId: 'image-' + Date.now(),
        resourceName: prompt.substring(0, 50) + '...',
        status: 'success',
        model: imageModelId,
        prompt: prompt,
        duration: Date.now() - startTime,
      });

      return result;
    } catch (error: any) {
      addRenderLogWithTokens({
        type: 'keyframe',
        resourceId: 'image-' + Date.now(),
        resourceName: prompt.substring(0, 50) + '...',
        status: 'failed',
        model: imageModelId,
        prompt: prompt,
        error: error.message,
        duration: Date.now() - startTime,
      });
      throw error;
    }
  }

  const imageModelId = activeImageModel?.apiModel || activeImageModel?.id || 'gemini-3-pro-image-preview';

  try {
    let finalPrompt = prompt;
    if (referenceImages.length > 0) {
      if (isVariation) {
        finalPrompt = buildOutfitVariationPrompt(prompt);
      } else {
        finalPrompt = buildConsistencyPrompt(prompt, hasTurnaround);
      }
    }

    const result = await callImageApi(
      {
        prompt: finalPrompt,
        referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
        aspectRatio,
        resolution,
        signal,
      },
      activeImageModel as ImageModelDefinition | undefined
    );

    addRenderLogWithTokens({
      type: 'keyframe',
      resourceId: 'image-' + Date.now(),
      resourceName: prompt.substring(0, 50) + '...',
      status: 'success',
      model: imageModelId,
      prompt: prompt,
      duration: Date.now() - startTime
    });

    return result;
  } catch (error: any) {
    addRenderLogWithTokens({
      type: 'keyframe',
      resourceId: 'image-' + Date.now(),
      resourceName: prompt.substring(0, 50) + '...',
      status: 'failed',
      model: imageModelId,
      prompt: prompt,
      error: error.message,
      duration: Date.now() - startTime
    });

    throw error;
  }
};

export const generateCharacterThreeViewImage = async (
  character: Character,
  visualStyle: string,
  language: string = '中文',
  modelId?: string,
  signal?: AbortSignal
): Promise<{ imageUrl: string; prompt: string; modelId: string }> => {
  if (!character.referenceImage) {
    throw new Error('三视图生成需要先有角色参考图');
  }
  const prompt = buildThreeViewPrompt({ character, visualStyle, language });

  const preferredModelId = isModelAvailable('jimeng-4.6') ? 'jimeng-4.6' : undefined;
  const selectedModelId = preferredModelId || (modelId && isModelAvailable(modelId) ? modelId : undefined);
  const model =
    (selectedModelId ? (getModelById(selectedModelId) as ImageModelDefinition | undefined) : undefined) ||
    getActiveImageModel();

  if (!model) {
    throw new Error('没有可用的图片模型');
  }

  const referenceImages = [character.referenceImage];
  const imageUrl = await callImageApi(
    {
      prompt,
      referenceImages,
      aspectRatio: '16:9',
      signal,
    },
    model
  );

  return { imageUrl, prompt, modelId: model.id };
};

// ============================================
// 角色九宫格造型设计（Turnaround Sheet）
// ============================================

/**
 * 角色九宫格造型设计 - 默认视角布局
 * 覆盖常用的拍摄角度，确保角色从各方向都有参考
 */
export const CHARACTER_TURNAROUND_LAYOUT = {
  panelCount: 9,
  defaultPanels: [
    { index: 0, viewAngle: '正面', shotSize: '全身', description: '' },
    { index: 1, viewAngle: '正面', shotSize: '半身特写', description: '' },
    { index: 2, viewAngle: '正面', shotSize: '面部特写', description: '' },
    { index: 3, viewAngle: '左侧面', shotSize: '全身', description: '' },
    { index: 4, viewAngle: '右侧面', shotSize: '全身', description: '' },
    { index: 5, viewAngle: '3/4侧面', shotSize: '半身', description: '' },
    { index: 6, viewAngle: '背面', shotSize: '全身', description: '' },
    { index: 7, viewAngle: '仰视', shotSize: '半身', description: '' },
    { index: 8, viewAngle: '俯视', shotSize: '半身', description: '' },
  ],
  viewAngles: ['正面', '左侧面', '右侧面', '3/4左侧', '3/4右侧', '背面', '仰视', '俯视', '斜后方'],
  shotSizes: ['全身', '半身', '半身特写', '面部特写', '大特写'],
  positionLabels: [
    '左上 (Top-Left)', '中上 (Top-Center)', '右上 (Top-Right)',
    '左中 (Middle-Left)', '正中 (Center)', '右中 (Middle-Right)',
    '左下 (Bottom-Left)', '中下 (Bottom-Center)', '右下 (Bottom-Right)'
  ],
};

/**
 * 生成角色九宫格造型描述（AI拆分9个视角）
 * 根据角色信息和视觉提示词，生成9个不同视角的详细描述
 */
export const generateCharacterTurnaroundPanels = async (
  character: Character,
  visualStyle: string,
  artDirection?: ArtDirection,
  language: string = '中文',
  model: string = 'gpt-5.1',
  signal?: AbortSignal
): Promise<CharacterTurnaroundPanel[]> => {
  console.log(`🎭 generateCharacterTurnaroundPanels - 为角色 ${character.name} 生成九宫格造型视角`);
  logScriptProgress(`正在为角色「${character.name}」生成九宫格造型视角描述...`);

  const stylePrompt = getStylePrompt(visualStyle);
  const activeChatModelId = getActiveChatModel()?.id;
  const availableChatModelId = getChatModels().find(m => isModelAvailable(m.id))?.id;
  const resolvedModelId = isModelAvailable(model)
    ? model
    : (activeChatModelId && isModelAvailable(activeChatModelId)
      ? activeChatModelId
      : (availableChatModelId || model));

  // 构建 Art Direction 注入
  const artDirectionBlock = artDirection ? `
## GLOBAL ART DIRECTION (MANDATORY)
${artDirection.consistencyAnchors}
Color Palette: Primary=${artDirection.colorPalette.primary}, Secondary=${artDirection.colorPalette.secondary}, Accent=${artDirection.colorPalette.accent}
Character Design: Proportions=${artDirection.characterDesignRules.proportions}, Eye Style=${artDirection.characterDesignRules.eyeStyle}
Lighting: ${artDirection.lightingStyle}, Texture: ${artDirection.textureStyle}
` : '';

  const prompt = buildTurnaroundPanelPrompt(visualStyle, stylePrompt, artDirectionBlock, character);

  try {
    const responseText = await retryOperation(() => chatCompletion(prompt, resolvedModelId, 0.4, 4096, 'json_object', 600000, signal));
    const text = cleanJsonString(responseText);
    const parsed = JSON.parse(text);

    const panels: CharacterTurnaroundPanel[] = [];
    const rawPanels = Array.isArray(parsed.panels) ? parsed.panels : [];

    for (let i = 0; i < 9; i++) {
      const raw = rawPanels[i];
      if (raw) {
        panels.push({
          index: i,
          viewAngle: raw.viewAngle || CHARACTER_TURNAROUND_LAYOUT.defaultPanels[i].viewAngle,
          shotSize: raw.shotSize || CHARACTER_TURNAROUND_LAYOUT.defaultPanels[i].shotSize,
          description: raw.description || '',
        });
      } else {
        panels.push({
          ...CHARACTER_TURNAROUND_LAYOUT.defaultPanels[i],
          description: `${character.visualPrompt || character.name}, ${CHARACTER_TURNAROUND_LAYOUT.defaultPanels[i].viewAngle} view, ${CHARACTER_TURNAROUND_LAYOUT.defaultPanels[i].shotSize}`,
        });
      }
    }

    console.log(`✅ 角色 ${character.name} 九宫格造型视角描述生成完成`);
    logScriptProgress(`角色「${character.name}」九宫格视角描述生成完成`);
    return panels;
  } catch (error: any) {
    console.error(`❌ 角色 ${character.name} 九宫格视角描述生成失败:`, error);
    logScriptProgress(`角色「${character.name}」九宫格视角描述生成失败`);
    throw error;
  }
};

/**
 * 生成角色九宫格造型图片
 * 将9个视角描述合成为一张3x3九宫格图片
 */
export const generateCharacterTurnaroundImage = async (
  character: Character,
  panels: CharacterTurnaroundPanel[],
  visualStyle: string,
  referenceImage?: string,
  artDirection?: ArtDirection,
  signal?: AbortSignal
): Promise<string> => {
  console.log(`🖼️ generateCharacterTurnaroundImage - 为角色 ${character.name} 生成九宫格造型图片`);
  logScriptProgress(`正在为角色「${character.name}」生成九宫格造型图片...`);

  const stylePrompt = getStylePrompt(visualStyle);

  // 构建九宫格图片生成提示词
  const panelDescriptions = panels.map((p, idx) => {
    const position = CHARACTER_TURNAROUND_LAYOUT.positionLabels[idx];
    return `Panel ${idx + 1} (${position}): [${p.viewAngle} / ${p.shotSize}] - ${p.description}`;
  }).join('\n');

  const artDirectionSuffix = artDirection
    ? `\nArt Direction Style Anchors: ${artDirection.consistencyAnchors}\nLighting: ${artDirection.lightingStyle}\nTexture: ${artDirection.textureStyle}`
    : '';

  const prompt = buildTurnaroundImagePrompt(
    visualStyle,
    stylePrompt,
    character,
    panelDescriptions,
    artDirectionSuffix
  );

  // 收集参考图片
  const referenceImages: string[] = [];
  if (referenceImage) {
    referenceImages.push(referenceImage);
  } else if (character.referenceImage) {
    referenceImages.push(character.referenceImage);
  }

  try {
    // 使用 1:1 比例生成九宫格（正方形最适合3x3网格）
    const imageUrl = await generateImage(prompt, referenceImages, '1:1', false, false, signal);
    console.log(`✅ 角色 ${character.name} 九宫格造型图片生成完成`);
    logScriptProgress(`角色「${character.name}」九宫格造型图片生成完成`);
    return imageUrl;
  } catch (error: any) {
    console.error(`❌ 角色 ${character.name} 九宫格造型图片生成失败:`, error);
    logScriptProgress(`角色「${character.name}」九宫格造型图片生成失败`);
    throw error;
  }
};

/**
 * 生成 Q 版角色三视图图片
 */
export const generateCharacterQVersionThreeViewImage = async (
  character: Character,
  signal?: AbortSignal
): Promise<string> => {
  console.log(`🖼️ generateCharacterQVersionThreeViewImage - 为角色 ${character.name} 生成 Q 版三视图`);
  logScriptProgress(`正在为角色「${character.name}」生成 Q 版三视图...`);

  if (!character.referenceImage) {
    throw new Error('Q版生成需要先有角色参考图');
  }

  const prompt = buildQVersionThreeViewPrompt();
  const referenceImages = [character.referenceImage];

  try {
    // 使用 16:9 比例生成三视图
    const imageUrl = await generateImage(prompt, referenceImages, '16:9', false, false, signal, '2k');
    console.log(`✅ 角色 ${character.name} Q 版三视图生成完成`);
    logScriptProgress(`角色「${character.name}」 Q 版三视图生成完成`);
    return imageUrl;
  } catch (error: any) {
    console.error(`❌ 角色 ${character.name} Q 版三视图生成失败:`, error);
    logScriptProgress(`角色「${character.name}」 Q 版三视图生成失败`);
    throw error;
  }
};

/**
 * 生成 Q 版角色情绪九宫格图片
 */
export const generateCharacterQVersionEmotionGridImage = async (
  character: Character,
  signal?: AbortSignal
): Promise<string> => {
  console.log(`🖼️ generateCharacterQVersionEmotionGridImage - 为角色 ${character.name} 生成 Q 版情绪九宫格`);
  logScriptProgress(`正在为角色「${character.name}」生成 Q 版情绪九宫格...`);

  const qThreeView = character.qVersion?.threeView?.imageUrl;
  if (!qThreeView) {
    throw new Error('情绪九宫格生成需要先完成 Q 版三视图生成');
  }

  const prompt = buildQVersionEmotionGridPrompt();
  const referenceImages = [qThreeView];

  try {
    // 使用 1:1 比例生成九宫格
    const imageUrl = await generateImage(prompt, referenceImages, '1:1', false, false, signal, '2k');
    console.log(`✅ 角色 ${character.name} Q 版情绪九宫格生成完成`);
    logScriptProgress(`角色「${character.name}」 Q 版情绪九宫格生成完成`);
    return imageUrl;
  } catch (error: any) {
    console.error(`❌ 角色 ${character.name} Q 版情绪九宫格生成失败:`, error);
    logScriptProgress(`角色「${character.name}」 Q 版情绪九宫格生成失败`);
    throw error;
  }
};
