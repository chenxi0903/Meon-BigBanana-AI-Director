/**
 * 剧本处理服务
 * 包含剧本解析、分镜生成、续写、改写等功能
 */

import { ScriptData, Shot, Scene, ArtDirection } from "../../types";
import { addRenderLogWithTokens } from '../renderLogService';
import {
  retryOperation,
  cleanJsonString,
  chatCompletion,
  chatCompletionStream,
  logScriptProgress,
} from './apiCore';
import { getStylePrompt } from './promptConstants';
import { buildScriptParsingPrompt, buildShotListGenerationPrompt, buildShotListSkeletonPrompt, buildShotVisualDetailsPrompt, buildScriptContinuationPrompt, buildScriptRewritePrompt } from './prompts';
import { generateArtDirection, generateAllCharacterPrompts, generateVisualPrompts } from './visualService';

// Re-export 日志回调函数（保持外部 API 兼容）
export { setScriptLogCallback, clearScriptLogCallback, logScriptProgress } from './apiCore';

// ============================================
// 剧本解析
// ============================================

/**
 * Agent 1 & 2: Script Structuring & Breakdown
 * 解析原始文本为结构化剧本数据
 */
export const parseScriptToData = async (
  rawText: string,
  language: string = '中文',
  model: string = 'gpt-5.1',
  visualStyle: string = 'live-action',
  existingData?: ScriptData | null,
  sharedAssets?: { characters: any[], scenes: any[], props: any[] }
): Promise<ScriptData> => {
  console.log('📝 parseScriptToData 调用 - 使用模型:', model, '视觉风格:', visualStyle);
  logScriptProgress('正在解析剧本结构...');
  const startTime = Date.now();

  const prompt = buildScriptParsingPrompt(rawText, language);

  try {
    const responseText = await retryOperation(() => chatCompletion(prompt, model, 0.7, 8192, 'json_object'));

    let parsed: any = {};
    try {
      const text = cleanJsonString(responseText);
      parsed = JSON.parse(text);
    } catch (e) {
      console.error("Failed to parse script data JSON:", e);
      parsed = {};
    }

    // Enforce String IDs for consistency and init variations
    const characters = Array.isArray(parsed.characters) ? parsed.characters.map((c: any) => {
      // Check for existing character to reuse (Local first, then Shared)
      let existingChar = existingData?.characters.find(ec => ec.name === c.name);
      
      if (!existingChar && sharedAssets) {
          const sharedChar = sharedAssets.characters.find(sc => sc.name === c.name);
          if (sharedChar) {
              console.log(`📚 从共享库复用角色: ${c.name}`);
              existingChar = sharedChar;
          }
      }

      if (existingChar && existingChar.visualPrompt) {
        console.log(`♻️ 复用已存在角色: ${c.name}`);
        return {
          ...c,
          id: existingChar.id, // Reuse ID to keep consistency
          visualPrompt: existingChar.visualPrompt,
          negativePrompt: existingChar.negativePrompt,
          referenceImage: existingChar.referenceImage,
          turnaround: existingChar.turnaround,
          threeView: existingChar.threeView,
          variations: existingChar.variations || [],
          source: 'reused',
          status: existingChar.status === 'completed' ? 'completed' : 'pending'
        };
      }
      return {
        ...c,
        id: String(c.id),
        variations: [],
        source: 'generated'
      };
    }) : [];

    const scenes = Array.isArray(parsed.scenes) ? parsed.scenes.map((s: any) => {
      // Check for existing scene to reuse
      // Loose matching: same location is usually enough, but let's be safe
      let existingScene = existingData?.scenes.find(es => 
          es.location === s.location && 
          (!s.time || es.time === s.time)
      );

      if (!existingScene && sharedAssets) {
          const sharedScene = sharedAssets.scenes.find(ss => 
              ss.location === s.location && 
              (!s.time || ss.time === s.time)
          );
          if (sharedScene) {
              console.log(`📚 从共享库复用场景: ${s.location}`);
              existingScene = sharedScene;
          }
      }
      
      if (existingScene && existingScene.visualPrompt) {
        console.log(`♻️ 复用已存在场景: ${s.location}`);
        return {
          ...s,
          id: existingScene.id, // Reuse ID
          visualPrompt: existingScene.visualPrompt,
          negativePrompt: existingScene.negativePrompt,
          referenceImage: existingScene.referenceImage,
          source: 'reused',
          status: existingScene.status === 'completed' ? 'completed' : 'pending'
        };
      }
      return { ...s, id: String(s.id), source: 'generated' };
    }) : [];

    const storyParagraphs = Array.isArray(parsed.storyParagraphs) ? parsed.storyParagraphs.map((p: any) => ({ ...p, sceneRefId: String(p.sceneRefId) })) : [];

    const genre = parsed.genre || "通用";

    // ========== Phase 1: 生成全局美术指导文档 ==========
    console.log("🎨 正在为角色和场景生成视觉提示词...", `风格: ${visualStyle}`);
    logScriptProgress(`正在生成角色与场景的视觉提示词（风格：${visualStyle}）...`);

    let artDirection: ArtDirection | undefined;
    if (existingData?.artDirection) {
        console.log("♻️ 复用全局美术指导文档");
        artDirection = existingData.artDirection;
    } else {
        try {
          artDirection = await generateArtDirection(
            parsed.title || '未命名剧本',
            genre,
            parsed.logline || '',
            characters.map((c: any) => ({ name: c.name, gender: c.gender, age: c.age, personality: c.personality })),
            scenes.map((s: any) => ({ location: s.location, time: s.time, atmosphere: s.atmosphere })),
            visualStyle,
            language,
            model
          );
          console.log("✅ 全局美术指导文档生成完成，风格关键词:", artDirection.moodKeywords.join(', '));
        } catch (e) {
          console.error("⚠️ 全局美术指导文档生成失败，将使用默认风格:", e);
        }
    }

    // ========== Phase 2: 批量生成角色视觉提示词 ==========
    const charactersToGenerate = characters.filter((c: any) => !c.visualPrompt);
    
    if (charactersToGenerate.length > 0 && artDirection) {
      try {
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        logScriptProgress(`正在批量生成 ${charactersToGenerate.length} 个角色的视觉提示词（风格统一模式）...`);

        const batchResults = await generateAllCharacterPrompts(
          charactersToGenerate, artDirection, genre, visualStyle, language, model
        );

        for (let i = 0; i < charactersToGenerate.length; i++) {
          const char = charactersToGenerate[i];
          if (batchResults[i] && batchResults[i].visualPrompt) {
            char.visualPrompt = batchResults[i].visualPrompt;
            char.negativePrompt = batchResults[i].negativePrompt;
          }
        }

        // Fallback: individually generate failed characters
        const failedCharacters = charactersToGenerate.filter((c: any) => !c.visualPrompt);
        if (failedCharacters.length > 0) {
          console.log(`⚠️ ${failedCharacters.length} 个角色需要单独重新生成提示词`);
          logScriptProgress(`${failedCharacters.length} 个角色需要单独重新生成...`);
          for (const char of failedCharacters) {
            try {
              await new Promise(resolve => setTimeout(resolve, 1500));
              console.log(`  重新生成角色提示词: ${char.name}`);
              logScriptProgress(`重新生成角色视觉提示词：${char.name}`);
              const prompts = await generateVisualPrompts('character', char, genre, model, visualStyle, language, artDirection);
              char.visualPrompt = prompts.visualPrompt;
              char.negativePrompt = prompts.negativePrompt;
            } catch (e) {
              console.error(`Failed to generate visual prompt for character ${char.name}:`, e);
            }
          }
        }
      } catch (e) {
        console.error("批量角色提示词生成失败，回退到逐个生成模式:", e);
        for (let i = 0; i < charactersToGenerate.length; i++) {
          try {
            if (i > 0) await new Promise(resolve => setTimeout(resolve, 1500));
            console.log(`  生成角色提示词: ${charactersToGenerate[i].name}`);
            logScriptProgress(`生成角色视觉提示词：${charactersToGenerate[i].name}`);
            const prompts = await generateVisualPrompts('character', charactersToGenerate[i], genre, model, visualStyle, language, artDirection);
            charactersToGenerate[i].visualPrompt = prompts.visualPrompt;
            charactersToGenerate[i].negativePrompt = prompts.negativePrompt;
          } catch (e2) {
            console.error(`Failed to generate visual prompt for character ${charactersToGenerate[i].name}:`, e2);
          }
        }
      }
    } else if (charactersToGenerate.length > 0) {
      for (let i = 0; i < charactersToGenerate.length; i++) {
        try {
          if (i > 0) await new Promise(resolve => setTimeout(resolve, 1500));
          console.log(`  生成角色提示词: ${charactersToGenerate[i].name}`);
          logScriptProgress(`生成角色视觉提示词：${charactersToGenerate[i].name}`);
          const prompts = await generateVisualPrompts('character', charactersToGenerate[i], genre, model, visualStyle, language);
          charactersToGenerate[i].visualPrompt = prompts.visualPrompt;
          charactersToGenerate[i].negativePrompt = prompts.negativePrompt;
        } catch (e) {
          console.error(`Failed to generate visual prompt for character ${charactersToGenerate[i].name}:`, e);
        }
      }
    }

    // ========== Phase 3: 生成场景视觉提示词 ==========
    for (let i = 0; i < scenes.length; i++) {
      if (scenes[i].visualPrompt) {
          console.log(`  跳过已生成场景: ${scenes[i].location}`);
          continue;
      }
      try {
        if (i > 0 || characters.length > 0) await new Promise(resolve => setTimeout(resolve, 1500));
        console.log(`  生成场景提示词: ${scenes[i].location}`);
        logScriptProgress(`生成场景视觉提示词：${scenes[i].location}`);
        const prompts = await generateVisualPrompts('scene', scenes[i], genre, model, visualStyle, language, artDirection);
        scenes[i].visualPrompt = prompts.visualPrompt;
        scenes[i].negativePrompt = prompts.negativePrompt;
      } catch (e) {
        console.error(`Failed to generate visual prompt for scene ${scenes[i].location}:`, e);
      }
    }

    console.log("✅ 视觉提示词生成完成！");
    logScriptProgress('视觉提示词生成完成');

    const result = {
      title: parsed.title || "未命名剧本",
      genre: genre,
      logline: parsed.logline || "",
      language: language,
      artDirection,
      characters,
      scenes,
      props: [],
      storyParagraphs
    };

    addRenderLogWithTokens({
      type: 'script-parsing',
      resourceId: 'script-parse-' + Date.now(),
      resourceName: result.title,
      status: 'success',
      model: model,
      prompt: prompt.substring(0, 200) + '...',
      duration: Date.now() - startTime
    });

    return result;
  } catch (error: any) {
    addRenderLogWithTokens({
      type: 'script-parsing',
      resourceId: 'script-parse-' + Date.now(),
      resourceName: '剧本解析',
      status: 'failed',
      model: model,
      prompt: prompt.substring(0, 200) + '...',
      error: error.message,
      duration: Date.now() - startTime
    });
    throw error;
  }
};

// ============================================
// 分镜生成
// ============================================

/**
 * 生成分镜列表
 * 根据剧本数据和目标时长，为每个场景生成适量的分镜头
 */
export const generateShotList = async (scriptData: ScriptData, model: string = 'gpt-5.1'): Promise<Shot[]> => {
  console.log('🎬 generateShotList 调用 - 使用模型:', model, '视觉风格:', scriptData.visualStyle);
  logScriptProgress('正在生成分镜列表...');
  const overallStartTime = Date.now();

  if (!scriptData.scenes || scriptData.scenes.length === 0) {
    return [];
  }

  const lang = scriptData.language || '中文';
  const visualStyle = scriptData.visualStyle || 'live-action';
  const stylePrompt = getStylePrompt(visualStyle);
  const artDir = scriptData.artDirection;

  const artDirectionBlock = artDir ? `
      ⚠️ GLOBAL ART DIRECTION (MANDATORY for ALL visualPrompt fields):
      ${artDir.consistencyAnchors}
      Color Palette: Primary=${artDir.colorPalette.primary}, Secondary=${artDir.colorPalette.secondary}, Accent=${artDir.colorPalette.accent}
      Color Temperature: ${artDir.colorPalette.temperature}, Saturation: ${artDir.colorPalette.saturation}
      Lighting Style: ${artDir.lightingStyle}
      Texture: ${artDir.textureStyle}
      Mood Keywords: ${artDir.moodKeywords.join(', ')}
      Character Proportions: ${artDir.characterDesignRules.proportions}
      Line/Edge Style: ${artDir.characterDesignRules.lineWeight}
      Detail Level: ${artDir.characterDesignRules.detailLevel}
` : '';

  const processScene = async (scene: Scene, index: number): Promise<Shot[]> => {
    const sceneStartTime = Date.now();
    const paragraphs = scriptData.storyParagraphs
      .filter(p => String(p.sceneRefId) === String(scene.id))
      .map(p => p.text)
      .join('\n');

    if (!paragraphs.trim()) return [];

    const targetDurationStr = scriptData.targetDuration || '60s';
    const targetSeconds = parseInt(targetDurationStr.replace(/[^\d]/g, '')) || 60;
    const totalShotsNeeded = Math.round(targetSeconds / 10);
    const scenesCount = scriptData.scenes.length;
    const shotsPerScene = Math.max(1, Math.round(totalShotsNeeded / scenesCount));

    // ————————————————————————————————————————————————
    // Phase 1: Skeleton Generation (结构生成)
    // ————————————————————————————————————————————————
    const skeletonPrompt = buildShotListSkeletonPrompt(
      lang,
      scene,
      index,
      paragraphs,
      scriptData,
      totalShotsNeeded,
      shotsPerScene
    );

    let skeletonShots: any[] = [];
    try {
      console.log(`  Step 1: 场景 ${index + 1} 分镜骨架生成 - 模型:`, model);
      const responseText = await retryOperation(() => chatCompletion(skeletonPrompt, model, 0.5, 4096, 'json_object'));
      const text = cleanJsonString(responseText);
      const parsed = JSON.parse(text);
      skeletonShots = Array.isArray(parsed.shots) ? parsed.shots : [];
      
      console.log(`  ✅ 场景 ${index + 1} 骨架生成完成，共 ${skeletonShots.length} 个镜头`);
    } catch (e: any) {
      console.error(`Failed to generate skeleton for scene ${scene.id}`, e);
      addRenderLogWithTokens({
        type: 'script-parsing',
        resourceId: `shot-gen-scene-${scene.id}-skeleton`,
        resourceName: `分镜骨架生成失败 - 场景${index + 1}`,
        status: 'failed',
        model: model,
        prompt: skeletonPrompt.substring(0, 200) + '...',
        error: e.message,
        duration: Date.now() - sceneStartTime
      });
      return [];
    }

    if (skeletonShots.length === 0) return [];

    // ————————————————————————————————————————————————
    // Phase 2: Visual Details Generation (细节填充)
    // ————————————————————————————————————————————————
    console.log(`  Step 2: 场景 ${index + 1} 视觉细节生成 (并行批处理)...`);
    
    // 按每 5 个镜头一批进行并行处理，避免 Token 溢出
    const BATCH_SIZE_DETAILS = 5;
    const detailsPromises = [];
    
    for (let i = 0; i < skeletonShots.length; i += BATCH_SIZE_DETAILS) {
        const batch = skeletonShots.slice(i, i + BATCH_SIZE_DETAILS);
        // 简化 batch 对象，只保留 AI 需要的信息，减少 Input Token
        const simplifiedBatch = batch.map((s: any) => ({
            id: s.id,
            shotSize: s.shotSize,
            cameraMovement: s.cameraMovement,
            actionSummary: s.actionSummary
        }));

        const batchPrompt = buildShotVisualDetailsPrompt(
            lang,
            stylePrompt,
            visualStyle,
            artDirectionBlock,
            simplifiedBatch
        );
        
        detailsPromises.push((async () => {
             try {
                 // 使用较高的 temperature 激发创造力
                 const res = await retryOperation(() => chatCompletion(batchPrompt, model, 0.7, 4096, 'json_object'));
                 const text = cleanJsonString(res);
                 const parsed = JSON.parse(text);
                 return parsed.details || [];
             } catch (e) {
                 console.error(`Visual details batch failed for scene ${scene.id}`, e);
                 return [];
             }
        })());
    }

    const detailsResults = await Promise.all(detailsPromises);
    const allDetails = detailsResults.flat();
    
    // Merge details back to skeleton
    const result = skeletonShots.map((s: any) => {
        // 尝试匹配细节 (假设 ID 是数字或字符串且匹配)
        const detail = allDetails.find((d: any) => String(d.id) === String(s.id));
        return {
            ...s,
            sceneId: String(scene.id),
            // 如果 AI 没生成细节，用 actionSummary 兜底，防止空 Prompt
            aiImagePrompt: detail?.aiImagePrompt || s.actionSummary,
            aiVideoPrompt: detail?.aiVideoPrompt || '',
            audioEffects: detail?.audioEffects || '',
            // 确保其他字段存在
            characters: s.characters || [],
            notes: s.notes || ''
        };
    });

    addRenderLogWithTokens({
      type: 'script-parsing',
      resourceId: `shot-gen-scene-${scene.id}-${Date.now()}`,
      resourceName: `分镜生成(两阶段) - 场景${index + 1}: ${scene.location}`,
      status: 'success',
      model: model,
      prompt: skeletonPrompt.substring(0, 200) + '... (Stage 1)',
      duration: Date.now() - sceneStartTime
    });

    return result;
  };

  // Process scenes sequentially
  const BATCH_SIZE = 1;
  const allShots: Shot[] = [];

  for (let i = 0; i < scriptData.scenes.length; i += BATCH_SIZE) {
    if (i > 0) await new Promise(resolve => setTimeout(resolve, 1500));

    const batch = scriptData.scenes.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((scene, idx) => processScene(scene, i + idx))
    );
    batchResults.forEach(shots => allShots.push(...shots));
  }

  if (allShots.length === 0) {
    throw new Error('分镜生成失败：AI返回为空（可能是 JSON 结构不匹配或场景内容未被识别）。请打开控制台查看分镜生成日志。');
  }

  return allShots.map((s, idx) => {
    // 兼容逻辑：如果 AI 未返回 keyframes 数组但返回了 aiImagePrompt，则自动构建起始帧
    let keyframes = Array.isArray(s.keyframes) ? s.keyframes : [];
    if (keyframes.length === 0 && s.aiImagePrompt) {
      keyframes = [{
        type: 'start',
        visualPrompt: s.aiImagePrompt,
        status: 'pending'
      }];
    }

    return {
      ...s,
      id: `shot-${idx + 1}`,
      keyframes: keyframes.map((k: any) => ({
        ...k,
        id: `kf-${idx + 1}-${k.type || 'start'}`,
        status: 'pending'
      })),
      // 显式确保新字段被传递（防止 AI 返回 null）
      aiImagePrompt: s.aiImagePrompt || '',
      aiVideoPrompt: s.aiVideoPrompt || '',
      audioEffects: s.audioEffects || '',
      notes: s.notes || ''
    };
  });
};

// ============================================
// 剧本续写/改写
// ============================================

/**
 * AI续写功能 - 基于已有剧本内容续写后续情节
 */
export const continueScript = async (existingScript: string, language: string = '中文', model: string = 'gpt-5.1'): Promise<string> => {
  console.log('✍️ continueScript 调用 - 使用模型:', model);
  const startTime = Date.now();

  const prompt = buildScriptContinuationPrompt(existingScript, language);

  try {
    const result = await retryOperation(() => chatCompletion(prompt, model, 0.8, 4096));
    const duration = Date.now() - startTime;

    await addRenderLogWithTokens({
      type: 'script-parsing',
      resourceId: 'continue-script',
      resourceName: 'AI续写剧本',
      status: 'success',
      model,
      duration,
      prompt: existingScript.substring(0, 200) + '...'
    });

    return result;
  } catch (error) {
    console.error('❌ 续写失败:', error);
    throw error;
  }
};

/**
 * AI续写功能（流式）
 */
export const continueScriptStream = async (
  existingScript: string,
  language: string = '中文',
  model: string = 'gpt-5.1',
  onDelta?: (delta: string) => void
): Promise<string> => {
  console.log('✍️ continueScriptStream 调用 - 使用模型:', model);
  const startTime = Date.now();

  const prompt = buildScriptContinuationPrompt(existingScript, language);

  try {
    const result = await retryOperation(() => chatCompletionStream(prompt, model, 0.8, 4096, undefined, 600000, onDelta));
    const duration = Date.now() - startTime;

    await addRenderLogWithTokens({
      type: 'script-parsing',
      resourceId: 'continue-script',
      resourceName: 'AI续写剧本（流式）',
      status: 'success',
      model,
      duration,
      prompt: existingScript.substring(0, 200) + '...'
    });

    return result;
  } catch (error) {
    console.error('❌ 续写失败（流式）:', error);
    throw error;
  }
};

/**
 * AI改写功能 - 对整个剧本进行改写
 */
export const rewriteScript = async (originalScript: string, language: string = '中文', model: string = 'gpt-5.1'): Promise<string> => {
  console.log('🔄 rewriteScript 调用 - 使用模型:', model);
  const startTime = Date.now();

  const prompt = buildScriptRewritePrompt(originalScript, language);

  try {
    const result = await retryOperation(() => chatCompletion(prompt, model, 0.7, 8192));
    const duration = Date.now() - startTime;

    await addRenderLogWithTokens({
      type: 'script-parsing',
      resourceId: 'rewrite-script',
      resourceName: 'AI改写剧本',
      status: 'success',
      model,
      duration,
      prompt: originalScript.substring(0, 200) + '...'
    });

    return result;
  } catch (error) {
    console.error('❌ 改写失败:', error);
    throw error;
  }
};

/**
 * AI改写功能（流式）
 */
export const rewriteScriptStream = async (
  originalScript: string,
  language: string = '中文',
  model: string = 'gpt-5.1',
  onDelta?: (delta: string) => void
): Promise<string> => {
  console.log('🔄 rewriteScriptStream 调用 - 使用模型:', model);
  const startTime = Date.now();

  const prompt = buildScriptRewritePrompt(originalScript, language);

  try {
    const result = await retryOperation(() => chatCompletionStream(prompt, model, 0.7, 8192, undefined, 600000, onDelta));
    const duration = Date.now() - startTime;

    await addRenderLogWithTokens({
      type: 'script-parsing',
      resourceId: 'rewrite-script',
      resourceName: 'AI改写剧本（流式）',
      status: 'success',
      model,
      duration,
      prompt: originalScript.substring(0, 200) + '...'
    });

    return result;
  } catch (error) {
    console.error('❌ 改写失败（流式）:', error);
    throw error;
  }
};
