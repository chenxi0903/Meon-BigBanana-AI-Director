import React, { useState, useEffect } from 'react';
import { 
  X, 
  RotateCcw, 
  Check, 
  Info, 
  Wrench, 
  Cpu,        // Simple Model 
  Video,      // Shot Service 
  LayoutGrid, // 九宫格 
  FileText,   // Script Service 
  Image as ImageIcon,      // Visual Service 
  Sun, 
  Moon, 
  Download,   // 引入下载图标
  RefreshCw   // 引入刷新图标
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../GlobalAlert';
import { getUserPrompts, saveUserPrompt, resetUserPrompt, getSystemPrompt, getAllSystemPrompts } from '../../services/promptManager';

// 根据提供的真实业务结构重建的数据 
const PROMPT_CATEGORIES = [ 
  { 
    category: 'Simple Model Service', 
    icon: <Cpu className="w-4 h-4" />, 
    items: [ 
      { id: 'buildSimpleScriptParsePrompt', title: '快速脚本解析', type: 'Prompt', isDefault: true, usage: '把原始文本解析为结构化剧本 JSON（标题/角色/场景/段落）用于快速脚本解析。', content: 'You are a script parsing assistant. Extract characters, scenes, and dialogs into valid JSON format...' }, 
      { id: 'buildSimpleShotGenerationPrompt', title: '初版分镜规划', type: 'Prompt', isDefault: true, usage: '基于脚本数据生成分镜列表（shot list）用于初版分镜规划。', content: 'Generate a shot list based on the provided script. Detail the camera angles and actions...' }, 
      { id: 'buildSimpleVisualPromptGenerationPrompt', title: '快速出图视觉提示词', type: 'Prompt', isDefault: false, usage: '为单个角色或场景生成视觉提示词（含负面词）用于快速出图。', content: 'Create a highly detailed image generation prompt and negative prompt for the following entity...' }, 
    ] 
  }, 
  { 
    category: 'Shot Service（镜头/关键帧）', 
    icon: <Video className="w-4 h-4" />, 
    items: [ 
      { id: 'buildActionSuggestionPrompt', title: '动作过渡总结', type: 'Prompt', isDefault: true, usage: '根据起始/结束关键帧+运镜生成动作过渡总结。', content: 'Given the starting keyframe and ending keyframe, describe the fluid action transition...' }, 
      { id: 'buildShotSplitPrompt', title: '子镜头拆分', type: 'Prompt', isDefault: true, usage: '把单个镜头拆成多个子镜头，输出子镜头要点。', content: 'Split this single continuous shot into smaller sequential sub-shots...' }, 
      { id: 'buildKeyframeOptimizationPrompt', title: '优化关键帧提示词', type: 'Prompt', isDefault: true, usage: '优化单个关键帧提示词，用于提升图像生成质量。', content: 'Enhance this visual prompt to maximize AI image generation quality, focusing on lighting and detail...' }, 
      { id: 'buildOptimizeBothKeyframesPrompt', title: '双关键帧视觉描述', type: 'Prompt', isDefault: true, usage: '同时生成起始帧+结束帧的详细视觉描述。', content: 'Simultaneously generate rich visual descriptions for both the starting and ending keyframes...' }, 
      { id: 'buildDetailedKeyframeOptPrompt', title: '细粒度关键帧优化', type: 'Prompt', isDefault: true, usage: '更细粒度地优化起始/结束帧描述。', content: 'Provide microscopic detail optimization for the keyframes, including camera lens specifications...' }, 
      { id: 'buildDetailedActionSugPrompt', title: '更丰富的动作建议', type: 'Prompt', isDefault: true, usage: '基于参考示例生成更丰富的动作建议。', content: 'Analyze the reference examples and propose dynamic, character-specific acting suggestions...' }, 
      { id: 'buildDetailedShotSplitPrompt', title: '严格镜头拆分', type: 'Prompt', isDefault: true, usage: '更严格、更丰富地拆分镜头动作。', content: 'Strictly divide the action sequence, ensuring absolute continuity between sub-shots...' }, 
      { id: 'buildKeyframeEnhancementPrompt', title: '技术规格视觉增强', type: 'Prompt', isDefault: true, usage: '在基础提示词上加技术规格/视觉细节增强。', content: 'Append cinematic technical specifications (e.g., 35mm lens, volumetric lighting) to the base prompt...' }, 
    ] 
  }, 
  { 
    category: '九宫格 / 转身板', 
    icon: <LayoutGrid className="w-4 h-4" />, 
    items: [ 
      { id: 'buildNineGridPanelsPrompt', title: '九宫格视角拆分', type: 'Prompt', isDefault: true, usage: '把一个镜头动作拆成 9 个视角描述（用于九宫格分镜）。', content: 'Deconstruct the scene into a 3x3 grid panel layout. Describe the unique framing for each of the 9 panels...' }, 
      { id: 'buildNineGridImagePrompt', title: '九宫格图像提示词', type: 'Prompt', isDefault: true, usage: '把 9 个视角拼成单张 3x3 九宫格图像的生成提示词。', content: 'Create a single image generation prompt that produces a 3x3 comic-style layout containing...' }, 
      { id: 'buildTurnaroundPanelPrompt', title: '角色转身板描述', type: 'Prompt', isDefault: true, usage: '生成角色 9 宫格转身板（角色一致性用）。', content: 'Generate a turnaround character sheet description covering 9 distinct angles (front, 3/4, side, back, etc.)...' }, 
      { id: 'buildTurnaroundImagePrompt', title: '转身板图像提示词', type: 'Prompt', isDefault: true, usage: '将转身板面板描述生成单张 3x3 图像的提示词。', content: 'Produce a visual prompt for a 3x3 character turnaround reference sheet, maintaining absolute consistency...' }, 
    ] 
  }, 
  { 
    category: 'Script Service（剧本）', 
    icon: <FileText className="w-4 h-4" />, 
    items: [ 
      { id: 'buildScriptParsingPrompt', title: '剧本解析 JSON', type: 'Prompt', isDefault: true, usage: '把剧本解析成结构化 JSON。', content: 'Parse the following screenplay text and strictly output a JSON object mapping scenes and dialogue...' }, 
      { id: 'buildShotListGenerationPrompt', title: '场次拆分镜头', type: 'Prompt', isDefault: true, usage: '将场次拆成镜头列表（分镜生成）。', content: 'Break down this specific scene into an ordered list of camera shots...' }, 
      { id: 'buildScriptContinuationPrompt', title: '剧本续写', type: 'Prompt', isDefault: true, usage: '剧本续写。', content: 'Continue the story based on the preceding screenplay excerpt, maintaining tone and character voices...' }, 
      { id: 'buildScriptRewritePrompt', title: '剧本润色/改写', type: 'Prompt', isDefault: true, usage: '剧本润色/改写。', content: 'Rewrite and polish the provided dialogue and action lines to enhance emotional impact...' }, 
    ] 
  }, 
  { 
    category: 'Visual Service（视觉）', 
    icon: <ImageIcon className="w-4 h-4" />, 
    items: [ 
      { id: 'buildArtDirectionPrompt', title: '全局美术指导', type: 'Prompt', isDefault: true, usage: '生成全局美术指导（Art Direction Brief）。', content: 'Establish the core Art Direction Brief for the project, defining the color palette, lighting mood, and style...' }, 
      { id: 'buildBatchCharacterPrompt', title: '批量角色视觉', type: 'Prompt', isDefault: true, usage: '批量生成所有角色视觉提示词。', content: 'Process the list of characters and generate distinct, visually contrasting design prompts for each...' }, 
      { id: 'buildCharacterPrompt', title: '单角色视觉', type: 'Prompt', isDefault: true, usage: '生成单个角色视觉提示词。', content: 'Create a comprehensive character design prompt covering facial features, body type, and clothing...' }, 
      { id: 'buildScenePrompt', title: '单场景视觉', type: 'Prompt', isDefault: true, usage: '生成单个场景视觉提示词。', content: 'Describe the environment in rich detail, specifying architecture, weather, time of day, and atmosphere...' }, 
      { id: 'buildOutfitVariationPrompt', title: '角色换装版本', type: 'Prompt', isDefault: true, usage: '基于角色提示词生成换装版本。', content: 'Keep the character face and body strictly consistent, but change their outfit to match the new description...' }, 
      { id: 'buildConsistencyPrompt', title: '角色一致性控制', type: 'Prompt', isDefault: true, usage: '生成角色一致性控制提示词。', content: 'Apply strict consistency tokens to ensure the character remains identical across multiple seed variations...' }, 
    ] 
  } 
];

interface PromptManagerProps {
  onClose: () => void;
}

// Global cache for system prompts to avoid redundant fetches
let cachedSystemPrompts: Record<string, string> | null = null;

export default function PromptManager({ onClose }: PromptManagerProps) { 
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const allPrompts = PROMPT_CATEGORIES.flatMap(c => c.items); 
  const [selectedId, setSelectedId] = useState(allPrompts[0].id); 
  const activePrompt = allPrompts.find(p => p.id === selectedId) || allPrompts[0]; 

  // User overrides from Supabase
  const [userPrompts, setUserPrompts] = useState<Record<string, string>>({});
  // System defaults fetched from Supabase (to update local defaults if needed)
  const [systemDefaults, setSystemDefaults] = useState<Record<string, string>>({});
  
  // Current editing content
  const [editingContent, setEditingContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load user prompts on mount and sync system defaults
  useEffect(() => {
    if (user) {
      getUserPrompts(user.id).then(setUserPrompts);
    }
    
    // Check global cache first
    if (cachedSystemPrompts) {
      setSystemDefaults(cachedSystemPrompts);
    } else {
      // Auto-fetch system prompts on mount if not cached
      getAllSystemPrompts().then(prompts => {
        if (Object.keys(prompts).length > 0) {
          cachedSystemPrompts = prompts; // Update global cache
          setSystemDefaults(prompts);
        }
      });
    }
  }, [user]);

  // Update editing content when selection changes or data loads
  useEffect(() => {
    const userContent = userPrompts[selectedId];
    const sysContent = systemDefaults[selectedId];
    const defaultContent = activePrompt.content;
    setEditingContent(userContent ?? sysContent ?? defaultContent);
  }, [selectedId, userPrompts, systemDefaults]);

  // Handle Save
  const handleSave = async () => {
    if (!user) {
      showAlert('请先登录', { type: 'error' });
      return;
    }
    setIsSaving(true);
    try {
      await saveUserPrompt(user.id, selectedId, editingContent);
      setUserPrompts(prev => ({ ...prev, [selectedId]: editingContent }));
      showAlert('保存成功', { type: 'success' });
    } catch (e) {
      console.error(e);
      showAlert('保存失败', { type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Reset
  const handleReset = async () => {
    if (!user) {
      showAlert('请先登录', { type: 'error' });
      return;
    }
    
    // Confirm reset
    if (!window.confirm('确定要重置为系统默认值吗？这将清除您的自定义修改。')) {
      return;
    }

    setIsResetting(true);
    try {
      // 1. Delete user override
      await resetUserPrompt(user.id, selectedId);
      
      // 2. Fetch system default from DB
      const sysContent = await getSystemPrompt(selectedId);
      
      // 3. Update local state
      setUserPrompts(prev => {
        const newState = { ...prev };
        delete newState[selectedId];
        return newState;
      });
      
      if (sysContent) {
        setSystemDefaults(prev => ({ ...prev, [selectedId]: sysContent }));
        setEditingContent(sysContent);
      } else {
        // Fallback to hardcoded default if DB doesn't have it
        setEditingContent(activePrompt.content);
      }
      
      showAlert('已重置为系统默认值', { type: 'success' });
    } catch (e) {
      console.error(e);
      showAlert('重置失败', { type: 'error' });
    } finally {
      setIsResetting(false);
    }
  };

  const handleSyncSystem = async () => {
    setIsSyncing(true);
    try {
      const prompts = await getAllSystemPrompts();
      cachedSystemPrompts = prompts; // Update cache
      setSystemDefaults(prev => ({ ...prev, ...prompts }));
      showAlert(`成功同步 ${Object.keys(prompts).length} 条系统提示词`, { type: 'success' });
    } catch (e) {
      console.error(e);
      showAlert('同步系统提示词失败', { type: 'error' });
    } finally {
      setIsSyncing(false);
    }
  };

  // 深色模式状态控制 
  const [isDarkMode, setIsDarkMode] = useState(false); 

  // 监听系统主题变化作为初始值 
  useEffect(() => { 
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) { 
      setIsDarkMode(true); 
    } 
  }, []); 

  // 导出全部提示词为 JSON 文件 
  const handleExportAll = () => { 
    // Merge user overrides into export data
    const exportData = PROMPT_CATEGORIES.map(cat => ({
      ...cat,
      items: cat.items.map(item => ({
        ...item,
        content: userPrompts[item.id] || systemDefaults[item.id] || item.content,
        isCustomized: !!userPrompts[item.id]
      }))
    }));

    const dataStr = JSON.stringify(exportData, null, 2); 
    const blob = new Blob([dataStr], { type: "application/json" }); 
    const url = URL.createObjectURL(blob); 
    const link = document.createElement('a'); 
    link.href = url; 
    link.download = 'prompts_config_export.json'; 
    document.body.appendChild(link); 
    link.click(); 
    document.body.removeChild(link); 
    URL.revokeObjectURL(url); 
  }; 

  return ( 
    // 最外层包裹一个动态的 `dark` class 
    <div className={`${isDarkMode ? 'dark' : ''} fixed inset-0 z-[200] flex items-center justify-center`}> 
      {/* 背景与全屏遮罩 */} 
      <div className="absolute inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-sm p-4 md:p-8 font-sans flex items-center justify-center selection:bg-purple-200 dark:selection:bg-purple-900/50 transition-colors duration-300" onClick={onClose}> 
        
        {/* 弹窗容器 */} 
        <div className="w-full max-w-6xl h-[85vh] flex flex-col bg-white dark:bg-[#121215] rounded-xl shadow-2xl overflow-hidden transition-colors duration-300" onClick={e => e.stopPropagation()}> 
          
          {/* 顶部标题栏 */} 
          <div className="flex items-center justify-between px-6 py-4 shrink-0 border-b border-gray-200 dark:border-gray-800"> 
            <h1 className="text-[17px] font-bold text-gray-900 dark:text-gray-100 tracking-wide flex items-center gap-2"> 
              <Wrench className="w-5 h-5 text-purple-500" />
              底层提示词管理面板
            </h1> 
            <div className="flex items-center gap-2"> 
              {/* 同步系统提示词按钮 */}
              <button
                onClick={handleSyncSystem}
                disabled={isSyncing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors mr-2 disabled:opacity-50"
                title="从数据库同步最新的系统默认提示词"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                同步系统
              </button>

              {/* 导出全部按钮 */} 
              <button 
                onClick={handleExportAll}  
                className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors mr-2" 
                title="导出为 JSON 文件" 
              > 
                <Download className="w-4 h-4" /> 
                导出全部 
              </button> 
              
              {/* 分割线 */} 
              <div className="w-[1px] h-4 bg-gray-200 dark:bg-gray-700 mx-1"></div> 

              {/* 深浅色切换按钮 */} 
              <button 
                onClick={() => setIsDarkMode(!isDarkMode)} 
                className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors" 
                title={isDarkMode ? "切换亮色模式" : "切换深色模式"} 
              > 
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />} 
              </button> 
              {/* 关闭按钮 */} 
              <button 
                onClick={onClose}
                className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors" 
                title="关闭"
              > 
                <X className="w-5 h-5" /> 
              </button> 
            </div> 
          </div> 

          {/* 主体内容区 */} 
          <div className="flex flex-1 overflow-hidden"> 
            
            {/* A: 左侧边栏 (面板选择) */} 
            <div className="w-[280px] shrink-0 flex flex-col bg-gray-50 dark:bg-[#121215] border-r border-gray-200 dark:border-gray-800 overflow-y-auto custom-scrollbar"> 
              {PROMPT_CATEGORIES.map((category, catIdx) => ( 
                <div key={catIdx} className="mb-4"> 
                  {/* 分类标题 */} 
                  <div className="flex items-center gap-2 px-6 py-3 text-gray-500 dark:text-gray-400 sticky top-0 bg-gray-50 dark:bg-[#121215] z-10"> 
                    {category.icon} 
                    <span className="text-[13px] font-bold tracking-wider">{category.category}</span> 
                  </div> 
                  
                  {/* 提示词列表 */} 
                  <div className="flex flex-col"> 
                    {category.items.map((item) => { 
                      const isActive = selectedId === item.id; 
                      const isCustomized = !!userPrompts[item.id];
                      return ( 
                        <button 
                          key={item.id} 
                          onClick={() => setSelectedId(item.id)} 
                          className={`relative w-full text-left px-6 py-2 transition-colors group flex flex-col ${ 
                            isActive 
                              ? 'bg-[#f8f5ff] dark:bg-[#8b5cf6]/10' 
                              : 'hover:bg-gray-50 dark:hover:bg-gray-800/50' 
                          }`} 
                        > 
                          {/* 激活状态的左侧紫色边带 */} 
                          {isActive && ( 
                            <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#8b5cf6]" /> 
                          )} 
                          <span className={`text-[13px] mb-0.5 truncate w-full flex items-center justify-between ${isActive ? 'text-[#8b5cf6] font-medium' : 'text-gray-700 dark:text-gray-300'}`}> 
                            {item.title} 
                            {isCustomized && <div className="w-1.5 h-1.5 rounded-full bg-purple-500" title="已自定义" />}
                          </span> 
                          <span className={`text-[10px] font-mono truncate w-full ${isActive ? 'text-[#a78bfa] dark:text-[#a78bfa]' : 'text-gray-400 dark:text-gray-600'}`}> 
                            {item.id} 
                          </span> 
                        </button> 
                      ); 
                    })} 
                  </div> 
                </div> 
              ))} 
            </div> 

            {/* H: 右侧栏 (内容展示与编辑) */} 
            <div className="flex-1 flex flex-col bg-white dark:bg-[#0a0a0c] px-8 py-6 min-w-0"> 
              
              {/* 顶部信息与操作区 */} 
              <div className="flex items-start justify-between mb-4 shrink-0"> 
                
                {/* 左侧：标题与标签 */} 
                <div className="flex flex-col gap-2.5"> 
                  <div className="flex items-center gap-3"> 
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white"> 
                      {activePrompt.title} 
                    </h2> 
                    {activePrompt.isDefault && !userPrompts[selectedId] && ( 
                      <span className="px-2 py-0.5 text-[11px] font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10 rounded-full"> 
                        系统默认 
                      </span> 
                    )}
                    {userPrompts[selectedId] && ( 
                      <span className="px-2 py-0.5 text-[11px] font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10 rounded-full"> 
                        自定义 
                      </span> 
                    )} 
                  </div> 
                  
                  <div className="flex items-center gap-2 mt-2"> 
                    {/* 用途描述 */} 
                    <span className="text-[12px] text-gray-600 dark:text-gray-300 bg-[#8b5cf6]/5 dark:bg-[#8b5cf6]/10 px-3 py-1.5 rounded-md"> 
                      {activePrompt.usage} 
                    </span> 
                  </div> 

                  <div className="flex items-center gap-2 mt-2"> 
                    {/* ID 标签 */} 
                    <span className="px-2 py-1 text-[10px] font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800/80 rounded"> 
                      ID: {activePrompt.id} 
                    </span> 
                  </div> 
                </div> 
                
                {/* 右侧：操作按钮 */} 
                <div className="flex items-center gap-3"> 
                  <button 
                    onClick={handleReset}
                    disabled={isResetting || !userPrompts[selectedId]}
                    className={`px-4 py-2 text-[13px] font-medium rounded-md flex items-center gap-2 transition-colors ${
                      !userPrompts[selectedId] 
                        ? 'text-gray-400 bg-gray-50 dark:bg-gray-800/50 cursor-not-allowed' 
                        : 'text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  > 
                    <RotateCcw className={`w-4 h-4 ${isResetting ? 'animate-spin' : ''}`} /> 
                    {isResetting ? '重置中...' : '重置默认值'} 
                  </button> 
                  <button 
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-5 py-2 text-[13px] font-medium text-white bg-[#8b5cf6] rounded-md hover:bg-[#7c3aed] flex items-center gap-2 transition-colors shadow-sm shadow-[#8b5cf6]/20 disabled:opacity-50"
                  > 
                    <Check className="w-4 h-4" /> 
                    {isSaving ? '保存中...' : '保存修改'} 
                  </button> 
                </div> 
              </div> 

              {/* B: 提示词编辑区域 */} 
              <div className="flex-1 relative flex flex-col mb-4"> 
                <textarea 
                  className="flex-1 w-full p-5 bg-gray-50 dark:bg-[#16161a] rounded-lg text-[13px] text-gray-700 dark:text-gray-300 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/50 resize-none custom-scrollbar transition-all shadow-inner font-mono" 
                  value={editingContent}
                  onChange={(e) => setEditingContent(e.target.value)}
                  spellCheck="false" 
                  placeholder="在此输入提示词模板..." 
                /> 
              </div> 

              {/* 底部提示信息 */} 
              <div className="flex items-center justify-between text-[12px] text-gray-400 dark:text-gray-500 shrink-0"> 
                <div className="flex items-center gap-2"> 
                  <Info className="w-4 h-4" /> 
                  <span>
                    {userPrompts[selectedId] 
                      ? '当前使用自定义提示词模板，点击"重置默认值"可恢复系统设置。' 
                      : '当前正使用默认系统提示词模板，编辑后将保存为自定义值，只对当前账号/项目生效。'}
                  </span> 
                </div> 
                <div className="font-mono text-[10px]"> 
                  {editingContent.length} characters 
                </div> 
              </div> 

            </div> 
          </div> 
        </div> 

        {/* 滚动条样式适配亮/暗色 */} 
        <style>{` 
          .custom-scrollbar::-webkit-scrollbar { 
            width: 8px; 
            height: 8px; 
          } 
          .custom-scrollbar::-webkit-scrollbar-track { 
            background: transparent; 
          } 
          /* 亮色模式滚动条 */ 
          .custom-scrollbar::-webkit-scrollbar-thumb { 
            background: #d1d5db; 
            border-radius: 10px; 
            border: 2px solid transparent; 
            background-clip: padding-box; 
          } 
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { 
            background: #9ca3af; 
          } 
          
          /* 深色模式滚动条 */ 
          .dark .custom-scrollbar::-webkit-scrollbar-thumb { 
            background: #4b5563; 
          } 
          .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover { 
            background: #6b7280; 
          } 
        `}</style> 
      </div> 
    </div> 
  ); 
}
