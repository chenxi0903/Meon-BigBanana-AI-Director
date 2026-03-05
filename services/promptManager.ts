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
    throw error; // Throw error to allow caller to handle connection failures
  }

  // Convert array to map: { promptId: content }
  return (data || []).reduce((acc, item) => {
    acc[item.name] = item.content;
    return acc;
  }, {} as Record<string, string>);
};

// Global in-memory cache
let userPromptCache: Record<string, string> = {};
let systemPromptCache: Record<string, string> = {};
let isOfflineMode = false;
let lastSystemPromptFetchAt = 0;
let systemPromptRefreshTimer: ReturnType<typeof setInterval> | null = null;
const SYSTEM_PROMPT_REFRESH_MS = 40 * 60 * 1000;

const refreshSystemPrompts = async (options?: { force?: boolean; throwOnError?: boolean }) => {
  const now = Date.now();
  const shouldRefresh = options?.force || now - lastSystemPromptFetchAt >= SYSTEM_PROMPT_REFRESH_MS;
  if (!shouldRefresh) return false;
  try {
    const sysPrompts = await getAllSystemPrompts();
    systemPromptCache = sysPrompts;
    isOfflineMode = false;
    lastSystemPromptFetchAt = Date.now();
    return true;
  } catch (error) {
    console.error("Failed to load system prompts:", error);
    if (options?.throwOnError) {
      throw error;
    }
    return false;
  }
};

const startSystemPromptAutoRefresh = () => {
  if (systemPromptRefreshTimer) return;
  systemPromptRefreshTimer = setInterval(() => {
    refreshSystemPrompts();
  }, SYSTEM_PROMPT_REFRESH_MS);
};

// Initialize/Update cache with user prompts
export const initializePromptCache = async (userId: string) => {
  const userPrompts = await getUserPrompts(userId);
  userPromptCache = userPrompts;
  await refreshSystemPrompts({ force: true });
  startSystemPromptAutoRefresh();
};

// Load system prompts from server
export const loadSystemPrompts = async () => {
  await refreshSystemPrompts({ force: true, throwOnError: true });
  return true;
};

export const setOfflineMode = (offline: boolean) => {
  isOfflineMode = offline;
};

export const setPromptOverrideCache = (promptId: string, content: string) => {
  userPromptCache = { ...userPromptCache, [promptId]: content };
};

export const clearPromptOverrideCache = (promptId: string) => {
  if (!userPromptCache[promptId]) return;
  const next = { ...userPromptCache };
  delete next[promptId];
  userPromptCache = next;
};

// Clear cache
export const clearPromptCache = () => {
  userPromptCache = {};
  systemPromptCache = {};
  isOfflineMode = false;
  lastSystemPromptFetchAt = 0;
  if (systemPromptRefreshTimer) {
    clearInterval(systemPromptRefreshTimer);
    systemPromptRefreshTimer = null;
  }
};

// Get effective prompt (User Override > System Default > Hardcoded Fallback)
export const getEffectivePrompt = (
  promptId: string, 
  fallbackContent: string
): string => {
  // 1. Check user override in cache
  if (userPromptCache[promptId]) {
    return userPromptCache[promptId];
  }
  
  // 2. Check system default (if not offline)
  if (!isOfflineMode && systemPromptCache[promptId]) {
    return systemPromptCache[promptId];
  }
  
  // 3. Return fallback
  return fallbackContent;
};
