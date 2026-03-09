import React, { useState } from 'react';
import { X, Loader2, Smile, Grid3x3, ArrowRight, Image as ImageIcon, Wand2 } from 'lucide-react';
import { Character } from '../../types';
import { buildQVersionThreeViewPrompt, buildQVersionEmotionGridPrompt } from '../../services/ai/prompts';

interface QVersionModalProps {
  character: Character;
  onClose: () => void;
  onGenerateThreeView: (charId: string, prompt: string) => void;
  onGenerateEmotionGrid: (charId: string, prompt: string) => void;
  onImageClick: (imageUrl: string) => void;
}

const QVersionModal: React.FC<QVersionModalProps> = ({
  character,
  onClose,
  onGenerateThreeView,
  onGenerateEmotionGrid,
  onImageClick,
}) => {
  const [activeTab, setActiveTab] = useState<'three-view' | 'emotion-grid'>('three-view');
  const [threeViewPrompt, setThreeViewPrompt] = useState(buildQVersionThreeViewPrompt());
  const [emotionGridPrompt, setEmotionGridPrompt] = useState(buildQVersionEmotionGridPrompt());

  const qVersion = character.qVersion;
  const threeViewStatus = qVersion?.threeView?.status || 'pending';
  const emotionGridStatus = qVersion?.emotionGrid?.status || 'pending';

  const isThreeViewGenerating = threeViewStatus === 'generating';
  const isEmotionGridGenerating = emotionGridStatus === 'generating';
  const isThreeViewCompleted = threeViewStatus === 'completed' && qVersion?.threeView?.imageUrl;
  const isEmotionGridCompleted = emotionGridStatus === 'completed' && qVersion?.emotionGrid?.imageUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="bg-[var(--bg-elevated)] border border-[var(--border-secondary)] rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-primary)] bg-[var(--bg-surface)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--bg-hover)] flex items-center justify-center text-[var(--accent)] border border-[var(--border-secondary)]">
               <Smile className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">Q版角色生成</h2>
              <p className="text-xs text-[var(--text-tertiary)]">为 {character.name} 生成 Q 版形象和表情包</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[var(--bg-hover)] rounded-full transition-colors text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--border-primary)] bg-[var(--bg-surface)]">
          <button
            onClick={() => setActiveTab('three-view')}
            className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 ${
              activeTab === 'three-view'
                ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent-bg)]/10'
                : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            Step 1: Q版三视图
          </button>
          <button
            onClick={() => setActiveTab('emotion-grid')}
            disabled={!isThreeViewCompleted}
            className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 ${
              activeTab === 'emotion-grid'
                ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent-bg)]/10'
                : !isThreeViewCompleted
                ? 'border-transparent text-[var(--text-muted)] cursor-not-allowed opacity-50'
                : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            Step 2: 情绪九宫格
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-[var(--bg-base)]">
          {activeTab === 'three-view' ? (
            <div className="space-y-6">
              <div className="flex gap-6 flex-col md:flex-row">
                {/* Left: Prompt Editor */}
                <div className="flex-1 space-y-4">
                  <div>
                    <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2 block">
                      生成提示词
                    </label>
                    <textarea
                      value={threeViewPrompt}
                      onChange={(e) => setThreeViewPrompt(e.target.value)}
                      className="w-full h-40 bg-[var(--bg-surface)] border border-[var(--border-secondary)] rounded-lg p-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] resize-none"
                      placeholder="输入提示词..."
                    />
                    <p className="text-xs text-[var(--text-muted)] mt-2">
                      提示：系统已预置标准 Q 版生成提示词，您可以根据需要微调。
                    </p>
                  </div>
                  <button
                    onClick={() => onGenerateThreeView(character.id, threeViewPrompt)}
                    disabled={isThreeViewGenerating}
                    className="w-full py-3 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[var(--accent)]/20"
                  >
                    {isThreeViewGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        生成中...
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4" />
                        {isThreeViewCompleted ? '重新生成' : '开始生成'}
                      </>
                    )}
                  </button>
                </div>

                {/* Right: Preview */}
                <div className="flex-1 bg-[var(--bg-surface)] border border-[var(--border-primary)] rounded-lg flex items-center justify-center overflow-hidden aspect-video relative group">
                  {qVersion?.threeView?.imageUrl ? (
                    <>
                      <img
                        src={qVersion.threeView.imageUrl}
                        alt="Q-Version Three View"
                        className="w-full h-full object-cover cursor-pointer"
                        onClick={() => onImageClick(qVersion.threeView!.imageUrl!)}
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                        <p className="text-white text-sm font-bold flex items-center gap-2">
                          <ImageIcon className="w-4 h-4" /> 点击预览大图
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="text-center text-[var(--text-muted)]">
                      <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">暂无生成结果</p>
                    </div>
                  )}
                </div>
              </div>
              
              {isThreeViewCompleted && (
                <div className="flex justify-end">
                  <button
                    onClick={() => setActiveTab('emotion-grid')}
                    className="px-6 py-2 bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] border border-[var(--border-secondary)] rounded-lg text-sm font-bold flex items-center gap-2 transition-all"
                  >
                    下一步：生成情绪九宫格 <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex gap-6 flex-col md:flex-row">
                {/* Left: Prompt Editor */}
                <div className="flex-1 space-y-4">
                  <div>
                    <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2 block">
                      生成提示词
                    </label>
                    <textarea
                      value={emotionGridPrompt}
                      onChange={(e) => setEmotionGridPrompt(e.target.value)}
                      className="w-full h-64 bg-[var(--bg-surface)] border border-[var(--border-secondary)] rounded-lg p-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] resize-none"
                      placeholder="输入提示词..."
                    />
                    <p className="text-xs text-[var(--text-muted)] mt-2">
                      基于已生成的 Q 版三视图，生成 9 种不同情绪的表情包。
                    </p>
                  </div>
                  <button
                    onClick={() => onGenerateEmotionGrid(character.id, emotionGridPrompt)}
                    disabled={isEmotionGridGenerating}
                    className="w-full py-3 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[var(--accent)]/20"
                  >
                    {isEmotionGridGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        生成中...
                      </>
                    ) : (
                      <>
                        <Grid3x3 className="w-4 h-4" />
                        {isEmotionGridCompleted ? '重新生成' : '生成表情包'}
                      </>
                    )}
                  </button>
                </div>

                {/* Right: Preview */}
                <div className="flex-1 bg-[var(--bg-surface)] border border-[var(--border-primary)] rounded-lg flex items-center justify-center overflow-hidden aspect-square relative group">
                  {qVersion?.emotionGrid?.imageUrl ? (
                    <>
                      <img
                        src={qVersion.emotionGrid.imageUrl}
                        alt="Q-Version Emotion Grid"
                        className="w-full h-full object-cover cursor-pointer"
                        onClick={() => onImageClick(qVersion.emotionGrid!.imageUrl!)}
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                        <p className="text-white text-sm font-bold flex items-center gap-2">
                          <ImageIcon className="w-4 h-4" /> 点击预览大图
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="text-center text-[var(--text-muted)]">
                      <Grid3x3 className="w-12 h-12 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">暂无生成结果</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QVersionModal;
