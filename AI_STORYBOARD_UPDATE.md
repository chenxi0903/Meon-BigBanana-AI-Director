# AI 影视分镜生成系统升级文档

本文档详细说明了 AI 影视分镜生成系统的升级内容，包括数据结构变更、提示词优化以及后端逻辑适配。此次升级旨在引入更专业的电影制作参数，提升 AI 生成分镜的质量和可控性。

## 1. 数据结构变更 (Types)

在 `Shot` 接口中新增了以下字段，以支持更细粒度的控制和元数据存储：

- **aiImagePrompt** (`string`): 文生图逻辑词组。用于 Midjourney 或 Stable Diffusion 生成底图（包含：主体 + 环境 + 光影 + 构图 + 风格标签）。
- **aiVideoPrompt** (`string`): 图生视频动态词组。用于 Runway Gen-2 或 Luma Dream Machine 定义动态（包含：主体微动 + 环境动态 + 运镜方向）。
- **audioEffects** (`string`): 音效提示。标注该镜头关联的关键音效或环境 BGM。
- **notes** (`string`): 导演备注。标注该镜头的情绪意图、剪辑点提示或特殊说明。

### 修改文件
- `d:\Code\TestProject\Meon-Clone\types.ts`

```typescript
export interface Shot {
  // ... 原有字段
  aiImagePrompt?: string; // 新增
  aiVideoPrompt?: string; // 新增
  audioEffects?: string;  // 新增
  notes?: string;         // 新增
  keyframes: Keyframe[];
  // ...
}
```

## 2. 提示词优化 (Prompt Engineering)

替换了原有的 `buildShotListGenerationPrompt` 提示词模板，采用了更专业的导演视角和 AI 生成逻辑。

### 主要特点
- **角色设定**: 明确了 AI 作为“专业摄影指导（DP）”和“顶级 AI 影视制作专家”的身份。
- **镜头拆解**: 引入了“切片式”讲戏和剪辑思路，强制执行单机位/单景别原则。
- **生成逻辑**:
    - **aiImagePrompt**: 结构化公式（主体+环境+光影+构图+风格）。
    - **aiVideoPrompt**: 专注于动态描述（主体微动+环境动态+运镜）。
- **强制覆盖**: 要求包含反应镜头、插入特写和主观镜头，丰富视听语言。

### 修改文件
- `d:\Code\TestProject\Meon-Clone\services\ai\prompts.ts`

## 3. 后端逻辑适配 (Service Logic)

更新了 `scriptService.ts` 中的 `generateShotList` 函数，以确保新字段被正确解析并映射到 `Shot` 对象中。同时增加了兼容性处理，以应对 AI 返回数据格式的潜在差异。

### 关键逻辑
1. **字段映射**: 显式提取 `aiImagePrompt`, `aiVideoPrompt`, `audioEffects`, `notes` 字段，确保它们不会因为 AI 返回 `null` 而丢失。
2. **Keyframe 合成**: 
    - 如果 AI 返回的数据中不包含 `keyframes` 数组（这是新提示词结构的默认行为），但包含 `aiImagePrompt`，系统会自动合成一个默认的 `start` 关键帧。
    - `visualPrompt` 被设置为 `aiImagePrompt` 的值，确保后续的图片生成流程能够正常工作。

### 修改文件
- `d:\Code\TestProject\Meon-Clone\services\ai\scriptService.ts`

```typescript
// 逻辑片段
if (keyframes.length === 0 && s.aiImagePrompt) {
  keyframes = [{
    type: 'start',
    visualPrompt: s.aiImagePrompt,
    status: 'pending'
  }];
}
```

## 4. 验证与测试

建议进行以下测试以验证更新：
1. **运行分镜生成**: 使用一段测试剧本运行分镜生成功能。
2. **检查输出**: 确认生成的 `Shot` 对象中包含 `aiImagePrompt` 等新字段。
3. **图片生成**: 确认系统能够基于自动合成的 `keyframes` 生成图片。
4. **视频提示词**: 确认 `aiVideoPrompt` 被正确保存，并可在视频生成环节使用。

---
*文档生成时间: 2026-03-06*
