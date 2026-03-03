import React, { useState } from 'react';
import { Users, ChevronDown, ChevronRight } from 'lucide-react';
import { Character } from '../../types';
import InlineEditor from './InlineEditor';

interface Props {
  characters: Character[];
  editingCharacterId: string | null;
  editingPrompt: string;
  onEdit: (charId: string, prompt: string) => void;
  onSave: (charId: string, prompt: string) => void;
  onCancel: () => void;
}

const CharacterList: React.FC<Props> = ({
  characters,
  editingCharacterId,
  editingPrompt,
  onEdit,
  onSave,
  onCancel
}) => {
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({});

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest flex items-center gap-2">
          <Users className="w-3 h-3" /> 演员表
        </h3>
      </div>
      <div className="space-y-3">
        {characters.map(c => {
          const isCollapsed = collapsedMap[c.id] ?? true;
          const isExpanded = !isCollapsed || editingCharacterId === c.id;

          return (
            <div key={c.id} className="group cursor-default p-3 rounded-lg hover:bg-[var(--nav-hover-bg)] transition-colors border border-transparent hover:border-[var(--border-primary)]">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm text-[var(--text-secondary)] font-medium group-hover:text-[var(--text-primary)]">{c.name}</span>
                    <span className="text-[10px] text-[var(--text-muted)] font-mono">{c.gender}</span>
                    <button
                      onClick={() => setCollapsedMap((prev) => ({ ...prev, [c.id]: !isExpanded }))}
                      className="p-1 hover:bg-[var(--bg-hover)] rounded transition-colors"
                      title={isExpanded ? '收起提示词' : '展开提示词'}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-3 h-3 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]" />
                      ) : (
                        <ChevronRight className="w-3 h-3 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]" />
                      )}
                    </button>
                  </div>
                  {isExpanded && (
                    <InlineEditor
                      isEditing={editingCharacterId === c.id}
                      value={editingCharacterId === c.id ? editingPrompt : c.visualPrompt || ''}
                      displayValue={c.visualPrompt}
                      onEdit={() => {
                        setCollapsedMap((prev) => ({ ...prev, [c.id]: false }));
                        onEdit(c.id, c.visualPrompt || '');
                      }}
                      onChange={(val) => onEdit(c.id, val)}
                      onSave={() => onSave(c.id, editingPrompt)}
                      onCancel={onCancel}
                      placeholder="输入角色视觉描述..."
                      rows={6}
                      mono={true}
                      emptyText="暂无视觉描述"
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default CharacterList;
