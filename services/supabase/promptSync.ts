/**
 * 提示词模板同步工具
 * 用于将本地写死的提示词模板同步到 Supabase 数据库
 * 执行方式：在浏览器控制台调用 window.syncPrompts()
 */

import { supabase } from './client';
import { VISUAL_STYLE_PROMPTS, VISUAL_STYLE_PROMPTS_CN, NEGATIVE_PROMPTS, SCENE_NEGATIVE_PROMPTS } from '../ai/promptConstants';
import * as prompts from '../ai/prompts';

// 定义提示词模板数据结构
interface PromptTemplate {
  category: string;
  name: string;
  content: string;
  version: string;
  is_default: boolean;
}

// 提取并整理提示词数据
const collectPrompts = (): PromptTemplate[] => {
  const templates: PromptTemplate[] = [];

  // 1. 静态常量 (promptConstants.ts)
  
  // Visual Styles
  Object.entries(VISUAL_STYLE_PROMPTS).forEach(([key, value]) => {
    templates.push({
      category: 'visual_style',
      name: `VISUAL_STYLE_${key.toUpperCase()}`,
      content: value,
      version: '1.0.0',
      is_default: true
    });
  });

  // Visual Styles CN
  Object.entries(VISUAL_STYLE_PROMPTS_CN).forEach(([key, value]) => {
    templates.push({
      category: 'visual_style_cn',
      name: `VISUAL_STYLE_CN_${key.toUpperCase()}`,
      content: value,
      version: '1.0.0',
      is_default: true
    });
  });

  // Negative Prompts
  Object.entries(NEGATIVE_PROMPTS).forEach(([key, value]) => {
    templates.push({
      category: 'negative_prompt',
      name: `NEGATIVE_${key.toUpperCase()}`,
      content: value,
      version: '1.0.0',
      is_default: true
    });
  });

  // Scene Negative Prompts
  Object.entries(SCENE_NEGATIVE_PROMPTS).forEach(([key, value]) => {
    templates.push({
      category: 'scene_negative_prompt',
      name: `SCENE_NEGATIVE_${key.toUpperCase()}`,
      content: value,
      version: '1.0.0',
      is_default: true
    });
  });

  // 2. 动态构建函数 (prompts.ts)
  // 注意：由于函数包含逻辑，我们这里存储的是函数的字符串表示，或者核心模板部分
  // 为了简化，我们暂时只存储几个核心的、结构相对简单的模板字符串
  // 对于复杂的构建函数，可能需要重构代码以分离模板和逻辑，目前先存储函数源码作为参考或后续支持

  // 暂时手动提取几个核心模板的字符串形式（模拟）
  // 实际项目中可能需要将 prompts.ts 重构为 Template + Variables 的形式
  
  // 这里我们将函数源码作为 content 存储，标记为 'function_source'
  // 这样可以在管理后台查看，或者未来支持动态执行（虽然有安全风险，但在内部工具中可行）
  
  const functionNames = [
    'buildSimpleScriptParsePrompt',
    'buildSimpleShotGenerationPrompt',
    'buildSimpleVisualPromptGenerationPrompt',
    'buildActionSuggestionPrompt',
    'buildShotSplitPrompt',
    'buildKeyframeOptimizationPrompt',
    'buildOptimizeBothKeyframesPrompt',
    'buildDetailedKeyframeOptimizationPrompt',
    'buildDetailedActionSuggestionPrompt',
    'buildDetailedShotSplitPrompt',
    'buildKeyframeEnhancementPrompt',
    'buildNineGridPanelsPrompt',
    'buildNineGridImagePrompt',
    'buildTurnaroundPanelPrompt',
    'buildTurnaroundImagePrompt',
    'buildScriptParsingPrompt',
    'buildShotListGenerationPrompt',
    'buildScriptContinuationPrompt',
    'buildScriptRewritePrompt',
    'buildArtDirectionPrompt',
    'buildBatchCharacterPrompt',
    'buildCharacterPrompt',
    'buildScenePrompt',
    'buildOutfitVariationPrompt',
    'buildConsistencyPrompt',
    'buildThreeViewPrompt'
  ];

  functionNames.forEach(funcName => {
    // @ts-ignore
    const func = prompts[funcName];
    if (typeof func === 'function') {
      templates.push({
        category: 'prompt_builder',
        name: funcName,
        content: func.toString(),
        version: '1.0.0',
        is_default: true
      });
    }
  });

  return templates;
};

// 同步到 Supabase
export const syncPromptsToSupabase = async () => {
  if (!supabase) {
    console.error('Supabase 未配置');
    return;
  }

  const templates = collectPrompts();
  console.log(`准备同步 ${templates.length} 个提示词模板...`);

  let successCount = 0;
  let failCount = 0;

  for (const template of templates) {
    const { error } = await supabase
      .from('prompt_templates')
      .upsert(template, { onConflict: 'category, name, version' });

    if (error) {
      console.error(`同步失败: ${template.name}`, error);
      failCount++;
    } else {
      console.log(`同步成功: ${template.name}`);
      successCount++;
    }
  }

  console.log(`同步完成。成功: ${successCount}, 失败: ${failCount}`);
  return { success: successCount, failed: failCount };
};

// 挂载到 window 对象以便在控制台调用
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.syncPrompts = syncPromptsToSupabase;
}
