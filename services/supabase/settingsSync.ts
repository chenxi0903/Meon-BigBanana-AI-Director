
import { supabase, isSupabaseConfigured } from './client';
import { JimengGlobalConfig } from '../modelRegistry';
import { ModelRegistryState } from '../../types/model';

export interface UserSettings {
  registry: ModelRegistryState;
  jimeng: JimengGlobalConfig;
}

/**
 * Upload user settings to Supabase
 */
export const syncSettingsToCloud = async (
  userId: string,
  settings: UserSettings
): Promise<boolean> => {
  if (!supabase || !isSupabaseConfigured()) return false;

  try {
    const { error } = await supabase.from('user_settings').upsert({
      user_id: userId,
      registry_config: settings.registry,
      jimeng_config: settings.jimeng,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    if (error) {
      console.error('[Sync] Failed to sync settings:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[Sync] Error syncing settings:', err);
    return false;
  }
};

/**
 * Fetch user settings from Supabase
 */
export const fetchSettingsFromCloud = async (
  userId: string
): Promise<UserSettings | null> => {
  if (!supabase || !isSupabaseConfigured()) return null;

  try {
    const { data, error } = await supabase
      .from('user_settings')
      .select('registry_config, jimeng_config')
      .eq('user_id', userId)
      .single();

    if (error) {
      // It's normal if no settings exist yet
      if (error.code === 'PGRST116') return null;
      console.error('[Sync] Failed to fetch settings:', error);
      return null;
    }

    if (!data) return null;

    return {
      registry: data.registry_config as ModelRegistryState,
      jimeng: data.jimeng_config as JimengGlobalConfig,
    };
  } catch (err) {
    console.error('[Sync] Error fetching settings:', err);
    return null;
  }
};
