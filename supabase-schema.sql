-- ============================================
-- Meon - Supabase 数据库 Schema
-- 在 Supabase Dashboard > SQL Editor 中执行此文件
-- ============================================

-- 1. 用户 Profile 表（扩展 auth.users）
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 项目表（不含二进制数据，base64 字段替换为 Storage URL）
CREATE TABLE public.projects (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL DEFAULT '未命名项目',
  created_at BIGINT NOT NULL,
  last_modified BIGINT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'script',
  raw_script TEXT DEFAULT '',
  target_duration TEXT DEFAULT '60s',
  language TEXT DEFAULT '中文',
  visual_style TEXT DEFAULT 'live-action',
  shot_generation_model TEXT DEFAULT 'gpt-5.1',
  script_data JSONB,          -- ScriptData（图片字段替换为 Storage URL）
  shots JSONB DEFAULT '[]',   -- Shot[]（关键帧图、视频替换为 Storage URL）
  render_logs JSONB DEFAULT '[]',
  is_parsing_script BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 资产库表
CREATE TABLE public.asset_library (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  project_id TEXT,
  project_name TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  data JSONB NOT NULL
);

-- 4. 提示词模板表
CREATE TABLE public.prompt_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,         -- 分类：script, shot, visual, style, etc.
  name TEXT NOT NULL,             -- 名称：buildScriptParsingPrompt, VISUAL_STYLE_PROMPTS, etc.
  content TEXT NOT NULL,          -- 提示词内容模板
  version TEXT DEFAULT '1.0.0',   -- 版本号
  is_default BOOLEAN DEFAULT FALSE, -- 是否为系统默认
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(category, name, version)
);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_templates ENABLE ROW LEVEL SECURITY;

-- Profiles: 用户只能操作自己的 Profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Projects: 用户只能 CRUD 自己的项目
CREATE POLICY "Users can CRUD own projects" ON public.projects
  FOR ALL USING (auth.uid() = user_id);

-- Asset Library: 用户只能 CRUD 自己的资产
CREATE POLICY "Users can CRUD own assets" ON public.asset_library
  FOR ALL USING (auth.uid() = user_id);

-- Prompt Templates: 所有认证用户可读，仅管理员可写（这里简化为任何人可读，暂时不开放写权限给普通用户）
CREATE POLICY "Anyone can read prompt templates" ON public.prompt_templates
  FOR SELECT USING (true);

-- ============================================
-- 索引（优化查询性能）
-- ============================================

CREATE INDEX idx_projects_user_id ON public.projects(user_id);
CREATE INDEX idx_projects_last_modified ON public.projects(last_modified DESC);
CREATE INDEX idx_asset_library_user_id ON public.asset_library(user_id);
CREATE INDEX idx_prompt_templates_category_name ON public.prompt_templates(category, name);

-- ============================================
-- 自动创建 Profile 的 Trigger
-- 用户注册后自动创建对应的 Profile 记录
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- Storage Bucket RLS（在创建 bucket 后执行）
-- Bucket 名称: project-media
-- 路径规则: {user_id}/{project_id}/{type}/{filename}
-- ============================================

-- 允许认证用户向自己的目录上传文件
CREATE POLICY "Users can upload to own folder"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'project-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 允许认证用户读取自己的文件
CREATE POLICY "Users can read own files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'project-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 允许认证用户更新自己的文件
CREATE POLICY "Users can update own files"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'project-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 允许认证用户删除自己的文件
CREATE POLICY "Users can delete own files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'project-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
