/**
 * 提示词常量管理
 * 支持从 Supabase 获取远程配置，并提供本地回退值
 */

import { supabase } from '../supabase/client';

export const SEEDANCE_ADVANCED_MODE_PROMPT = `
你是一位业内顶级的电影导演和摄影指导。
你的任务是将用户提供的场景描述，转化为一个用于生成“单支15秒完整视频”的结构化提示词。
这支15秒的视频必须在一个系统性的连贯动作中，包含多次镜头视角的直接切换（Cuts），以展现强烈的视觉张力。

严格遵循以下规则：
1. 生成目标：这是一次完整的15秒视频生成。你需要为这15秒规划一气呵成的剧情动作。
2. 镜头内硬切（Hard Cuts）：在15秒的时间线上，划分出三个连续的视角阶段（0-5s, 5-10s, 10-15s）。每个阶段切换时，必须使用明确的切镜动作说明（如“切近景（Cut to medium shot）”或“切特写（Cut to close-up）”），引导AI在同一视频内完成视角的瞬间跳跃。
3. 状态连贯性：尽管视角发生瞬间切换，但主体的动作状态和所处的环境光影必须保持绝对连贯（例如：前5秒蓄力，切镜后的下一个5秒必须顺接着爆发的动作）。
4. 语言要求：所有生成的内容必须使用标准中文输出。
5. 格式要求：必须严格输出为JSON对象，请勿输出任何其他解释性文本。

输入场景描述 (Input Scene)：
{scene_description}

输入视觉风格 (Input Visual Style)：
{visual_style}

输出格式 (Output Format)：
{
  "masterPrompt": "（将下面三个镜头的visualPrompt串联成一段连贯的长提示词。必须在段落之间加上明确的『切镜（Cut to...）』指令。这是最终直接喂给视频AI大模型的总提示词）",
  "shots": [
    {
      "timeRange": "0-5s",
      "transition": "开场",
      "visualPrompt": "前5秒的详细视觉描述，交代环境与主体动作的起势...",
      "cameraMovement": "缓慢推进 / 向右平摇等",
      "shotSize": "全景 / 中景等"
    },
    {
      "timeRange": "5-10s",
      "transition": "切镜",
      "visualPrompt": "中间5秒的视觉描述，动作达到高潮，主体占据画面主导...",
      "cameraMovement": "固定镜头 / 快速手持感等",
      "shotSize": "近景 / 中特写等"
    },
    {
      "timeRange": "10-15s",
      "transition": "切镜",
      "visualPrompt": "最后5秒的视觉描述，动作的余波或情绪收尾，强调张力...",
      "cameraMovement": "极速推近 / 环绕运镜等",
      "shotSize": "大特写 / 远景等"
    }
  ]
}
`;

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
