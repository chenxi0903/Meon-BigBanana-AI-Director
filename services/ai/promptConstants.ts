/**
 * 提示词常量管理
 * 支持从 Supabase 获取远程配置，并提供本地回退值
 */

import { supabase } from '../supabase/client';

// ============================================
// 本地默认值 (Fallback)
// ============================================

const DEFAULT_VISUAL_STYLE_PROMPTS: { [key: string]: string } = {
  'live-action': 'photorealistic, cinematic film quality, real human actors, professional cinematography, natural lighting, 8K resolution, shallow depth of field, film grain texture, color graded, anamorphic lens flare, three-point lighting setup',
  'anime': 'Japanese anime style, cel-shaded, vibrant saturated colors, large expressive eyes with detailed iris highlights, dynamic action poses, clean sharp outlines, consistent line weight throughout, Studio Ghibli/Makoto Shinkai quality, painted sky backgrounds, soft ambient lighting with dramatic rim light',
  '2d-animation': 'classic 2D animation, hand-drawn style, Disney/Pixar quality, smooth clean lines with consistent weight, expressive characters with squash-and-stretch principles, painterly watercolor backgrounds, soft gradient shading, warm color palette, round friendly character proportions',
  '3d-animation': 'high-quality 3D CGI animation, Pixar/DreamWorks style, subsurface scattering on skin, detailed PBR textures, stylized character proportions, volumetric lighting, ambient occlusion, soft shadows, physically-based rendering, motion blur',
  'cyberpunk': 'cyberpunk aesthetic, neon-lit urban environment, rain-soaked reflective streets, holographic UI displays, high-tech low-life contrast, Blade Runner style, volumetric fog with neon color bleeding, chromatic aberration, cool blue-purple palette with hot pink and cyan accents, gritty detailed textures',
  'oil-painting': 'oil painting style, visible impasto brushstrokes, rich layered textures, classical art composition with golden ratio, museum quality fine art, warm undertones, Rembrandt lighting, chiaroscuro contrast, canvas texture visible, glazing technique color depth',
};

const DEFAULT_VISUAL_STYLE_PROMPTS_CN: { [key: string]: string } = {
  'live-action': '真人实拍电影风格，photorealistic，8K高清，专业摄影',
  'anime': '日本动漫风格，cel-shaded，鲜艳色彩，Studio Ghibli品质',
  '2d-animation': '经典2D动画风格，手绘风格，Disney/Pixar品质',
  '3d-animation': '3D CGI动画，Pixar/DreamWorks风格，精细材质',
  'cyberpunk': '赛博朋克美学，霓虹灯光，未来科技感',
  'oil-painting': '油画风格，可见笔触，古典艺术构图',
};

const DEFAULT_NEGATIVE_PROMPTS: { [key: string]: string } = {
  'live-action': 'cartoon, anime, illustration, painting, drawing, 3d render, cgi, low quality, blurry, grainy, watermark, text, logo, signature, distorted face, bad anatomy, extra limbs, mutated hands, deformed, ugly, disfigured, poorly drawn, amateur',
  'anime': 'photorealistic, 3d render, western cartoon, ugly, bad anatomy, extra limbs, deformed limbs, blurry, watermark, text, logo, poorly drawn face, mutated hands, extra fingers, missing fingers, bad proportions, grotesque',
  '2d-animation': 'photorealistic, 3d, low quality, pixelated, blurry, watermark, text, bad anatomy, deformed, ugly, amateur drawing, inconsistent style, rough sketch',
  '3d-animation': 'photorealistic, 2d, flat, hand-drawn, low poly, bad topology, texture artifacts, z-fighting, clipping, low quality, blurry, watermark, text, bad rigging, unnatural movement',
  'cyberpunk': 'bright daylight, pastoral, medieval, fantasy, cartoon, low tech, rural, natural, watermark, text, logo, low quality, blurry, amateur',
  'oil-painting': 'digital art, photorealistic, 3d render, cartoon, anime, low quality, blurry, watermark, text, amateur, poorly painted, muddy colors, overworked canvas',
};

const DEFAULT_SCENE_NEGATIVE_PROMPTS: { [key: string]: string } = {
  'live-action': 'person, people, human, man, woman, child, figure, silhouette, crowd, pedestrian, portrait, face, body, hands, feet, ' + DEFAULT_NEGATIVE_PROMPTS['live-action'],
  'anime': 'person, people, human, character, figure, silhouette, crowd, portrait, face, body, hands, ' + DEFAULT_NEGATIVE_PROMPTS['anime'],
  '2d-animation': 'person, people, human, character, figure, silhouette, crowd, portrait, face, body, ' + DEFAULT_NEGATIVE_PROMPTS['2d-animation'],
  '3d-animation': 'person, people, human, character, figure, silhouette, crowd, portrait, face, body, ' + DEFAULT_NEGATIVE_PROMPTS['3d-animation'],
  'cyberpunk': 'person, people, human, figure, silhouette, crowd, pedestrian, portrait, face, body, ' + DEFAULT_NEGATIVE_PROMPTS['cyberpunk'],
  'oil-painting': 'person, people, human, figure, silhouette, crowd, portrait, face, body, ' + DEFAULT_NEGATIVE_PROMPTS['oil-painting'],
};

// ============================================
// 运行时存储 (Runtime Storage)
// ============================================

export let VISUAL_STYLE_PROMPTS = { ...DEFAULT_VISUAL_STYLE_PROMPTS };
export let VISUAL_STYLE_PROMPTS_CN = { ...DEFAULT_VISUAL_STYLE_PROMPTS_CN };
export let NEGATIVE_PROMPTS = { ...DEFAULT_NEGATIVE_PROMPTS };
export let SCENE_NEGATIVE_PROMPTS = { ...DEFAULT_SCENE_NEGATIVE_PROMPTS };

// ============================================
// 远程加载逻辑
// ============================================

let isInitialized = false;

/**
 * 从 Supabase 加载提示词配置
 * 这是一个异步操作，通常在应用启动时调用
 */
export const loadRemotePrompts = async () => {
  if (isInitialized) return;
  if (!supabase) {
    console.warn('Supabase 未配置，使用本地默认提示词');
    return;
  }

  try {
    const { data, error } = await supabase
      .from('prompt_templates')
      .select('*')
      .in('category', ['visual_style', 'visual_style_cn', 'negative_prompt', 'scene_negative_prompt']);

    if (error) {
      console.error('加载远程提示词失败:', error);
      return;
    }

    if (data && data.length > 0) {
      console.log(`成功加载 ${data.length} 个远程提示词配置`);
      
      data.forEach(item => {
        // 解析 key: VISUAL_STYLE_ANIME -> anime
        // 命名规范假设: CATEGORY_KEY
        
        if (item.category === 'visual_style') {
          const key = item.name.replace('VISUAL_STYLE_', '').toLowerCase().replace(/_/g, '-');
          // 修正 mapping: live-action 在 DB 中可能是 LIVE_ACTION，转为 live-action
          VISUAL_STYLE_PROMPTS[key] = item.content;
        } 
        else if (item.category === 'visual_style_cn') {
          const key = item.name.replace('VISUAL_STYLE_CN_', '').toLowerCase().replace(/_/g, '-');
          VISUAL_STYLE_PROMPTS_CN[key] = item.content;
        }
        else if (item.category === 'negative_prompt') {
          const key = item.name.replace('NEGATIVE_', '').toLowerCase().replace(/_/g, '-');
          NEGATIVE_PROMPTS[key] = item.content;
        }
        else if (item.category === 'scene_negative_prompt') {
          const key = item.name.replace('SCENE_NEGATIVE_', '').toLowerCase().replace(/_/g, '-');
          SCENE_NEGATIVE_PROMPTS[key] = item.content;
        }
      });
      
      isInitialized = true;
    }
  } catch (err) {
    console.error('加载远程提示词异常:', err);
  }
};

// 尝试立即初始化（非阻塞）
loadRemotePrompts();

// ============================================
// 导出工具函数
// ============================================

/**
 * 获取视觉风格的英文提示词，如果风格不在预设中则原样返回
 */
export const getStylePrompt = (visualStyle: string): string => {
  return VISUAL_STYLE_PROMPTS[visualStyle] || visualStyle;
};

/**
 * 获取视觉风格的中文描述，如果风格不在预设中则原样返回
 */
export const getStylePromptCN = (visualStyle: string): string => {
  return VISUAL_STYLE_PROMPTS_CN[visualStyle] || visualStyle;
};

/**
 * 获取角色负面提示词
 */
export const getNegativePrompt = (visualStyle: string): string => {
  return NEGATIVE_PROMPTS[visualStyle] || NEGATIVE_PROMPTS['live-action'];
};

/**
 * 获取场景负面提示词
 */
export const getSceneNegativePrompt = (visualStyle: string): string => {
  return SCENE_NEGATIVE_PROMPTS[visualStyle] || SCENE_NEGATIVE_PROMPTS['live-action'];
};
