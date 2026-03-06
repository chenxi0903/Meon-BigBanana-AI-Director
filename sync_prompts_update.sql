-- ============================================
-- Meon - Prompt Templates Update (Director Service) - Fixed
-- 修复：移除了不存在的 'usage' 字段
-- 请在 Supabase Dashboard > SQL Editor 中执行此文件
-- ============================================

-- 1. 插入或更新 Stage 1: 分镜骨架生成 (buildShotListSkeletonPrompt)
INSERT INTO public.prompt_templates (category, name, content, version, is_default)
VALUES (
  'director',
  'buildShotListSkeletonPrompt',
  '你是一名专业导演和剪辑师。你的任务是将当前场景拆解为一系列镜头（分镜表骨架），专注于叙事节奏、运镜和动作设计。

语言: ${language}
目标总镜头数: ${totalShotsNeeded}
本场景大约镜头数: ${shotsPerScene}

当前场景 (${index + 1}/${scriptData.scenes.length})：
地点: ${scene.location}
时间: ${scene.time}
氛围: ${scene.atmosphere}

本场景的故事段落：
${paragraphs}

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
      "characters": ["character_id"], // 出现在该镜头中的角色ID列表
      "notes": "string" // 导演备注
    }
  ]
}',
  '1.0.0',
  true
)
ON CONFLICT (category, name, version) DO UPDATE 
SET content = EXCLUDED.content, updated_at = NOW();

-- 2. 插入或更新 Stage 2: 视觉细节填充 (buildShotVisualDetailsPrompt)
INSERT INTO public.prompt_templates (category, name, content, version, is_default)
VALUES (
  'director',
  'buildShotVisualDetailsPrompt',
  '你是一名顶级 AI 视觉导演。你的任务是为以下分镜列表生成极度细腻的 AI 绘画和 AI 视频提示词。

语言: ${language}
视觉风格: ${visualStyle}
大模型基调: ${stylePrompt}

${artDirectionBlock}

待处理的镜头列表：
${JSON.stringify(shots, null, 2)}

任务：为每个镜头生成 aiImagePrompt, aiVideoPrompt 和 audioEffects。

⚠️ AI 生成逻辑法则：
1. aiImagePrompt (文生图): 提取视觉核心。公式：主体描述 + 背景环境 + 景别 + 构图角度 + 光影氛围 + 材质细节 + ${stylePrompt}。必须严格遵守全局美术指导（Global Art Direction）。
2. aiVideoPrompt (图生视频): 专注于“画面中什么在动”。公式：主体微小动作 + 物理环境动态（风、光、烟） + 运镜方向。
3. 画面一致性：确保相邻镜头的环境和光影连贯。

返回一个有效的 JSON 对象，包含对应镜头的视觉详情：
{
  "details": [
    {
      "id": "number", // 对应输入的镜头序号
      "aiImagePrompt": "string", // 极度细腻的英文或中文提示词
      "aiVideoPrompt": "string", // 视频生成提示词
      "audioEffects": "string" // 音效设计
    }
  ]
}',
  '1.0.0',
  true
)
ON CONFLICT (category, name, version) DO UPDATE 
SET content = EXCLUDED.content, updated_at = NOW();

-- 3. 将旧版 (Legacy) 标记为非默认 (如果存在)
-- 注意：这里使用 WHERE 子句确保只更新已存在的记录
UPDATE public.prompt_templates 
SET is_default = false 
WHERE name = 'buildShotListGenerationPrompt' AND category = 'director';
