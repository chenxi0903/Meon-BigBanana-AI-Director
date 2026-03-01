-- Create prompt_user table to store user overrides
CREATE TABLE IF NOT EXISTS public.prompt_user (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt_id TEXT NOT NULL, -- Corresponds to the 'id' in the UI (e.g., 'buildSimpleScriptParsePrompt')
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, prompt_id)
);

-- Enable RLS
ALTER TABLE public.prompt_user ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can select their own prompts" ON public.prompt_user;
CREATE POLICY "Users can select their own prompts" ON public.prompt_user
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own prompts" ON public.prompt_user;
CREATE POLICY "Users can insert their own prompts" ON public.prompt_user
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own prompts" ON public.prompt_user;
CREATE POLICY "Users can update their own prompts" ON public.prompt_user
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own prompts" ON public.prompt_user;
CREATE POLICY "Users can delete their own prompts" ON public.prompt_user
  FOR DELETE USING (auth.uid() = user_id);
