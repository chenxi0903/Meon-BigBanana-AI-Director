-- ============================================
-- Meon - Mark Deprecated Prompt Versions
-- 将已弃用的旧版提示词 (buildShotListGenerationPrompt) 版本号标记为 "0.0.0-deprecated"
-- 请在 Supabase Dashboard > SQL Editor 中执行此文件
-- ============================================

UPDATE public.prompt_templates 
SET 
  version = '0.0.0-deprecated', 
  is_default = false,
  updated_at = NOW()
WHERE 
  name = 'buildShotListGenerationPrompt' 
  AND category = 'director';

-- 验证更新结果
SELECT name, version, is_default FROM public.prompt_templates 
WHERE name = 'buildShotListGenerationPrompt';
