-- Add Q-Version Prompts to prompt_templates
-- 2026-03-09

INSERT INTO public.prompt_templates (category, name, content, version, is_default) VALUES
('prompt_builder', 'buildQVersionThreeViewPrompt', '请将我发送给你的参考图生成为Q版角色的三视图样式，保留角色的主要特征（如发型、衣服、配饰、肤色等）。角色的外形要更加夸张可爱，头部相对较大，眼睛大而亮，身体比例缩小，整体显得更加卡通化和萌趣。请提供角色的正面、侧面和背面三视图，确保每个角度都能准确展示角色的标志性特征和个性细节', '1.0.0', true),

('prompt_builder', 'buildQVersionEmotionsPrompt', '以参考图中的 Q 版三视图角色为基础，生成一套 9 个的 Q 版表情包，排成 3x3 网格。每个表情都是同一个角色，保持原有的发型、服饰和画风，只改变面部表情和情绪符号，包括：

1. 害羞脸红冒汗
2. 愤怒冒火
3. 疑惑问号
4. 花痴爱心眼
5. 黑化暴走
6. 大哭流泪
7. 流汗无语
8. 惊讶张嘴
9. 怒吼咆哮整体

风格为可爱的卡通插画，每个表情都有夸张的动作和符号化元素，背景为纯白色。', '1.0.0', true)

ON CONFLICT (category, name, version) DO UPDATE SET content = EXCLUDED.content;
