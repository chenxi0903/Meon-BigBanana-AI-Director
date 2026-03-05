import { loadSystemPrompts, setOfflineMode } from '../services/promptManager';

/**
 * Checks if system prompts can be loaded from the server.
 * If not, asks the user whether to proceed with offline/fallback prompts.
 * 
 * @returns Promise<boolean> - true if ready to proceed (online or offline fallback), false if user cancelled.
 */
export const checkPromptsConnection = async (): Promise<boolean> => {
  try {
    await loadSystemPrompts();
    return true;
  } catch (err) {
    console.error("Failed to load prompts:", err);
    // Confirm with user using native window.confirm for simplicity
    const useFallback = window.confirm(
      "无法连接到服务器获取最新提示词。\n\n是否使用本地备用提示词继续？\n\n点击【确定】继续（使用备用提示词）\n点击【取消】停止操作"
    );
    
    if (useFallback) {
      setOfflineMode(true);
      return true;
    }
    return false;
  }
};
