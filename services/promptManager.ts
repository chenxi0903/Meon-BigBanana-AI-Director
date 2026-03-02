import { supabase } from './supabase/client';

export interface UserPrompt {
  id: string;
  user_id: string;
  prompt_id: string;
  content: string;
  is_active: boolean;
  updated_at: string;
}

export interface SystemPrompt {
  id: string;
  category: string;
  name: string;
  content: string;
  is_default: boolean;
}

// Fetch user's custom prompts
export const getUserPrompts = async (userId: string): Promise<Record<string, string>> => {
  if (!supabase) return {};
  
  const { data, error } = await supabase
    .from('prompt_user')
    .select('prompt_id, content')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching user prompts:', error);
    return {};
  }

  // Convert array to map: { promptId: content }
  return (data || []).reduce((acc, item) => {
    acc[item.prompt_id] = item.content;
    return acc;
  }, {} as Record<string, string>);
};

// Save a user prompt override
export const saveUserPrompt = async (userId: string, promptId: string, content: string) => {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('prompt_user')
    .upsert(
      { 
        user_id: userId, 
        prompt_id: promptId, 
        content: content,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'user_id, prompt_id' }
    )
    .select()
    .single();

  if (error) {
    console.error('Error saving user prompt:', error);
    throw error;
  }

  return data;
};

// Reset a user prompt (delete override)
export const resetUserPrompt = async (userId: string, promptId: string) => {
  if (!supabase) return;

  const { error } = await supabase
    .from('prompt_user')
    .delete()
    .eq('user_id', userId)
    .eq('prompt_id', promptId);

  if (error) {
    console.error('Error resetting user prompt:', error);
    throw error;
  }
};

// Fetch system default prompt
export const getSystemPrompt = async (promptId: string): Promise<string | null> => {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('prompt_templates')
    .select('content')
    .eq('name', promptId)
    // Assuming we want the latest version or default one. 
    // The table has is_default, but multiple versions might exist.
    // We'll pick the one marked is_default=true, or just the latest one.
    .order('version', { ascending: false }) 
    .limit(1)
    .single();

  if (error) {
    // It's possible the prompt doesn't exist in system templates yet
    console.warn(`System prompt not found for ID: ${promptId}`, error);
    return null;
  }

  return data?.content || null;
};

// Fetch all system default prompts
export const getAllSystemPrompts = async (): Promise<Record<string, string>> => {
  if (!supabase) return {};

  const { data, error } = await supabase
    .from('prompt_templates')
    .select('name, content, version')
    .eq('is_default', true); // Only fetch default templates

  if (error) {
    console.error('Error fetching system prompts:', error);
    return {};
  }

  // Convert array to map: { promptId: content }
  // Note: if multiple defaults exist (different versions), the last one wins
  // Ideally, we should order by version DESC and filter unique names
  return (data || []).reduce((acc, item) => {
    acc[item.name] = item.content;
    return acc;
  }, {} as Record<string, string>);
};

// Global in-memory cache for prompt overrides
let globalPromptCache: Record<string, string> = {};

// Initialize/Update cache with user prompts
export const initializePromptCache = async (userId: string) => {
  const userPrompts = await getUserPrompts(userId);
  globalPromptCache = userPrompts;
};

// Clear cache
export const clearPromptCache = () => {
  globalPromptCache = {};
};

// Get effective prompt (User Override > System Default > Hardcoded Fallback)
export const getEffectivePrompt = (
  promptId: string, 
  fallbackContent: string
): string => {
  // 1. Check user override in cache
  if (globalPromptCache[promptId]) {
    return globalPromptCache[promptId];
  }
  
  // 2. Return fallback (System defaults should be synced to code or handled otherwise, 
  // but for now we rely on the caller providing the hardcoded fallback)
  return fallbackContent;
};
