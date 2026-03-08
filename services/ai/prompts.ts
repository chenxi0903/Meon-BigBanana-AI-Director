import { getStylePromptCN, getStylePrompt, SEEDANCE_ADVANCED_MODE_PROMPT } from './promptConstants';
import { getEffectivePrompt } from '../promptManager';

type TemplateVars = Record<string, any>;

const getTemplateValue = (vars: TemplateVars, path: string): any => {
  const parts = path.split('.').map(p => p.trim()).filter(Boolean);
  let current: any = vars;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
};

const applyTemplate = (template: string, vars: TemplateVars): string => {
  const replaced = template.replace(/\$\{([^}]+)\}/g, (match, expr, offset, full) => {
    if (offset > 0 && full[offset - 1] === '\\') return match;
    const key = String(expr || '').trim();
    const value = getTemplateValue(vars, key);
    return value == null ? '' : String(value);
  });
  return replaced.replace(/\\\$\{/g, '${');
};

export const buildSeedanceAdvancedModePrompt = (
  sceneDescription: string,
  visualStyle: string
): string => {
  const fallback = SEEDANCE_ADVANCED_MODE_PROMPT;
  const template = getEffectivePrompt('buildSeedanceAdvancedModePrompt', fallback);
  return applyTemplate(template, {
    scene_description: sceneDescription,
    visual_style: visualStyle
  });
};

// ============================================
// Simple Model Service Prompts (for modelService.ts)
// ============================================

export const buildSimpleScriptParsePrompt = (rawText: string, language: string, visualStyle: string): string => {
  const fallback = `You are a professional screenwriter assistant. Parse the following script/story into structured data.

Script Text:
${rawText}

Requirements:
- Language: ${language}
- Visual Style: ${visualStyle}
- Extract: title, genre, logline, characters (with name, gender, age, personality), scenes (with location, time, atmosphere)
- Generate story paragraphs with scene references

Return a valid JSON object with the structure:
{
  "title": "string",
  "genre": "string", 
  "logline": "string",
  "characters": [{"id": "string", "name": "string", "gender": "string", "age": "string", "personality": "string", "variations": []}],
  "scenes": [{"id": "string", "location": "string", "time": "string", "atmosphere": "string"}],
  "storyParagraphs": [{"id": number, "text": "string", "sceneRefId": "string"}]
}`;
  const template = getEffectivePrompt('buildSimpleScriptParsePrompt', fallback);
  return applyTemplate(template, { rawText, language, visualStyle });
};

export const buildSimpleShotGenerationPrompt = (scriptData: any): string => {
  const fallback = `You are a professional film director. Generate a shot list for the following script.

Script Data:
${JSON.stringify(scriptData, null, 2)}

Generate detailed shots with:
- sceneId: reference to scene
- actionSummary: what happens in the shot
- dialogue: any spoken lines
- cameraMovement: camera direction
- shotSize: shot type (wide, medium, close-up, etc.)
- characters: array of character IDs in the shot

Return a valid JSON object:
{
  "shots": [
    {
      "id": "string",
      "sceneId": "string",
      "actionSummary": "string",
      "dialogue": "string",
      "cameraMovement": "string",
      "shotSize": "string",
      "characters": ["string"],
      "keyframes": []
    }
  ]
}`;
  const template = getEffectivePrompt('buildSimpleShotGenerationPrompt', fallback);
  return applyTemplate(template, {
    scriptData,
    scriptDataJson: JSON.stringify(scriptData, null, 2),
  });
};

export const buildSimpleVisualPromptGenerationPrompt = (options: {
  type: 'character' | 'scene';
  data: any;
  genre: string;
  visualStyle: string;
  language: string;
}): string => {
  const { type, data, genre, visualStyle, language } = options;
  
  const defaultTemplate = type === 'character' 
    ? `Generate a detailed visual prompt for this character:
Name: \${data.name}
Gender: \${data.gender}
Age: \${data.age}
Personality: \${data.personality}

Genre: \${genre}
Visual Style: \${visualStyle}
Language: \${language}

Return JSON:
{
  "visualPrompt": "detailed description for image generation",
  "negativePrompt": "elements to avoid"
}`
    : `Generate a detailed visual prompt for this scene:
Location: \${data.location}
Time: \${data.time}
Atmosphere: \${data.atmosphere}

Genre: \${genre}
Visual Style: \${visualStyle}
Language: \${language}

Requirements:
- Detailed description of the environment, architecture, and lighting.
- Specific details that establish the mood and atmosphere.
- IMPORTANT: Keep the visualPrompt description concise and under 600 characters to ensure compatibility with image generation models.

Return JSON:
{
  "visualPrompt": "detailed description for image generation",
  "negativePrompt": "elements to avoid"
}`;

  const template = getEffectivePrompt('buildSimpleVisualPromptGenerationPrompt', defaultTemplate);
  return applyTemplate(template, {
    type,
    genre,
    visualStyle,
    language,
    data,
    ...(data && typeof data === 'object' ? data : {}),
  });
};

export const buildActionSuggestionPrompt = (options: {
  startFramePrompt: string;
  endFramePrompt: string;
  cameraMovement: string;
}): string => {
  const fallback = `Suggest an action description connecting these keyframes:

Start Frame: ${options.startFramePrompt}
End Frame: ${options.endFramePrompt}
Camera Movement: ${options.cameraMovement}

Generate a concise action summary describing the transition. Return only the action text.`;
  const template = getEffectivePrompt('buildActionSuggestionPrompt', fallback);
  return applyTemplate(template, { ...options });
};

export const buildShotSplitPrompt = (options: {
  shot: any;
  sceneInfo: string;
  characterNames: string[];
  visualStyle: string;
}): string => {
  const fallback = `Split this shot into multiple sub-shots:

Shot: ${JSON.stringify(options.shot)}
Scene: ${options.sceneInfo}
Characters: ${options.characterNames.join(', ')}
Visual Style: ${options.visualStyle}

Return JSON:
{
  "subShots": [
    {
      "actionSummary": "string",
      "cameraMovement": "string",
      "characters": ["string"]
    }
  ]
}`;
  const template = getEffectivePrompt('buildShotSplitPrompt', fallback);
  return applyTemplate(template, {
    ...options,
    shotJson: JSON.stringify(options.shot),
    characterNamesCsv: options.characterNames.join(', '),
  });
};

export const buildKeyframeOptimizationPrompt = (options: {
  frameType: 'start' | 'end';
  actionSummary: string;
  cameraMovement: string;
  sceneInfo: string;
  characterInfo: string;
  visualStyle: string;
}): string => {
  const fallback = `Optimize this keyframe prompt for ${options.frameType} frame:

Action: ${options.actionSummary}
Camera: ${options.cameraMovement}
Scene: ${options.sceneInfo}
Characters: ${options.characterInfo}
Visual Style: ${options.visualStyle}

Generate a detailed, cinematic prompt for image generation. Return only the prompt text.`;
  const template = getEffectivePrompt('buildKeyframeOptimizationPrompt', fallback);
  return applyTemplate(template, { ...options });
};

// ============================================
// Shot Service Prompts (Advanced)
// ============================================

export const buildOptimizeBothKeyframesPrompt = (
  sceneInfo: { location: string; time: string; atmosphere: string },
  actionSummary: string,
  cameraMovement: string,
  characterInfo: string[],
  visualStyle: string
): string => {
  const styleDesc = getStylePromptCN(visualStyle);
  const fallback = `
你是一位专业的电影视觉导演和概念艺术家。请为以下镜头同时创作起始帧和结束帧的详细视觉描述。

## 场景信息
**地点：** ${sceneInfo.location}
**时间：** ${sceneInfo.time}
**氛围：** ${sceneInfo.atmosphere}

## 叙事动作
${actionSummary}

## 镜头运动
${cameraMovement}

## 角色信息
${characterInfo.length > 0 ? characterInfo.join('、') : '无特定角色'}

## 视觉风格
${styleDesc}

## 任务要求

你需要为这个8-10秒的镜头创作**起始帧**和**结束帧**两个关键画面的视觉描述。

### 起始帧要求：
• 建立清晰的初始场景和人物状态
• 为即将发生的动作预留视觉空间和动势
• 设定光影和色调基调
• 展现角色的起始表情、姿态和位置
• 根据镜头运动（${cameraMovement}）设置合适的初始构图
• 营造场景氛围，让观众明确故事的起点

### 结束帧要求：
• 展现动作完成后的最终状态和结果
• 体现镜头运动（${cameraMovement}）带来的视角和构图变化
• 展现角色的情绪变化、最终姿态和位置
• 可以有戏剧性的光影和色彩变化
• 达到视觉高潮或情绪释放点
• 为下一个镜头的衔接做准备

### 两帧协调性：
⚠️ **关键**：起始帧和结束帧必须在视觉上连贯协调
- 保持一致的视觉风格和色调基础
- 镜头运动轨迹要清晰可推导
- 人物/物体的空间位置变化要合理
- 光影变化要有逻辑性
- 两帧描述应该能够自然串联成一个流畅的视觉叙事

### 每帧必须包含的视觉元素：

**1. 构图与景别**
- 根据镜头运动确定画面框架和视角
- 主体在画面中的位置和大小
- 前景、中景、背景的层次关系

**2. 光影与色彩**
- 光源的方向、强度和色温
- 主光、辅光、轮廓光的配置
- 整体色调和色彩情绪（暖色/冷色）
- 阴影的长度和密度

**3. 角色细节**（如有）
- 面部表情和眼神方向
- 肢体姿态和重心分布
- 服装状态和细节
- 与环境的互动关系

**4. 环境细节**
- 场景的具体视觉元素
- 环境氛围（雾气、光束、粒子等）
- 背景的清晰度和景深效果
- 环境对叙事的支持

**5. 运动暗示**
- 动态模糊或静止清晰
- 运动方向的视觉引导
- 张力和动势的体现

**6. 电影感细节**
- 画面质感和材质
- 大气透视效果
- 电影级的视觉特征

## 输出格式

请按以下JSON格式输出（注意：描述文本用中文，每个约100-150字）：

\`\`\`json
{
  "startFrame": "起始帧的详细视觉描述...",
  "endFrame": "结束帧的详细视觉描述..."
}
\`\`\`

❌ 避免：
- 不要在描述中包含"Visual Style:"等标签
- 不要分段或使用项目符号
- 不要过于技术化的术语
- 不要描述整个动作过程，只描述画面本身

✅ 追求：
- 流畅的单段描述
- 富有画面感的语言
- 两帧描述相互呼应、逻辑连贯
- 与叙事动作和镜头运动协调一致
- 具体、可视觉化的细节

请开始创作：
`;
  const template = getEffectivePrompt('buildOptimizeBothKeyframesPrompt', fallback);
  return applyTemplate(template, {
    sceneInfo,
    actionSummary,
    cameraMovement,
    characterInfo,
    characterInfoJoined: characterInfo.length > 0 ? characterInfo.join('、') : '',
    visualStyle,
    styleDesc,
  });
};

export const buildDetailedKeyframeOptimizationPrompt = (
  frameType: 'start' | 'end',
  actionSummary: string,
  cameraMovement: string,
  sceneInfo: { location: string; time: string; atmosphere: string },
  characterInfo: string[],
  visualStyle: string
): string => {
  const frameLabel = frameType === 'start' ? '起始帧' : '结束帧';
  const frameFocus = frameType === 'start'
    ? '初始状态、起始姿态、预备动作、场景建立'
    : '最终状态、结束姿态、动作完成、情绪高潮';

  const styleDesc = getStylePromptCN(visualStyle);

  const fallback = `
你是一位专业的电影视觉导演和概念艺术家。请为以下镜头的${frameLabel}创作详细的视觉描述。

## 场景信息
**地点：** ${sceneInfo.location}
**时间：** ${sceneInfo.time}
**氛围：** ${sceneInfo.atmosphere}

## 叙事动作
${actionSummary}

## 镜头运动
${cameraMovement}

## 角色信息
${characterInfo.length > 0 ? characterInfo.join('、') : '无特定角色'}

## 视觉风格
${styleDesc}

## 任务要求

作为${frameLabel}，你需要重点描述：**${frameFocus}**

### ${frameType === 'start' ? '起始帧' : '结束帧'}特殊要求：
${frameType === 'start' ? `
• 建立清晰的初始场景和人物状态
• 为即将发生的动作预留视觉空间和动势
• 设定光影和色调基调
• 展现角色的起始表情、姿态和位置
• 根据镜头运动（${cameraMovement}）设置合适的初始构图
• 营造场景氛围，让观众明确故事的起点
` : `
• 展现动作完成后的最终状态和结果
• 体现镜头运动（${cameraMovement}）带来的视角和构图变化
• 展现角色的情绪变化、最终姿态和位置
• 可以有戏剧性的光影和色彩变化
• 达到视觉高潮或情绪释放点
• 为下一个镜头的衔接做准备
`}

### 必须包含的视觉元素：

**1. 构图与景别**
- 根据镜头运动确定画面框架和视角
- 主体在画面中的位置和大小
- 前景、中景、背景的层次关系

**2. 光影与色彩**
- 光源的方向、强度和色温
- 主光、辅光、轮廓光的配置
- 整体色调和色彩情绪（暖色/冷色）
- 阴影的长度和密度

**3. 角色细节**（如有）
- 面部表情和眼神方向
- 肢体姿态和重心分布
- 服装状态和细节
- 与环境的互动关系

**4. 环境细节**
- 场景的具体视觉元素
- 环境氛围（雾气、光束、粒子等）
- 背景的清晰度和景深效果
- 环境对叙事的支持

**5. 运动暗示**
- 动态模糊或静止清晰
- 运动方向的视觉引导
- 张力和动势的体现

**6. 电影感细节**
- 画面质感和材质
- 大气透视效果
- 电影级的视觉特征

## 输出格式

请直接输出简洁但详细的视觉描述，约100-150字，用中文。

❌ 避免：
- 不要包含"Visual Style:"等标签
- 不要分段或使用项目符号
- 不要过于技术化的术语
- 不要描述整个动作过程，只描述这一帧的画面

✅ 追求：
- 流畅的单段描述
- 富有画面感的语言
- 突出${frameLabel}的特点
- 与叙事动作和镜头运动协调一致
- 具体、可视觉化的细节

请开始创作这一帧的视觉描述：
`;
  const template = getEffectivePrompt('buildDetailedKeyframeOptimizationPrompt', fallback);
  return applyTemplate(template, {
    frameType,
    frameLabel,
    frameFocus,
    actionSummary,
    cameraMovement,
    sceneInfo,
    characterInfo,
    characterInfoJoined: characterInfo.length > 0 ? characterInfo.join('、') : '',
    visualStyle,
    styleDesc,
  });
};

export const buildDetailedActionSuggestionPrompt = (
  startFramePrompt: string,
  endFramePrompt: string,
  cameraMovement: string
): string => {
  const actionReferenceExamples = `
## 高质量动作提示词参考示例

### 特效魔法戏示例
与男生飞在空中，随着抬起手臂，镜头迅速拉远到大远景，天空不断劈下密密麻麻的闪电，男生的机甲化作蓝光，形成一个压迫感拉满，巨大的魔法冲向镜头，震撼感和压迫感拉满。要求电影级运镜，有多个镜头的转换，内容动作符合要求，运镜要有大片的既视感，动作炫酷且合理，迅速且富有张力。

### 打斗戏示例
面具人和白发男生赤手空拳展开肉搏，他们会使用魔法。要求拥有李小龙、成龙级别的打斗动作。要求电影级运镜，有多个镜头的转换，内容动作符合要求，运镜要有大片的既视感，动作炫酷且合理，迅速且富有张力。

### 蓄力攻击示例
机甲蓄力，朝天空猛开几炮，震撼感和压迫感拉满。要求电影级运镜，有多个镜头的转换，内容动作符合要求，运镜要有大片的既视感，动作炫酷且合理，迅速且富有张力。

### 魔法展开示例
男生脚下的地面突然剧烈震动，一根根粗壮的石刺破土而出如同怪兽的獠牙，压迫感拉满，疯狂地朝他刺来(给石刺特写)！男生快速跃起，同时双手在胸前合拢。眼睛散发出蓝色的魔法光芒，大喊：领域展开·无尽冰原！嗡！一股肉眼可见的蓝色波纹瞬间扩散开来，所过之处，无论是地面、墙壁全都被一层厚厚的坚冰覆盖！整个仓库还是废弃的集装箱，瞬间变成了一片光滑的溜冰场！石刺也被冻住。要求电影级运镜，有多个镜头的转换，内容动作符合要求，运镜要有大片的既视感，动作炫酷且合理，迅速且富有张力。

### 快速移动示例
镜头1：天台左侧中景，郑一剑初始站立，背后是夜色笼罩下灯火闪烁的城市，圆月高悬。他保持着一种蓄势待发的静态站立姿态，周身氛围沉静。
镜头2：郑一剑消失："模糊拖影"特效与空气扰动，画面瞬间触发"模糊拖影"特效，身影如被快速拉扯的幻影般，以极快的速度淡化、消失，原地只残留极其轻微的空气扰动波纹。
镜头3：镜头急速移至曲飞面前，从郑一剑消失的位置，以迅猛的速度横向移动，画面里天台的栏杆、地面等景物飞速掠过，产生强烈的动态模糊效果。最终镜头定格在曲飞面前，脸上露出明显的惊讶与警惕。
镜头4：郑一剑突然出现准备出拳，毫无征兆地出现在画面中央，身体大幅度前倾，呈现出极具张力的准备出拳姿势，右手紧紧握拳，带起的劲风使得衣角大幅度向后飘动。

### 能量爆发示例
镜头在倾盆大雨中快速抖动向前推进，对准在黑暗海平面中屹立不动的黑影。几道闪电快速划过，轮廓在雨幕中若隐若现。突然，一股巨大的雷暴能量在他身后快速汇聚，光芒猛烈爆发。镜头立刻快速向地面猛冲，并同时向上极度仰起，锁定他被能量光芒完全照亮的、张开双臂的威严姿态。
`;

  const fallback = `
你是一位专业的电影动作导演和叙事顾问。请根据提供的首帧和尾帧信息，结合镜头运动，设计一个既符合叙事逻辑又充满视觉冲击力的动作场景。

## 重要约束
⏱️ **时长限制**：这是一个8-10秒的单镜头场景，请严格控制动作复杂度
📹 **镜头要求**：这是一个连续镜头，不要设计多个镜头切换（除非绝对必要，最多2-3个快速切换）

## 输入信息
**首帧描述：** ${startFramePrompt}
**尾帧描述：** ${endFramePrompt}
**镜头运动：** ${cameraMovement}

${actionReferenceExamples}

## 任务要求
1. **时长适配**：动作设计必须在8-10秒内完成，避免过于复杂的多步骤动作
2. **单镜头思维**：优先设计一个连贯的镜头内动作，而非多镜头组合
3. **自然衔接**：动作需要自然地从首帧过渡到尾帧，确保逻辑合理
4. **风格借鉴**：参考上述示例的风格和语言，但要简化步骤：
   - 富有张力但简洁的描述语言
   - 强调关键的视觉冲击点
   - 电影级的运镜描述但避免过度分解
5. **创新适配**：不要重复已有提示词，结合当前场景创新
6. **镜头语言**：根据提供的镜头运动（${cameraMovement}），设计相应的运镜方案

## 输出格式
请直接输出动作描述文本，无需JSON格式或额外标记。内容应包含：
- 简洁的单镜头动作场景描述（不要"镜头1、镜头2..."的分段，除非场景确实需要快速切换）
- 关键的运镜说明（推拉摇移等）
- 核心的视觉特效或情感氛围
- 确保描述具有电影感但控制篇幅

❌ 避免：过多的镜头切换、冗长的分步描述、超过10秒的复杂动作序列
✅ 追求：精炼、有冲击力、符合8-10秒时长的单镜头动作

请开始创作：
`;
  const template = getEffectivePrompt('buildDetailedActionSuggestionPrompt', fallback);
  return applyTemplate(template, { startFramePrompt, endFramePrompt, cameraMovement, actionReferenceExamples });
};

export const buildDetailedShotSplitPrompt = (
  shot: any,
  sceneInfo: { location: string; time: string; atmosphere: string },
  characterNames: string[],
  visualStyle: string
): string => {
  const styleDesc = getStylePromptCN(visualStyle);

  const fallback = `
你是一位专业的电影分镜师和导演。你的任务是将一个粗略的镜头描述，拆分为多个细致、专业的子镜头。

## 原始镜头信息

**场景地点：** ${sceneInfo.location}
**场景时间：** ${sceneInfo.time}
**场景氛围：** ${sceneInfo.atmosphere}
**角色：** ${characterNames.length > 0 ? characterNames.join('、') : '无特定角色'}
**视觉风格：** ${styleDesc}
**原始镜头运动：** ${shot.cameraMovement || '未指定'}

**原始动作描述：**
${shot.actionSummary}

${shot.dialogue ? `**对白：** "${shot.dialogue}"

⚠️ **对白处理说明**：原始镜头包含对白。请在拆分时，将对白放在最合适的子镜头中（通常是角色说话的中景或近景镜头），并在该子镜头的actionSummary中明确提及对白内容。其他子镜头不需要包含对白。` : ''}

## 拆分要求

### 核心原则
1. **单一职责**：每个子镜头只负责一个视角或动作细节，避免混合多个视角
2. **时长控制**：每个子镜头时长约2-4秒，总时长保持在8-10秒左右
3. **景别多样化**：合理运用全景、中景、特写等不同景别
4. **连贯性**：子镜头之间要有逻辑的视觉过渡和叙事连贯性

### 拆分维度示例

**景别分类（Shot Size）：**
- **远景 Long Shot / 全景 Wide Shot**：展示整体环境、人物位置关系、空间布局
- **中景 Medium Shot**：展示人物上半身或腰部以上，强调动作和表情
- **近景 Close-up**：展示人物头部或重要物体，强调情感和细节
- **特写 Extreme Close-up**：聚焦关键细节（如手部动作、眼神、物体特写）

### 必须包含的字段

每个子镜头必须包含以下信息：

1. **shotSize**（景别）：明确标注景别类型
2. **cameraMovement**（镜头运动）：描述镜头如何移动
3. **actionSummary**（动作描述）：清晰、具体的动作和画面内容描述（60-100字）
4. **visualFocus**（视觉焦点）：这个镜头的视觉重点
5. **keyframes**（关键帧数组）：包含起始帧(start)和结束帧(end)的视觉描述
6. **audioEffects**（音效/BGM）：该子镜头的关键音效或背景音乐提示

### 专业镜头运动参考
- 静止镜头 Static Shot
- 推镜头 Dolly Shot / 拉镜头 Zoom Out
- 跟踪镜头 Tracking Shot
- 平移镜头 Pan Shot
- 环绕镜头 Circular Shot
- 俯视镜头 High Angle / 仰视镜头 Low Angle
- 主观视角 POV Shot
- 越肩镜头 Over the Shoulder

## 输出格式

请输出JSON格式，结构如下：

\`\`\`json
{
  "subShots": [
    {
      "shotSize": "全景 Wide Shot",
      "cameraMovement": "静止镜头 Static Shot",
      "actionSummary": "动作描述...",
      "visualFocus": "视觉焦点描述",
      "audioEffects": "音效描述...",
      "keyframes": [
        {
          "type": "start",
          "visualPrompt": "起始帧视觉描述，${styleDesc}，100-150字..."
        },
        {
          "type": "end",
          "visualPrompt": "结束帧视觉描述，${styleDesc}，100-150字..."
        }
      ]
    }
  ]
}
\`\`\`

**关键帧visualPrompt要求**：
- 必须包含视觉风格标记（${styleDesc}）
- 详细描述画面构图、光影、色彩、景深等视觉元素
- 起始帧和结束帧要有明显的视觉差异
- 长度控制在100-150字

## 重要提示

❌ **避免：**
- 不要在单个子镜头中混合多个视角或景别
- 不要拆分过细导致总时长超过10秒
- 不要忽略视觉连贯性

✅ **追求：**
- 每个子镜头职责清晰、画面感强
- 景别和视角多样化但符合叙事逻辑
- 保持电影级的专业表达

请开始拆分，直接输出JSON格式（不要包含markdown代码块标记）：
`;
  const template = getEffectivePrompt('buildDetailedShotSplitPrompt', fallback);
  return applyTemplate(template, {
    shot,
    shotJson: JSON.stringify(shot),
    sceneInfo,
    characterNames,
    characterNamesJoined: characterNames.length > 0 ? characterNames.join('、') : '',
    visualStyle,
    styleDesc,
  });
};

export const buildKeyframeEnhancementPrompt = (
  basePrompt: string,
  visualStyle: string,
  cameraMovement: string,
  frameType: 'start' | 'end'
): string => {
  const styleDesc = getStylePromptCN(visualStyle);
  const frameLabel = frameType === 'start' ? '起始帧' : '结束帧';

  const fallback = `
你是一位资深的电影摄影指导和视觉特效专家。请基于以下基础提示词,生成一个包含详细技术规格和视觉细节的专业级${frameLabel}描述。

## 基础提示词
${basePrompt}

## 视觉风格
${styleDesc}

## 镜头运动
${cameraMovement}

## ${frameLabel}要求
${frameType === 'start' ? '建立清晰的初始状态、起始姿态、为后续运动预留空间' : '展现最终状态、动作完成、情绪高潮'}

## 任务
请在基础提示词的基础上,添加以下专业的电影级视觉规格描述:

### 1. 技术规格 (Technical Specifications)
- 分辨率规格 (8K等)
- 镜头语言和摄影美学
- 景深控制和焦点策略

### 2. 视觉细节 (Visual Details)  
- 光影层次: 三点布光、阴影与高光的配置
- 色彩饱和度: 色彩分级、色温控制
- 材质质感: 表面纹理、细节丰富度
- 大气效果: 体积光、雾气、粒子、天气效果

### 3. 角色要求 (Character Details) - 如果有角色
⚠️ 最高优先级: 如果提供了角色参考图,必须严格保持人物外观的完全一致性!
- 面部表情: 在保持外观一致的基础上,添加微表情、情绪真实度、眼神方向
- 肢体语言: 在保持体型一致的基础上,展现自然的身体姿态、重心分布、肌肉张力
- 服装细节: 服装的运动感、物理真实性、纹理细节
- 毛发细节: 头发丝、自然的毛发运动

### 4. 环境要求 (Environment Details)
- 背景层次: 前景、中景、背景的深度分离
- 空间透视: 准确的线性透视、大气透视
- 环境光影: 光源的真实性、阴影投射
- 细节丰富度: 环境叙事元素、纹理变化

### 5. 氛围营造 (Mood & Atmosphere)
- 情绪基调与场景情感的匹配
- 色彩心理学的运用
- 视觉节奏的平衡
- 叙事的视觉暗示

### 6. 质量保证 (Quality Assurance)
- 主体清晰度和轮廓
- 背景过渡的自然性
- 光影一致性
- 色彩协调性
- 构图平衡(三分法或黄金比例)
- 动作连贯性

## 输出格式
请使用清晰的分节格式输出,包含上述所有要素。使用中文输出,保持专业性和可读性。

格式示例:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【技术规格】Technical Specifications
• 分辨率: ...

【视觉细节】Visual Details  
• 光影层次: ...
• 色彩饱和度: ...

(依次类推)

请开始创作:
`;
  const template = getEffectivePrompt('buildKeyframeEnhancementPrompt', fallback);
  return applyTemplate(template, { basePrompt, visualStyle, cameraMovement, frameType, frameLabel, styleDesc });
};

export const buildNineGridPanelsPrompt = (
  actionSummary: string,
  cameraMovement: string,
  sceneInfo: { location: string; time: string; atmosphere: string },
  characterNames: string[],
  visualStyle: string
): string => {
  const systemPrompt = `你是一位专业的电影分镜师和摄影指导。你的任务是将一个镜头动作拆解为9个不同的摄影视角，用于九宫格分镜预览。
每个视角必须展示相同场景的不同景别和机位角度组合，确保覆盖从远景到特写、从俯拍到仰拍的多样化视角。`;

  const userPrompt = `请将以下镜头动作拆解为9个不同的摄影视角，用于生成一张3x3九宫格分镜图。

【镜头动作】${actionSummary}
【原始镜头运动】${cameraMovement}
【场景信息】地点: ${sceneInfo.location}, 时间: ${sceneInfo.time}, 氛围: ${sceneInfo.atmosphere}
【角色】${characterNames.length > 0 ? characterNames.join('、') : '无特定角色'}
【视觉风格】${visualStyle}

请按照以下要求返回JSON格式数据：
1. 9个视角必须覆盖不同的景别和角度组合，避免重复
2. 建议覆盖：建立镜头(远/全景)、人物交互(中景)、情绪表达(近景/特写)、氛围细节(各种角度)
3. 每个视角的description必须包含具体的画面内容描述（角色位置、动作、表情、环境细节等）
4. description使用英文撰写，但可以包含场景和角色的中文名称

请严格按照以下JSON格式输出，不要包含其他文字：
{
  "panels": [
    {
      "index": 0,
      "shotSize": "远景",
      "cameraAngle": "俯拍",
      "description": "Establishing aerial shot showing..."
    },
    {
      "index": 1,
      "shotSize": "中景",
      "cameraAngle": "平视",
      "description": "Medium shot at eye level..."
    }
  ]
}

注意：必须恰好返回9个panel（index 0-8），按照九宫格从左到右、从上到下的顺序排列。`;

  const fallback = `${systemPrompt}\n\n${userPrompt}`;
  const template = getEffectivePrompt('buildNineGridPanelsPrompt', fallback);
  return applyTemplate(template, {
    actionSummary,
    cameraMovement,
    sceneInfo,
    characterNames,
    characterNamesJoined: characterNames.length > 0 ? characterNames.join('、') : '',
    visualStyle,
    systemPrompt,
    userPrompt,
  });
};

export const buildNineGridImagePrompt = (
  panelDescriptions: string,
  visualStyle: string
): string => {
  const stylePrompt = getStylePrompt(visualStyle);
  
  const fallback = `Generate a SINGLE image composed as a cinematic storyboard with a 3x3 grid layout (9 equal panels).
The image shows the SAME scene from 9 DIFFERENT camera angles and shot sizes.
Each panel is separated by thin white borders.

Visual Style: ${stylePrompt}

Grid Layout (left to right, top to bottom):
${panelDescriptions}

CRITICAL REQUIREMENTS:
- The output MUST be a SINGLE image divided into exactly 9 equal rectangular panels in a 3x3 grid layout
- Each panel MUST have a thin white border/separator (2-3px) between panels
- All 9 panels show the SAME scene from DIFFERENT camera angles and shot sizes
- Maintain STRICT character consistency across ALL panels (same face, hair, clothing, body proportions)
- Maintain consistent lighting, color palette, and atmosphere across all panels
- Each panel should be a complete, well-composed frame suitable for use as a keyframe
- The overall image should read as a professional cinematographer's shot planning board`;
  const template = getEffectivePrompt('buildNineGridImagePrompt', fallback);
  return applyTemplate(template, { panelDescriptions, visualStyle, stylePrompt });
};

// ============================================
// Script Service Prompts
// ============================================

export const buildScriptParsingPrompt = (rawText: string, language: string): string => {
  const fallback = `You are a professional screenwriter assistant. Parse the following script/story into structured data.

Script Text:
${rawText}

Requirements:
- Language: ${language}
- Extract: title, genre, logline, characters (with name, gender, age, personality), scenes (with location, time, atmosphere)
- Generate story paragraphs with scene references

Return a valid JSON object with the structure:
{
  "title": "string",
  "genre": "string", 
  "logline": "string",
  "characters": [{"id": "string", "name": "string", "gender": "string", "age": "string", "personality": "string", "variations": []}],
  "scenes": [{"id": "string", "location": "string", "time": "string", "atmosphere": "string"}],
  "storyParagraphs": [{"id": number, "text": "string", "sceneRefId": "string"}]
}`;
  const template = getEffectivePrompt('buildScriptParsingPrompt', fallback);
  return applyTemplate(template, { rawText, language });
};

// ————————————————————————————————————————————————
// ✅ 这里是修改过的函数 (The Modified Function)
// ————————————————————————————————————————————————
export const buildShotListGenerationPrompt = (
  language: string,
  stylePrompt: string,
  visualStyle: string,
  artDirectionBlock: string,
  scene: any,
  index: number,
  paragraphs: string,
  scriptData: any,
  totalShotsNeeded: number,
  shotsPerScene: number
): string => {
  const fallback = `你是一名院线级电影的专业摄影指导（DP）、导演，同时也是顶级的 AI 影视制作专家。你擅长以极度细腻的“切片式”讲戏和剪辑思路拆解镜头，并能将传统的视听语言精准转化为 AI 绘画（文生图）和 AI 视频（图生视频）的生图提示词。 
 
 语言: ${language} 
 视觉风格/大模型基调: ${stylePrompt} 
 目标总镜头数: ${totalShotsNeeded} 
 本场景大约镜头数: ${shotsPerScene} 
 
 ${artDirectionBlock} 
 
 当前场景 (${index + 1}/${scriptData.scenes.length})： 
 地点: ${scene.location} 
 时间: ${scene.time} 
 氛围: ${scene.atmosphere} 
 
 本场景的故事段落： 
 ${paragraphs} 
 
 任务：将这个场景拆解为一个极度详细的、可直接用于 AI 影视工作流生成的镜头列表。为了保证剪辑的节奏感和丰富的视听语言，你需要尽可能细化镜头。 
 
 ⚠️ 镜头颗粒度与拆解法则（必须绝对遵守）： 
 1. 单机位/单景别 = 单镜头：只要相机角度、主体或景别发生任何微小变化，必须立刻在 JSON 数组中创建一个新镜头。 
 2. 极短时长限制：每个镜头只应表示 1–3 秒的屏幕时间，用密集的剪辑点建立电影感。 
 3. 强制包含覆盖镜头（Coverage）：绝对不能只用全景或双人镜头一到底。强制在合理节点插入：反应镜头（微表情）、插入特写（手部、关键道具、环境细节）、主观镜头 (POV)。 
 4. 动作的微观切片：严禁在一个镜头内交代一个完整的复杂动作。必须拆分（例：推门手部特写 -> 迈入房间中景 -> 视线环视全景）。 
 
 🤖 AI 生成逻辑法则（必须绝对遵守）： 
 1. aiImagePrompt (文生图逻辑): 提取当前镜头的视觉核心。公式为：主体描述 + 背景环境 + 景别 + 构图角度 + 光影氛围 + 材质细节 + ${stylePrompt}。使用短语和词组，而非长句。 
 2. aiVideoPrompt (图生视频逻辑): 专注于“画面中什么在动”。公式为：主体微小动作 + 物理环境动态（如风、烟雾、光影变化） + 运镜方向。严禁出现超出 3 秒的复杂连贯动作。 
 3. 画面一致性：相邻镜头的 aiImagePrompt 必须保持环境光影和角色特征的连贯。 
 
 返回一个有效的 JSON 对象，严格使用以下数据结构： 
 { 
   "shots": [ 
     { 
       "shotSize": "string", // 景别（例：Extreme Wide, Medium, Close-up, Macro） 
       "cameraMovement": "string", // 运镜（例：Static, Pan, Tilt, Dolly in, Handheld, Tracking） 
       "actionSummary": "string", // 镜头的视觉内容描述（传统分镜语言） 
       "aiImagePrompt": "string", // 文生图逻辑词组（主体+环境+光影+构图+风格） 
       "aiVideoPrompt": "string", // 图生视频动态词组（主体微动+环境动态+运镜） 
       "dialogue": "string", // 角色对白（如果没有则为空字符串） 
       "audioEffects": "string", // 关键音效或BGM提示（例：沉重的心跳声，风声呼啸） 
       "characters": ["character_id"], // 出现在该镜头中的角色ID列表 
       "notes": "string" // 导演备注（该镜头的情绪作用或剪辑点提示） 
     } 
   ] 
 }`;
  const template = getEffectivePrompt('buildShotListGenerationPrompt', fallback);
  return applyTemplate(template, {
    language,
    stylePrompt,
    visualStyle,
    artDirectionBlock,
    scene,
    index,
    paragraphs,
    scriptData,
    scriptDataJson: JSON.stringify(scriptData, null, 2),
    totalShotsNeeded,
    shotsPerScene,
  });
};

// ————————————————————————————————————————————————
// ✅ Stage 1: Skeleton Generation Prompt
// ————————————————————————————————————————————————
export const buildShotListSkeletonPrompt = (
  language: string,
  scene: any,
  index: number,
  paragraphs: string,
  scriptData: any,
  totalShotsNeeded: number,
  shotsPerScene: number
): string => {
  const characterList = Array.isArray(scriptData.characters) 
    ? scriptData.characters.map((c: any) => `- Name: ${c.name} (ID: ${c.id})`).join('\n')
    : '无角色信息';

  const fallback = `你是一名专业导演和剪辑师。你的任务是将当前场景拆解为一系列镜头（分镜表骨架），专注于叙事节奏、运镜和动作设计。

语言: ${language}
目标总镜头数: ${totalShotsNeeded}
本场景大约镜头数: ${shotsPerScene}

当前场景 (${index + 1}/${scriptData.scenes.length})：
地点: ${scene.location}
时间: ${scene.time}
氛围: ${scene.atmosphere}

本场景的故事段落：
${paragraphs}

可用角色列表 (请准确使用以下ID):
${characterList}

任务：将这个场景拆解为一个详细的镜头列表。
⚠️ 镜头拆解法则：
1. 单机位/单景别 = 单镜头：相机角度或景别变化必须创建新镜头。
2. 节奏感：每个镜头时长控制在 1-4 秒。
3. 覆盖镜头：必须包含全景、中景、特写、反应镜头等多种景别。
4. 动作切片：复杂动作必须拆分为多个镜头。

返回一个有效的 JSON 对象，严格使用以下数据结构（不要包含 AI 提示词）：
{
  "shots": [
    {
      "id": "number", // 镜头序号 (1, 2, 3...)
      "shotSize": "string", // 景别 (Extreme Wide, Medium, Close-up, Macro)
      "cameraMovement": "string", // 运镜 (Static, Pan, Tilt, Dolly, Handheld)
      "actionSummary": "string", // 镜头的视觉内容描述 (中文)
      "dialogue": "string", // 角色对白 (如果没有则为空)
      "audioEffects": "string", // 关键音效或BGM提示
      "characters": ["character_id"], // 出现在该镜头中的角色ID列表
      "notes": "string" // 导演备注
    }
  ]
}`;
  const template = getEffectivePrompt('buildShotListSkeletonPrompt', fallback);
  return applyTemplate(template, {
    language,
    scene,
    index,
    paragraphs,
    scriptData,
    scriptDataJson: JSON.stringify(scriptData, null, 2),
    totalShotsNeeded,
    shotsPerScene,
    characterList,
  });
};

// ————————————————————————————————————————————————
// ✅ Stage 1 (First Person Mode): Skeleton Generation Prompt
// ————————————————————————————————————————————————
export const buildFirstPersonShotListSkeletonPrompt = (
  language: string,
  scene: any,
  index: number,
  paragraphs: string,
  scriptData: any,
  totalShotsNeeded: number,
  shotsPerScene: number
): string => {
  const characterList = Array.isArray(scriptData.characters) 
    ? scriptData.characters.map((c: any) => `- Name: ${c.name} (ID: ${c.id})`).join('\n')
    : '无角色信息';

  const fallback = `你是一名顶级短视频解说类内容导演。你的任务是将当前场景拆解为一系列**极度密集、节奏极快**的镜头（分镜表骨架），专为第一人称解说/自述类视频设计。

语言: ${language}
目标总镜头数: ${Math.floor(totalShotsNeeded * 1.5)} (解说剧模式需要更多镜头)
本场景大约镜头数: ${Math.floor(shotsPerScene * 1.5)}

当前场景 (${index + 1}/${scriptData.scenes.length})：
地点: ${scene.location}
时间: ${scene.time}
氛围: ${scene.atmosphere}

本场景的故事段落：
${paragraphs}

可用角色列表:
${characterList}

任务：将这个场景拆解为一个详细的镜头列表。
⚠️ **解说剧模式特殊法则（必须严格执行）**：
1. **极速节奏**：每个镜头时长必须严格控制在 **0.5 - 2秒**。严禁出现超过3秒的长镜头。
2. **碎片化叙事**：将一个完整的动作或心理活动，拆解为 3-5 个微小的视觉碎片。例如：“喝咖啡”必须拆解为：(1)手拿杯子特写 -> (2)嘴唇接触杯沿特写 -> (3)喉结滚动特写 -> (4)放下杯子声音特写 -> (5)满足的表情中景。
3. **视觉冲击力**：大量使用**特写(Close-up)**和**微距(Macro)**镜头，强调细节质感和情绪张力。
4. **主观视角**：多使用第一人称视角(POV)和心理投射画面，让观众产生强烈的代入感。
5. **画面跳跃**：镜头之间的连接可以是跳跃的、非线性的，注重情绪流动的连贯而非物理空间的连续。
6. **空镜与意象**：穿插 20% 的空镜头或意象镜头（如：飘落的叶子、破碎的玻璃、流动的光影）来配合解说词的节奏和意境。
7. **音效强化**：为每个镜头设计关键音效（如：心跳声、快门声、风声）或 BGM 情绪点，以增强短视频的沉浸感。

返回一个有效的 JSON 对象，严格使用以下数据结构：
{
  "shots": [
    {
      "id": "number", // 镜头序号
      "shotSize": "string", // 景别 (Macro, Extreme Close-up, Close-up, Medium, POV) - 偏向特写和微距
      "cameraMovement": "string", // 运镜 (Handheld, Whip Pan, Crash Zoom, Static) - 偏向动态和不稳定感
      "actionSummary": "string", // 镜头的视觉内容描述 (中文，极度具体，强调细节)
      "dialogue": "string", // 角色对白/解说词
      "audioEffects": "string", // 关键音效或BGM提示
      "characters": ["character_id"], // 角色ID列表
      "notes": "string" // 导演备注 (例如：卡点重音，画面闪白等)
    }
  ]
}`;
  const template = getEffectivePrompt('buildFirstPersonShotListSkeletonPrompt', fallback);
  return applyTemplate(template, {
    language,
    scene,
    index,
    paragraphs,
    scriptData,
    scriptDataJson: JSON.stringify(scriptData, null, 2),
    totalShotsNeeded,
    shotsPerScene,
    characterList,
  });
};


// ————————————————————————————————————————————————
// ✅ Stage 2: Visual Details Prompt
// ————————————————————————————————————————————————
export const buildShotVisualDetailsPrompt = (
  language: string,
  stylePrompt: string,
  visualStyle: string,
  artDirectionBlock: string,
  shots: any[]
): string => {
  const fallback = `你是一名顶级 AI 视觉导演。你的任务是为以下分镜列表生成极度细腻的 AI 视频提示词。

语言: ${language}
视觉风格: ${visualStyle}
大模型基调: ${stylePrompt}

${artDirectionBlock}

待处理的镜头列表：
${JSON.stringify(shots, null, 2)}

任务：为每个镜头生成 aiVideoPrompt。

⚠️ AI 生成逻辑法则：
1. aiVideoPrompt (图生视频): 专注于“画面中什么在动”。公式：主体微小动作 + 物理环境动态（风、光、烟） + 运镜方向。
2. 画面一致性：确保相邻镜头的环境和光影连贯。

返回一个有效的 JSON 对象，包含对应镜头的视觉详情：
{
  "details": [
    {
      "id": "number", // 对应输入的镜头序号
      "aiVideoPrompt": "string" // 视频生成提示词
    }
  ]
}`;
  const template = getEffectivePrompt('buildShotVisualDetailsPrompt', fallback);
  return applyTemplate(template, {
    language,
    stylePrompt,
    visualStyle,
    artDirectionBlock,
    shots,
  });
};
// ————————————————————————————————————————————————
// ✅ 修改结束 
// ————————————————————————————————————————————————

export const buildScriptContinuationPrompt = (existingScript: string, language: string): string => {
  const fallback = `你是一位资深剧本创作者。请在充分理解下方已有剧本内容的基础上，续写后续情节。

续写要求：
1. 严格保持原剧本的风格、语气、人物性格和叙事节奏，确保无明显风格断层。
2. 情节发展需自然流畅，逻辑严密，因果关系合理，避免突兀转折。
3. 有效增加戏剧冲突和情感张力，使故事更具吸引力和张力。
4. 续写内容应为原有剧本长度的30%-50%，字数适中，避免过短或过长。
5. 保持剧本的原有格式，包括场景描述、人物对白、舞台指示等，确保格式一致。
6. 输出语言为：${language}，用词准确、表达流畅。
7. 仅输出续写剧本内容，不添加任何说明、前缀或后缀。

已有剧本内容：
${existingScript}

请直接续写剧本内容。（不要包含"续写："等前缀）：`;
  const template = getEffectivePrompt('buildScriptContinuationPrompt', fallback);
  return applyTemplate(template, { existingScript, language });
};

export const buildScriptRewritePrompt = (originalScript: string, language: string): string => {
  const fallback = `你是一位顶级剧本编剧顾问，擅长提升剧本的结构、情感和戏剧张力。请对下方提供的剧本进行系统性、创造性改写，目标是使剧本在连贯性、流畅性和戏剧冲突等方面显著提升。

改写具体要求如下：

1. 保留原剧本的核心故事线和主要人物设定，不改变故事主旨。
2. 优化情节结构，确保事件发展具有清晰的因果关系，逻辑严密。
3. 增强场景之间的衔接与转换，使整体叙事流畅自然。
4. 丰富和提升人物对话，使其更具个性、情感色彩和真实感，避免生硬或刻板。
5. 强化戏剧冲突，突出人物之间的矛盾与情感张力，增加情节的吸引力和感染力。
6. 深化人物内心活动和情感描写，提升剧本的情感深度。
7. 优化整体节奏，合理分配高潮与缓和段落，避免情节拖沓或推进过快。
8. 保持或适度增加剧本内容长度，确保内容充实但不过度冗长。
9. 严格遵循剧本格式规范，包括场景标注、人物台词、舞台指示等。
10. 输出语言为：${language}，确保语言风格与剧本类型相符。

原始剧本内容如下：
${originalScript}

请根据以上要求，输出经过全面改写、结构优化、情感丰富的完整剧本文本。`;
  const template = getEffectivePrompt('buildScriptRewritePrompt', fallback);
  return applyTemplate(template, { originalScript, language });
};

// ============================================
// Visual Service Prompts (Advanced)
// ============================================

export const buildArtDirectionPrompt = (
  title: string,
  genre: string,
  logline: string,
  characters: { name: string; gender: string; age: string; personality: string }[],
  scenes: { location: string; time: string; atmosphere: string }[],
  visualStyle: string,
  stylePrompt: string,
  language: string
): string => {
  const fallback = `You are a world-class Art Director and Concept Artist for film and animation.
Your task is to create a comprehensive ART DIRECTION BRIEF for a new project.
This brief will serve as the "bible" for all subsequent visual generation (characters, scenes, props), ensuring a cohesive and unique visual identity.

Project Information:
- Title: ${title}
- Genre: ${genre}
- Logline: ${logline}
- Visual Style: ${visualStyle} (${stylePrompt})
- Language for Output: English (for technical visual descriptions) but you can use ${language} for explanations if needed.

Key Characters:
${characters.map(c => `- ${c.name} (${c.gender}, ${c.age}): ${c.personality}`).join('\n')}

Key Scenes:
${scenes.map(s => `- ${s.location} (${s.time}): ${s.atmosphere}`).join('\n')}

Your goal is to define a specific, consistent visual language that elevates the story.

Output a valid JSON object with the following structure:
{
  "colorPalette": {
    "primary": "Main dominant color (hex or name)",
    "secondary": "Secondary supporting color",
    "accent": "Highlight/Accent color for key elements",
    "skinTones": "General direction for character skin tones",
    "saturation": "Low/Medium/High/Vibrant/Muted",
    "temperature": "Warm/Cool/Neutral"
  },
  "characterDesignRules": {
    "proportions": "Realistic/Stylized/Chibi/etc.",
    "eyeStyle": "Description of eye rendering style",
    "lineWeight": "Thick/Thin/Variable/None (for painting styles)",
    "detailLevel": "High/Medium/Low/Minimalist"
  },
  "lightingStyle": "Description of lighting strategy (e.g., Chiaroscuro, Flat, High-key)",
  "textureStyle": "Description of surface qualities (e.g., Rough, Glossy, Painted)",
  "moodKeywords": ["Keyword1", "Keyword2", "Keyword3", "Keyword4", "Keyword5"],
  "consistencyAnchors": "A concise paragraph (50-80 words) summarizing the visual rules to be pasted into every future prompt to ensure consistency."
}`;
  const template = getEffectivePrompt('buildArtDirectionPrompt', fallback);
  return applyTemplate(template, { title, genre, logline, characters, scenes, visualStyle, stylePrompt, language });
};

export const buildBatchCharacterPrompt = (
  visualStyle: string,
  characters: any[],
  artDirection: any,
  genre: string,
  stylePrompt: string,
  language: string,
  characterList: string
): string => {
  const artDirectionBlock = artDirection ? `
## GLOBAL ART DIRECTION (MANDATORY)
${artDirection.consistencyAnchors}
Color Palette: Primary=${artDirection.colorPalette.primary}, Accent=${artDirection.colorPalette.accent}
Design Rules: ${artDirection.characterDesignRules.proportions}, ${artDirection.characterDesignRules.lineWeight}
` : '';

  const fallback = `You are a Lead Character Designer.
Task: Create detailed visual prompts for the following characters.

Visual Style: ${visualStyle} (${stylePrompt})
Genre: ${genre}
${artDirectionBlock}

Characters to Design:
${characterList}

For EACH character, write a detailed visual prompt for image generation.
Requirements for each prompt:
1. Start with specific physical appearance (face, hair, body).
2. Describe the outfit/costume in detail, matching the genre and personality.
3. Include specific accessories or props.
4. Ensure the style matches the Global Art Direction.
5. Use English for the prompt text.

Output a valid JSON object with a "characters" array, where each item matches the input order:
{
  "characters": [
    {
      "name": "Character Name",
      "visualPrompt": "Full detailed visual description string..."
    }
  ]
}`;
  const template = getEffectivePrompt('buildBatchCharacterPrompt', fallback);
  return applyTemplate(template, { visualStyle, characters, artDirection, genre, stylePrompt, language, characterList, artDirectionBlock });
};

export const buildCharacterPrompt = (
  visualStyle: string,
  artDirectionBlock: string,
  char: any,
  language: string,
  genre: string,
  stylePrompt: string,
  artDirection?: any
): string => {
  const fallback = `Generate a detailed visual prompt for this character:
Name: ${char.name}
Gender: ${char.gender}
Age: ${char.age}
Personality: ${char.personality}

Genre: ${genre}
Visual Style: ${visualStyle}
${stylePrompt}

${artDirectionBlock}

Requirements:
- Detailed description of facial features, hair, and body type.
- Specific clothing and accessories that reflect personality and genre.
- Pose and expression suggestions.
- Ensure strict adherence to the Art Direction (if provided).
- Output ONLY the prompt text in English.`;
  const template = getEffectivePrompt('buildCharacterPrompt', fallback);
  return applyTemplate(template, { visualStyle, artDirectionBlock, char, language, genre, stylePrompt, artDirection });
};

export const buildScenePrompt = (
  visualStyle: string,
  artDirectionBlock: string,
  scene: any,
  genre: string,
  language: string,
  stylePrompt: string,
  artDirection?: any
): string => {
  const fallback = `Generate a detailed visual prompt for this scene:
Location: ${scene.location}
Time: ${scene.time}
Atmosphere: ${scene.atmosphere}

Genre: ${genre}
Visual Style: ${visualStyle}
${stylePrompt}

${artDirectionBlock}

Requirements:
- Detailed description of the environment, architecture, and lighting.
- Specific details that establish the mood and atmosphere.
- Color palette and texture references from Art Direction.
- Composition suggestions (wide shot, angle, etc.).
- IMPORTANT: Keep the description concise and under 600 characters to ensure compatibility with image generation models.
- Output ONLY the prompt text in English.`;
  const template = getEffectivePrompt('buildScenePrompt', fallback);
  return applyTemplate(template, { visualStyle, artDirectionBlock, scene, genre, language, stylePrompt, artDirection });
};

export const buildOutfitVariationPrompt = (prompt: string): string => {
  const fallback = `
      ⚠️⚠️⚠️ CRITICAL REQUIREMENTS - CHARACTER OUTFIT VARIATION ⚠️⚠️⚠️
      
      Reference Images Information:
      - The provided image shows the CHARACTER's BASE APPEARANCE that you MUST use as reference for FACE ONLY.
      
      Task:
      Generate a character image with a NEW OUTFIT/COSTUME based on this description: "${prompt}".
      
      ⚠️ ABSOLUTE REQUIREMENTS (NON-NEGOTIABLE):
      
      1. FACE & IDENTITY - MUST BE 100% IDENTICAL TO REFERENCE:
         • Facial Features: Eyes (color, shape, size), nose structure, mouth shape, facial contours must be EXACTLY the same
         • Hairstyle & Hair Color: Length, color, texture, and style must be PERFECTLY matched (unless prompt specifies hair change)
         • Skin tone and facial structure: MUST remain identical
         • Expression can vary based on prompt
         
      2. OUTFIT/CLOTHING - MUST BE COMPLETELY DIFFERENT FROM REFERENCE:
         • Generate NEW clothing/outfit as described in the prompt
         • DO NOT copy the clothing from the reference image
         • The outfit should match the description provided: "${prompt}"
         • Include all accessories, props, or costume details mentioned in the prompt
         
      3. Body proportions should remain consistent with the reference.
      
      ⚠️ This is an OUTFIT VARIATION task - The face MUST match the reference, but the CLOTHES MUST be NEW as described!
      ⚠️ If the new outfit is not clearly visible and different from the reference, the task has FAILED!
    `;
  const template = getEffectivePrompt('buildOutfitVariationPrompt', fallback);
  return applyTemplate(template, { prompt });
};

export const buildConsistencyPrompt = (
  prompt: string,
  hasTurnaround: boolean
): string => {
  const turnaroundGuide = hasTurnaround ? `
      4. CHARACTER TURNAROUND SHEET - MULTI-ANGLE REFERENCE:
         Some character reference images are provided as a 3x3 TURNAROUND SHEET (9-panel grid showing the SAME character from different angles: front, side, back, 3/4 view, close-up, etc.).
         ⚠️ This turnaround sheet is your MOST IMPORTANT reference for character consistency!
         • Use the panel that best matches the CAMERA ANGLE of this shot (e.g., if the shot is from behind, refer to the back-view panel)
         • The character's face, hair, clothing, and body proportions must match ALL panels in the turnaround sheet
         • The turnaround sheet takes priority over single character reference images for angle-specific details
         ` : '';

  const fallback = `
      ⚠️⚠️⚠️ CRITICAL REQUIREMENTS - CHARACTER CONSISTENCY ⚠️⚠️⚠️
      
      Reference Images Information:
      - The FIRST image is the Scene/Environment reference.
      - Subsequent images are Character references (Base Look or Variation).${hasTurnaround ? '\n      - Some character images are 3x3 TURNAROUND SHEETS showing the character from 9 different angles (front, side, back, close-up, etc.).' : ''}
      - Any remaining images after characters are Prop/Item references (objects that must appear consistently).
      
      Task:
      Generate a cinematic shot matching this prompt: "${prompt}".
      
      ⚠️ ABSOLUTE REQUIREMENTS (NON-NEGOTIABLE):
      1. Scene Consistency:
         - STRICTLY maintain the visual style, lighting, and environment from the scene reference.
      
      2. Character Consistency - HIGHEST PRIORITY:
         If characters are present in the prompt, they MUST be IDENTICAL to the character reference images:
         • Facial Features: Eyes (color, shape, size), nose structure, mouth shape, facial contours must be EXACTLY the same
         • Hairstyle & Hair Color: Length, color, texture, and style must be PERFECTLY matched
         • Clothing & Outfit: Style, color, material, and accessories must be IDENTICAL
         • Body Type: Height, build, proportions must remain consistent
      
      3. Prop/Item Consistency:
         If prop reference images are provided, the objects/items in the shot MUST match the reference:
         • Shape & Form: The prop's shape, size, and proportions must be identical to the reference
         • Color & Material: Colors, textures, and materials must be consistent
         • Details: Patterns, text, decorations, and distinguishing features must match exactly
      ${turnaroundGuide}
      ⚠️ DO NOT create variations or interpretations of the character - STRICT REPLICATION ONLY!
      ⚠️ Character appearance consistency is THE MOST IMPORTANT requirement!
      ⚠️ Props/items must also maintain visual consistency with their reference images!
    `;
  const template = getEffectivePrompt('buildConsistencyPrompt', fallback);
  return applyTemplate(template, { prompt, hasTurnaround, turnaroundGuide });
};

export const buildThreeViewPrompt = (options: {
  character: any;
  visualStyle: string;
  language?: string;
}): string => {
  const fallback = `角色设计表，三视图（正面，侧面，背面），全身人像，九头身完美比例。左侧排列高清特写大头照。`;
  const template = getEffectivePrompt('buildThreeViewPrompt', fallback);
  return applyTemplate(template, options as any).trim();
};

export const buildTurnaroundPanelPrompt = (
  visualStyle: string,
  stylePrompt: string,
  artDirectionBlock: string,
  character: any
): string => {
  const fallback = `You are an expert character designer and Art Director for ${visualStyle} productions.
Your task is to create a CHARACTER TURNAROUND SHEET - a 3x3 grid (9 panels) showing the SAME character from 9 different angles and distances.

This is for maintaining character consistency across multiple shots in video production.

${artDirectionBlock}
## Character Information
- Name: ${character.name}
- Gender: ${character.gender}
- Age: ${character.age}
- Personality: ${character.personality}
- Visual Description: ${character.visualPrompt || 'Not specified'}

## Visual Style: ${visualStyle} (${stylePrompt})

## REQUIRED 9 PANELS LAYOUT:
Panel 0 (Top-Left): 正面/全身 - Front view, full body
Panel 1 (Top-Center): 正面/半身特写 - Front view, upper body close-up
Panel 2 (Top-Right): 正面/面部特写 - Front view, face close-up
Panel 3 (Middle-Left): 左侧面/全身 - Left profile, full body
Panel 4 (Middle-Center): 右侧面/全身 - Right profile, full body
Panel 5 (Middle-Right): 3/4侧面/半身 - Three-quarter view, upper body
Panel 6 (Bottom-Left): 背面/全身 - Back view, full body
Panel 7 (Bottom-Center): 仰视/半身 - Low angle looking up, upper body
Panel 8 (Bottom-Right): 俯视/半身 - High angle looking down, upper body

## YOUR TASK:
For each of the 9 panels, write a detailed visual description of the character from that specific angle.

CRITICAL RULES:
- The character's appearance (face, hair, clothing, accessories, body proportions) MUST be EXACTLY the same across ALL 9 panels
- Each description MUST specify the exact viewing angle and distance
- Include specific details about what is visible from that angle (e.g., back of hairstyle, side profile of face, clothing details visible from that angle)
- Descriptions should be written in a way that helps image generation AI render the character consistently
- Each description should be 30-50 words, written in English, as direct image generation prompts
- Include character pose and expression appropriate for a neutral/characteristic reference sheet pose
- Include the ${visualStyle} style keywords in each description

Output ONLY valid JSON:
{
  "panels": [
    {
      "index": 0,
      "viewAngle": "正面",
      "shotSize": "全身",
      "description": "Front full-body view of [character], standing in a neutral pose..."
    }
  ]
}

The "panels" array MUST have exactly 9 items (index 0-8).`;
  const template = getEffectivePrompt('buildTurnaroundPanelPrompt', fallback);
  return applyTemplate(template, { visualStyle, stylePrompt, artDirectionBlock, character });
};

export const buildTurnaroundImagePrompt = (
  visualStyle: string,
  stylePrompt: string,
  character: any,
  panelDescriptions: string,
  artDirectionSuffix: string
): string => {
  const fallback = `Generate a SINGLE image composed as a CHARACTER TURNAROUND/REFERENCE SHEET with a 3x3 grid layout (9 equal panels).
The image shows the SAME CHARACTER from 9 DIFFERENT viewing angles and distances.
Each panel is separated by thin white borders.
This is a professional character design reference sheet for animation/film production.

Visual Style: ${visualStyle} (${stylePrompt})

Character: ${character.name} - ${character.visualPrompt || `${character.gender}, ${character.age}, ${character.personality}`}

Grid Layout (left to right, top to bottom):
${panelDescriptions}

CRITICAL REQUIREMENTS:
- The output MUST be a SINGLE image divided into exactly 9 equal rectangular panels in a 3x3 grid layout
- Each panel MUST have a thin white border/separator (2-3px) between panels
- ALL 9 panels show the EXACT SAME CHARACTER with IDENTICAL appearance:
  * Same face features (eyes, nose, mouth, face shape) - ABSOLUTELY IDENTICAL across all panels
  * Same hairstyle and hair color - NO variation allowed
  * Same clothing and accessories - EXACTLY the same outfit in every panel
  * Same body proportions and build
  * Same skin tone and complexion
- The ONLY difference between panels is the VIEWING ANGLE and DISTANCE
- Use a clean, neutral background (solid color or subtle gradient) to emphasize the character
- Each panel should be a well-composed, professional-quality character reference
- Maintain consistent lighting across all panels for accurate color reference
- Character should have a neutral/characteristic pose appropriate for a reference sheet${artDirectionSuffix}

⚠️ CHARACTER CONSISTENCY IS THE #1 PRIORITY - The character must look like the EXACT SAME PERSON in all 9 panels!`;
  const template = getEffectivePrompt('buildTurnaroundImagePrompt', fallback);
  return applyTemplate(template, { visualStyle, stylePrompt, character, panelDescriptions, artDirectionSuffix });
};
