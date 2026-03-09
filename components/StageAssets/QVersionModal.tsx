
import React from 'react';
import { X, Loader2, ImagePlus, Grid3x3, LayoutGrid, AlertCircle, Wand2, ArrowRight } from 'lucide-react';
import { Character } from '../../types';

interface QVersionModalProps {
  character: Character;
  onClose: () => void;
  onGenerateThreeView: (charId: string) => void;
  onGenerateEmotions: (charId: string) => void;
  onImageClick: (imageUrl: string) => void;
}

const QVersionModal: React.FC<QVersionModalProps> = ({
  character,
  onClose,
  onGenerateThreeView,
  onGenerateEmotions,
  onImageClick,
}) => {
  const threeView = character.qVersion?.threeView;
  const emotions = character.qVersion?.emotions;

  const isThreeViewGenerating = threeView?.status === 'generating';
  const isEmotionsGenerating = emotions?.status === 'generating';
  
  const hasThreeView = threeView?.status === 'completed' && threeView.imageUrl;
  const hasEmotions = emotions?.status === 'completed' && emotions.imageUrl;

  const threeViewFailed = threeView?.status === 'failed';
  const emotionsFailed = emotions?.status === 'failed';

  return (
    <div
      className="absolute inset-0 z-40 bg-[var(--bg-base)]/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg-elevated)] border border-[var(--border-secondary)] rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-14 px-6 border-b border-[var(--border-primary)] flex items-center justify-between bg-[var(--bg-surface)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[var(--bg-hover)] overflow-hidden border border-[var(--border-secondary)]">
              {character.referenceImage && (
                <img src={character.referenceImage} className="w-full h-full object-cover" alt={character.name} />
              )}
            </div>
            <div className="flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-[var(--accent-text)]" />
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                {character.name} - Q版生成
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--error-hover-bg)] rounded text-[var(--text-tertiary)] hover:text-[var(--error-text)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
            
            {/* Left Column: Three View Generation */}
            <div className="flex flex-col h-full border border-[var(--border-primary)] rounded-lg bg-[var(--bg-surface)] overflow-hidden">
              <div className="p-3 border-b border-[var(--border-primary)] bg-[var(--bg-hover)] flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-[var(--text-secondary)]" />
                <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                  第一步：Q版三视图
                </h4>
              </div>
              
              <div className="flex-1 p-4 flex flex-col items-center justify-center relative min-h-[300px]">
                {hasThreeView ? (
                  <div className="w-full h-full flex flex-col">
                    <img 
                      src={threeView.imageUrl} 
                      alt="Q-Version Three View" 
                      className="w-full h-auto rounded-lg border border-[var(--border-primary)] cursor-pointer hover:opacity-90 transition-opacity mb-4"
                      onClick={() => onImageClick(threeView.imageUrl!)}
                    />
                    <button
                      onClick={() => onGenerateThreeView(character.id)}
                      disabled={isThreeViewGenerating || isEmotionsGenerating}
                      className="w-full py-2 bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-primary)] rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <ImagePlus className="w-3 h-3" />
                      重新生成三视图
                    </button>
                  </div>
                ) : isThreeViewGenerating ? (
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 text-[var(--accent)] animate-spin" />
                    <p className="text-xs text-[var(--text-tertiary)]">正在生成三视图...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4 text-center">
                    <div className="w-16 h-16 rounded-full bg-[var(--bg-hover)] flex items-center justify-center mb-2">
                      <LayoutGrid className="w-8 h-8 text-[var(--text-muted)]" />
                    </div>
                    {threeViewFailed && (
                      <p className="text-xs text-[var(--error)] font-bold flex items-center gap-1 mb-2">
                        <AlertCircle className="w-3 h-3" /> 生成失败，请重试
                      </p>
                    )}
                    <p className="text-xs text-[var(--text-tertiary)] max-w-[200px] mb-4">
                      基于角色参考图生成Q版三视图（正面、侧面、背面），作为表情包生成的基础。
                    </p>
                    <button
                      onClick={() => onGenerateThreeView(character.id)}
                      className="px-6 py-2 bg-[var(--btn-primary-bg)] hover:bg-[var(--btn-primary-hover)] text-[var(--btn-primary-text)] rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-[var(--btn-primary-shadow)]"
                    >
                      <Wand2 className="w-3 h-3" />
                      生成三视图
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Emotion 9-Grid Generation */}
            <div className={`flex flex-col h-full border border-[var(--border-primary)] rounded-lg bg-[var(--bg-surface)] overflow-hidden transition-opacity ${!hasThreeView ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="p-3 border-b border-[var(--border-primary)] bg-[var(--bg-hover)] flex items-center gap-2">
                <Grid3x3 className="w-4 h-4 text-[var(--text-secondary)]" />
                <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                  第二步：Q版表情九宫格
                </h4>
              </div>

              <div className="flex-1 p-4 flex flex-col items-center justify-center relative min-h-[300px]">
                {!hasThreeView ? (
                  <div className="flex flex-col items-center gap-4 text-center">
                     <div className="w-16 h-16 rounded-full bg-[var(--bg-hover)] flex items-center justify-center mb-2">
                      <Grid3x3 className="w-8 h-8 text-[var(--text-muted)]" />
                    </div>
                    <p className="text-xs text-[var(--text-muted)] max-w-[200px]">
                      请先完成左侧的三视图生成
                    </p>
                  </div>
                ) : hasEmotions ? (
                  <div className="w-full h-full flex flex-col">
                    <img 
                      src={emotions.imageUrl} 
                      alt="Q-Version Emotions" 
                      className="w-full h-auto rounded-lg border border-[var(--border-primary)] cursor-pointer hover:opacity-90 transition-opacity mb-4"
                      onClick={() => onImageClick(emotions.imageUrl!)}
                    />
                    <button
                      onClick={() => onGenerateEmotions(character.id)}
                      disabled={isEmotionsGenerating}
                      className="w-full py-2 bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-primary)] rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <ImagePlus className="w-3 h-3" />
                      重新生成表情包
                    </button>
                  </div>
                ) : isEmotionsGenerating ? (
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 text-[var(--accent)] animate-spin" />
                    <p className="text-xs text-[var(--text-tertiary)]">正在生成表情九宫格...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4 text-center">
                    <div className="w-16 h-16 rounded-full bg-[var(--bg-hover)] flex items-center justify-center mb-2">
                      <Grid3x3 className="w-8 h-8 text-[var(--text-muted)]" />
                    </div>
                    {emotionsFailed && (
                      <p className="text-xs text-[var(--error)] font-bold flex items-center gap-1 mb-2">
                        <AlertCircle className="w-3 h-3" /> 生成失败，请重试
                      </p>
                    )}
                    <p className="text-xs text-[var(--text-tertiary)] max-w-[200px] mb-4">
                      基于生成的Q版三视图，生成一套9个不同情绪的表情包。
                    </p>
                    <button
                      onClick={() => onGenerateEmotions(character.id)}
                      className="px-6 py-2 bg-[var(--accent-bg)] hover:bg-[var(--accent-hover-bg)] text-[var(--accent-text)] border border-[var(--accent-border)] rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2"
                    >
                      <Wand2 className="w-3 h-3" />
                      生成表情包
                    </button>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default QVersionModal;
