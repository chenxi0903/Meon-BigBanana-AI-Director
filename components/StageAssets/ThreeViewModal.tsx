import React from 'react';
import { X, LayoutGrid, Loader2, Check } from 'lucide-react';
import { Character } from '../../types';

interface ThreeViewModalProps {
  character: Character;
  modelOptions: { id: string; name: string }[];
  selectedModelId: string;
  showModelSelector: boolean;
  onSelectModelId: (id: string) => void;
  onGenerate: () => void;
  onClose: () => void;
  onImageClick: (imageUrl: string) => void;
}

const ThreeViewModal: React.FC<ThreeViewModalProps> = ({
  character,
  modelOptions,
  selectedModelId,
  showModelSelector,
  onSelectModelId,
  onGenerate,
  onClose,
  onImageClick,
}) => {
  const threeView = character.threeView;
  const isGenerating = threeView?.status === 'generating';
  const isCompleted = threeView?.status === 'completed' && !!threeView?.imageUrl;
  const hasFailed = threeView?.status === 'failed';

  return (
    <div
      className="absolute inset-0 z-40 bg-[var(--bg-base)]/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg-elevated)] border border-[var(--border-secondary)] rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-14 px-6 border-b border-[var(--border-primary)] flex items-center justify-between bg-[var(--bg-surface)] shrink-0">
          <div className="flex items-center gap-3">
            <LayoutGrid className="w-4 h-4 text-[var(--accent-text)]" />
            <h3 className="text-sm font-bold text-[var(--text-primary)]">
              {character.name} - 三视图生成
            </h3>
            {isCompleted && (
              <span className="text-[10px] text-[var(--success-text)] font-bold uppercase tracking-wider bg-[var(--success-bg)] px-2 py-0.5 rounded border border-[var(--success-border)] flex items-center gap-1.5">
                <Check className="w-3 h-3" />
                已完成
              </span>
            )}
            {hasFailed && (
              <span className="text-[10px] text-[var(--error-text)] font-bold uppercase tracking-wider bg-[var(--error-bg)] px-2 py-0.5 rounded border border-[var(--error-border)]">
                失败
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--error-hover-bg)] rounded text-[var(--text-tertiary)] hover:text-[var(--error-text)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {showModelSelector && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                图片模型
              </div>
              <select
                value={selectedModelId}
                onChange={(e) => onSelectModelId(e.target.value)}
                disabled={isGenerating}
                className="w-full px-3 py-2 bg-[var(--bg-deep)] border border-[var(--border-primary)] rounded text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-secondary)] disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {modelOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.id})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={onGenerate}
              disabled={isGenerating || (showModelSelector && !selectedModelId)}
              className="px-5 py-2.5 bg-[var(--btn-primary-bg)] hover:bg-[var(--btn-primary-hover)] text-[var(--btn-primary-text)] rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-[var(--btn-primary-shadow)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <LayoutGrid className="w-4 h-4" />}
              {isCompleted ? '重新生成三视图' : '生成三视图'}
            </button>
            {isGenerating && (
              <div className="text-xs text-[var(--text-tertiary)] flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                正在生成...
              </div>
            )}
          </div>

          {threeView?.imageUrl ? (
            <div className="space-y-2">
              <div className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                预览
              </div>
              <div
                className="w-full bg-[var(--bg-deep)] border border-[var(--border-primary)] rounded-xl overflow-hidden cursor-pointer hover:border-[var(--border-secondary)] transition-colors"
                onClick={() => onImageClick(threeView.imageUrl!)}
              >
                <img src={threeView.imageUrl} className="w-full h-auto object-contain" alt="three-view" />
              </div>
            </div>
          ) : (
            <div className="border border-dashed border-[var(--border-primary)] rounded-xl p-10 text-center text-[var(--text-muted)] text-sm">
              生成完成后将在此显示三视图设计图，可点击放大预览。
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ThreeViewModal;

