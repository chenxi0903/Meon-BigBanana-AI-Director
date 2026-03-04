import React, { useState } from 'react';
import { User, Check, Shirt, Trash2, Edit2, AlertCircle, FolderPlus, Grid3x3, LayoutGrid, Loader2, RefreshCw } from 'lucide-react';
import { Character } from '../../types';
import PromptEditor from './PromptEditor';
import ImageUploadButton from './ImageUploadButton';

interface CharacterCardProps {
  character: Character;
  isGenerating: boolean;
  isRegeneratingPrompt?: boolean;
  onGenerate: () => void;
  onStopGenerate?: () => void;
  onUpload: (file: File) => void;
  onPromptSave: (newPrompt: string) => void;
  onOpenWardrobe: () => void;
  onOpenTurnaround: () => void;
  onOpenThreeView: () => void;
  onImageClick: (imageUrl: string) => void;
  onDelete: () => void;
  onUpdateInfo: (updates: { name?: string; gender?: string; age?: string; personality?: string }) => void;
  onAddToLibrary: () => void;
  onReplaceFromLibrary: () => void;
  onRegeneratePrompt?: () => void;
  onSync?: () => void;
}

const CharacterCard: React.FC<CharacterCardProps> = ({
  character,
  isGenerating,
  isRegeneratingPrompt = false,
  onGenerate,
  onStopGenerate,
  onUpload,
  onPromptSave,
  onOpenWardrobe,
  onOpenTurnaround,
  onOpenThreeView,
  onImageClick,
  onDelete,
  onUpdateInfo,
  onAddToLibrary,
  onReplaceFromLibrary,
  onRegeneratePrompt,
  onSync,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingGender, setIsEditingGender] = useState(false);
  const [isEditingAge, setIsEditingAge] = useState(false);
  const [editName, setEditName] = useState(character.name);
  const [editGender, setEditGender] = useState(character.gender);
  const [editAge, setEditAge] = useState(character.age);

  const handleSaveName = () => {
    if (editName.trim()) {
      onUpdateInfo({ name: editName.trim() });
      setIsEditingName(false);
    }
  };

  const handleSaveGender = () => {
    if (editGender.trim()) {
      onUpdateInfo({ gender: editGender.trim() });
      setIsEditingGender(false);
    }
  };

  const handleSaveAge = () => {
    if (editAge.trim()) {
      onUpdateInfo({ age: editAge.trim() });
      setIsEditingAge(false);
    }
  };

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-primary)] rounded-xl overflow-hidden flex flex-col group hover:border-[var(--border-secondary)] transition-all hover:shadow-lg">
      <div className="flex gap-4 p-4 pb-0">
        {/* Character Image */}
        <div className="w-48 flex-shrink-0">
          <div 
            className={`${character.referenceImage ? 'bg-[var(--bg-elevated)]' : 'aspect-video bg-[var(--bg-elevated)]'} relative rounded-lg overflow-hidden cursor-pointer ${character.referenceImage ? 'flex items-center justify-center' : ''}`}
            onClick={() => character.referenceImage && onImageClick(character.referenceImage)}
          >
            {character.referenceImage ? (
              <>
                <img src={character.referenceImage} alt={character.name} className="w-full h-auto max-h-48 object-contain" />
                <div className="absolute top-1.5 right-1.5 p-1 bg-[var(--accent)] text-[var(--text-primary)] rounded shadow-lg">
                  <Check className="w-3 h-3" />
                </div>
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-[var(--text-muted)] p-2 text-center">
                {character.status === 'failed' ? (
                  <>
                    <AlertCircle className="w-8 h-8 mb-2 text-[var(--error)]" />
                    <span className="text-[10px] text-[var(--error)] mb-2">生成失败</span>
                    <ImageUploadButton
                      variant="inline"
                      size="small"
                      onUpload={onUpload}
                      onGenerate={onGenerate}
                      onStop={onStopGenerate}
                      isGenerating={isGenerating}
                      uploadLabel="上传"
                      generateLabel="重试"
                    />
                  </>
                ) : (
                  <>
                    <User className="w-8 h-8 mb-2 opacity-10" />
                    <ImageUploadButton
                      variant="inline"
                      size="small"
                      onUpload={onUpload}
                      onGenerate={onGenerate}
                      onStop={onStopGenerate}
                      isGenerating={isGenerating}
                      uploadLabel="上传"
                      generateLabel="生成"
                    />
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Character Info & Actions */}
        <div className="flex-1 flex flex-col min-w-0 justify-between">
          {/* Header */}
          <div>
            {isEditingName ? (
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={handleSaveName}
                onKeyPress={(e) => e.key === 'Enter' && handleSaveName()}
                autoFocus
                className="font-bold text-[var(--text-primary)] text-base mb-1 bg-[var(--bg-hover)] border border-[var(--border-secondary)] rounded px-2 py-1 w-full focus:outline-none focus:border-[var(--accent)]"
              />
            ) : (
              <div className="flex items-center gap-2 mb-1 group/name">
                <h3 className="font-bold text-[var(--text-primary)] text-base">{character.name}</h3>
                {character.source === 'reused' && (
                  <span className="text-[9px] text-[var(--text-tertiary)] bg-[var(--bg-elevated)] border border-[var(--border-primary)] px-1.5 py-0.5 rounded">
                    复用
                  </span>
                )}
                <button
                  onClick={() => {
                    setEditName(character.name);
                    setIsEditingName(true);
                  }}
                  className="opacity-0 group-hover/name:opacity-100 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-opacity"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              {isEditingGender ? (
                <input
                  type="text"
                  value={editGender}
                  onChange={(e) => setEditGender(e.target.value)}
                  onBlur={handleSaveGender}
                  onKeyPress={(e) => e.key === 'Enter' && handleSaveGender()}
                  autoFocus
                  className="text-[10px] text-[var(--text-primary)] font-mono uppercase bg-[var(--bg-hover)] border border-[var(--border-secondary)] px-2 py-0.5 rounded focus:outline-none focus:border-[var(--accent)] w-20"
                />
              ) : (
                <span
                  onClick={() => {
                    setEditGender(character.gender);
                    setIsEditingGender(true);
                  }}
                  className="text-[10px] text-[var(--text-tertiary)] font-mono uppercase bg-[var(--bg-elevated)] px-2 py-0.5 rounded cursor-pointer hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)] transition-colors"
                >
                  {character.gender}
                </span>
              )}
              {isEditingAge ? (
                <input
                  type="text"
                  value={editAge}
                  onChange={(e) => setEditAge(e.target.value)}
                  onBlur={handleSaveAge}
                  onKeyPress={(e) => e.key === 'Enter' && handleSaveAge()}
                  autoFocus
                  className="text-[10px] text-[var(--text-primary)] bg-[var(--bg-hover)] border border-[var(--border-secondary)] px-2 py-0.5 rounded focus:outline-none focus:border-[var(--accent)] w-20"
                />
              ) : (
                <span
                  onClick={() => {
                    setEditAge(character.age);
                    setIsEditingAge(true);
                  }}
                  className="text-[10px] text-[var(--text-tertiary)] cursor-pointer hover:text-[var(--text-secondary)] transition-colors"
                >
                  {character.age}
                </span>
              )}
              {character.variations && character.variations.length > 0 && (
                <span className="text-[9px] text-[var(--text-tertiary)] font-mono flex items-center gap-1 bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded">
                  <Shirt className="w-2.5 h-2.5" /> +{character.variations.length}
                </span>
              )}
            </div>
          </div>

          {/* Actions Row */}
          <div className="flex flex-col gap-2 mt-2">
            <div className="flex gap-2">
              <button 
                onClick={onOpenWardrobe}
                className="flex-1 py-1.5 bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 border border-[var(--border-primary)] transition-colors"
              >
                <Shirt className="w-3 h-3" />
                服装变体
              </button>

              <button 
                onClick={onOpenThreeView}
                disabled={character.threeView?.status === 'generating'}
                className={`flex-1 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 border transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                  character.threeView?.status === 'completed'
                    ? 'bg-[var(--accent-bg)] hover:bg-[var(--accent-hover-bg)] text-[var(--accent-text)] border-[var(--accent-border)]'
                    : 'bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] border-[var(--border-primary)]'
                }`}
              >
                {character.threeView?.status === 'generating' ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <LayoutGrid className="w-3 h-3" />
                )}
                三视图生成
                {character.threeView?.status === 'completed' && (
                  <Check className="w-2.5 h-2.5" />
                )}
              </button>
            </div>

            {/* Turnaround Sheet Button */}
            <button 
              onClick={onOpenTurnaround}
              className={`w-full py-1.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 border transition-colors ${
                character.turnaround?.status === 'completed'
                  ? 'bg-[var(--accent-bg)] hover:bg-[var(--accent-hover-bg)] text-[var(--accent-text)] border-[var(--accent-border)]'
                  : 'bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] border-[var(--border-primary)]'
              }`}
            >
              <Grid3x3 className="w-3 h-3" />
              造型九宫格
              {character.turnaround?.status === 'completed' && (
                <Check className="w-2.5 h-2.5" />
              )}
            </button>

            {/* Upload Button */}
            {character.referenceImage && (
              <div className="w-full">
                <ImageUploadButton
                  variant="separate"
                  hasImage={true}
                  onUpload={onUpload}
                  onGenerate={onGenerate}
                  onStop={onStopGenerate}
                  isGenerating={isGenerating}
                  uploadLabel="上传"
                />
              </div>
            )}

            {character.source === 'reused' && onSync && (
              <button
                onClick={onSync}
                disabled={isGenerating}
                className="w-full py-1.5 bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--accent)] hover:text-[var(--accent-hover)] rounded text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 border border-[var(--border-primary)] hover:border-[var(--accent)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="同步主角色形象"
              >
                <RefreshCw className="w-3 h-3" />
                同步形象
              </button>
            )}

            <button
              onClick={onReplaceFromLibrary}
              disabled={isGenerating}
              className="w-full py-1.5 bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 border border-[var(--border-primary)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <FolderPlus className="w-3 h-3" />
              从资产库替换
            </button>
          </div>
        </div>
      </div>

      {/* Prompt Section & Generate Button */}
      <div className="p-4 flex-1 flex flex-col">
        {/* Prompt Section */}
        <div className="flex-1 mb-3">
          <PromptEditor
            prompt={character.visualPrompt || ''}
            onSave={onPromptSave}
            label="角色提示词"
            placeholder="输入角色的视觉描述..."
            onRegenerate={onRegeneratePrompt}
            isRegenerating={isRegeneratingPrompt}
          />
        </div>

        <button
          onClick={onAddToLibrary}
          disabled={isGenerating}
          className="w-full py-2 mt-2 bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-primary)] rounded text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <FolderPlus className="w-3 h-3" />
          加入资产库
        </button>

        {/* Delete Button */}
        <button
          onClick={onDelete}
          disabled={isGenerating}
          className="w-full py-2 mt-2 bg-transparent hover:bg-[var(--error-bg)] text-[var(--error-text)] hover:text-[var(--error-text)] border border-[var(--error-border)] hover:border-[var(--error-border)] rounded text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Trash2 className="w-3 h-3" />
          删除角色
        </button>
      </div>
    </div>
  );
};

export default CharacterCard;
