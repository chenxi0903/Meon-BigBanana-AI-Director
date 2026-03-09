import React, { useEffect, useMemo, useState } from 'react';
import { Edit3, Save, AlertCircle, Camera, Sparkles, Loader2, Search, X } from 'lucide-react';
import { chatCompletion, cleanJsonString } from '../../services/ai/apiCore';
import { getChatModels, isModelAvailable } from '../../services/modelRegistry';

interface PromptEditorProps {
  prompt: string;
  onSave: (newPrompt: string) => void;
  label?: string;
  placeholder?: string;
  maxHeight?: string;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
  enableAudit?: boolean;
}

const PromptEditor: React.FC<PromptEditorProps> = ({
  prompt,
  onSave,
  label = '提示词',
  placeholder = '输入视觉描述...',
  maxHeight = 'max-h-[260px]',
  onRegenerate,
  isRegenerating = false,
  enableAudit = false,
}) => {
  type AuditReplacement = { from: string; to: string };

  const [isEditing, setIsEditing] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState(prompt);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [selectedAuditModelId, setSelectedAuditModelId] = useState('');
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditSafe, setAuditSafe] = useState<boolean | null>(null);
  const [auditOriginalPrompt, setAuditOriginalPrompt] = useState('');
  const [auditResultPrompt, setAuditResultPrompt] = useState<string | null>(null);
  const [auditReplacements, setAuditReplacements] = useState<AuditReplacement[]>([]);

  const handleStartEdit = () => {
    setIsEditing(true);
    setEditedPrompt(prompt || '');
  };

  const handleSave = () => {
    onSave(editedPrompt.trim());
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedPrompt(prompt || '');
  };

  const auditModelOptions = useMemo(() => {
    const models = getChatModels()
      .filter(m => (m.providerId === 'volcengine' || m.id.toLowerCase().includes('doubao') || (m.apiModel || '').toLowerCase().includes('doubao')))
      .filter(m => isModelAvailable(m.id));
    return models.map(m => ({ id: m.id, name: m.name, apiModel: m.apiModel }));
  }, [isAuditOpen]);

  useEffect(() => {
    if (!isAuditOpen) return;
    if (selectedAuditModelId && auditModelOptions.some(m => m.id === selectedAuditModelId)) return;
    setSelectedAuditModelId(auditModelOptions[0]?.id || '');
  }, [isAuditOpen, selectedAuditModelId, auditModelOptions]);

  const handleOpenAudit = () => {
    setAuditError(null);
    setAuditSafe(null);
    setAuditOriginalPrompt('');
    setAuditResultPrompt(null);
    setAuditReplacements([]);
    setIsAuditOpen(true);
  };

  const handleCloseAudit = () => {
    if (isAuditing) return;
    setIsAuditOpen(false);
    setAuditError(null);
    setAuditSafe(null);
    setAuditOriginalPrompt('');
    setAuditResultPrompt(null);
    setAuditReplacements([]);
  };

  const deriveSingleReplacement = (before: string, after: string): AuditReplacement[] => {
    const a = before || '';
    const b = after || '';
    if (a === b) return [];
    const maxPrefix = Math.min(a.length, b.length);
    let start = 0;
    while (start < maxPrefix && a[start] === b[start]) start++;
    let endA = a.length - 1;
    let endB = b.length - 1;
    while (endA >= start && endB >= start && a[endA] === b[endB]) {
      endA--;
      endB--;
    }
    const from = a.slice(start, endA + 1).trim();
    const to = b.slice(start, endB + 1).trim();
    if (!from && !to) return [];
    return [{ from, to }];
  };

  const handleRunAudit = async () => {
    const currentPrompt = (prompt || '').trim();
    if (!currentPrompt) {
      setAuditError('当前提示词为空，无法审核。');
      return;
    }
    if (!selectedAuditModelId) {
      setAuditError('请选择一个可用的 Doubao 模型。');
      return;
    }

    setIsAuditing(true);
    setAuditError(null);
    setAuditSafe(null);
    try {
      setAuditOriginalPrompt(currentPrompt);
      const auditPrompt = `你是提示词安全审核器。请检查输入提示词中是否包含敏感词汇；如有，请仅删除或替换为更安全的表达（不要进行细化/扩写/格式化，不要改变无关内容）。\n\n只输出 JSON：\n{\n  "safe": boolean,\n  "prompt": string,\n  "replacements": [{ "from": string, "to": string }]\n}\n\n规则：\n- 若无需修改：safe=true，prompt=原文，replacements=[]。\n- 若需要修改：safe=false，prompt=修改后的完整提示词。\n- replacements 只包含实际发生的替换/删除；删除时 to 为空字符串。\n- 不要输出除 JSON 以外的任何内容。\n\n输入提示词：\n${currentPrompt}`;
      const result = await chatCompletion(auditPrompt, selectedAuditModelId, 0.2, 4096, 'json_object');
      const raw = (result || '').trim();
      if (!raw) {
        setAuditError('模型返回为空，请重试或更换模型。');
        return;
      }

      let parsed: any = null;
      try {
        parsed = JSON.parse(cleanJsonString(raw));
      } catch {
        parsed = null;
      }

      if (parsed && typeof parsed === 'object') {
        const revisedPrompt = String(parsed.prompt ?? '').trim();
        const replacementsRaw = Array.isArray(parsed.replacements)
          ? parsed.replacements
          : Array.isArray(parsed.changes)
            ? parsed.changes
            : [];
        const replacements: AuditReplacement[] = replacementsRaw
          .map((r: any) => ({
            from: String(r?.from ?? '').trim(),
            to: String(r?.to ?? '').trim(),
          }))
          .filter((r: AuditReplacement) => !!r.from || !!r.to);
        const safe = typeof parsed.safe === 'boolean'
          ? parsed.safe
          : (replacements.length === 0 && revisedPrompt === currentPrompt);

        if (!revisedPrompt) {
          setAuditError('模型返回解析失败，请重试或更换模型。');
          return;
        }

        setAuditSafe(safe);
        setAuditResultPrompt(revisedPrompt);
        setAuditReplacements(replacements.length > 0 ? replacements : (safe ? [] : deriveSingleReplacement(currentPrompt, revisedPrompt)));

        if (!safe && revisedPrompt !== currentPrompt) {
          onSave(revisedPrompt);
        }
        return;
      }

      const cleaned = raw;
      if (cleaned === currentPrompt) {
        setAuditSafe(true);
        setAuditResultPrompt(currentPrompt);
        setAuditReplacements([]);
        return;
      }
      setAuditSafe(false);
      setAuditResultPrompt(cleaned);
      setAuditReplacements(deriveSingleReplacement(currentPrompt, cleaned));
      onSave(cleaned);
    } catch (e: any) {
      setAuditError(e?.message || '审核失败，请重试。');
    } finally {
      setIsAuditing(false);
    }
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <label className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest flex items-center gap-1.5">
          <Camera className="w-3 h-3" />
          {label}
        </label>
        {!isEditing && (
          <div className="flex items-center gap-1">
            {onRegenerate && (
              <button
                onClick={onRegenerate}
                disabled={isRegenerating}
                className="text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors p-1 hover:bg-[var(--bg-hover)] rounded disabled:opacity-50 disabled:cursor-not-allowed"
                title={isRegenerating ? '正在生成提示词' : `重新生成${label}`}
              >
                {isRegenerating ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
              </button>
            )}
            {enableAudit && (
              <button
                onClick={handleOpenAudit}
                disabled={isRegenerating}
                className="text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors p-1 hover:bg-[var(--bg-hover)] rounded disabled:opacity-50 disabled:cursor-not-allowed"
                title="提示词审核"
              >
                <Search className="w-3 h-3" />
              </button>
            )}
            {isRegenerating && (
              <span className="text-[9px] text-[var(--warning-text)] font-mono flex items-center gap-1">
                生成中
              </span>
            )}
            <button
              onClick={handleStartEdit}
              className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors p-1 hover:bg-[var(--bg-hover)] rounded"
              title="编辑提示词"
            >
              <Edit3 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {isEditing ? (
        <div className="flex-1 flex flex-col gap-2">
          <textarea
            value={editedPrompt}
            onChange={(e) => setEditedPrompt(e.target.value)}
            className={`flex-1 bg-[var(--bg-base)] border border-[var(--accent)] text-[var(--text-primary)] px-3 py-2 text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--accent)] resize-none font-mono leading-relaxed min-h-[140px] ${maxHeight}`}
            placeholder={placeholder}
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex-1 py-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--text-primary)] rounded text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
            >
              <Save className="w-3 h-3" />
              保存
            </button>
            <button
              onClick={handleCancel}
              className="flex-1 py-1.5 bg-[var(--bg-hover)] hover:bg-[var(--border-secondary)] text-[var(--text-secondary)] rounded text-[10px] font-bold uppercase tracking-wider transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        <div className={`flex-1 bg-[var(--nav-hover-bg)] border border-[var(--border-primary)] rounded-lg p-3 overflow-y-auto ${maxHeight}`}>
          {prompt ? (
            <p className="text-[11px] text-[var(--text-tertiary)] leading-relaxed font-mono">
              {prompt}
            </p>
          ) : (
            <div className="flex items-start gap-2 text-[var(--text-muted)]">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p className="text-[10px] leading-relaxed">
                未设置提示词。点击编辑按钮添加视觉描述。
              </p>
            </div>
          )}
        </div>
      )}

      {isAuditOpen && (
        <div
          className="fixed inset-0 z-50 bg-[var(--bg-base)]/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={handleCloseAudit}
        >
          <div
            className="bg-[var(--bg-elevated)] border border-[var(--border-secondary)] rounded-xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-14 px-5 border-b border-[var(--border-primary)] flex items-center justify-between bg-[var(--bg-surface)]">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-[var(--accent-text)]" />
                <h3 className="text-sm font-bold text-[var(--text-primary)]">提示词审核</h3>
              </div>
              <button
                onClick={handleCloseAudit}
                disabled={isAuditing}
                className="p-2 hover:bg-[var(--bg-hover)] rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {auditModelOptions.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                    Doubao 模型
                  </div>
                  <select
                    value={selectedAuditModelId}
                    onChange={(e) => setSelectedAuditModelId(e.target.value)}
                    disabled={isAuditing}
                    className="w-full px-3 py-2 bg-[var(--bg-deep)] border border-[var(--border-primary)] rounded text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-secondary)] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {auditModelOptions.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.apiModel || m.id})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="text-xs text-[var(--text-tertiary)] leading-relaxed">
                  暂无可用的 Doubao 对话模型。请在“模型配置”中启用 Doubao 模型并配置 API Key。
                </div>
              )}

              {auditError && (
                <div className="text-xs text-[var(--error-text)] bg-[var(--error-bg)] border border-[var(--error-border)] rounded-lg px-3 py-2">
                  {auditError}
                </div>
              )}

              {auditSafe === true && (
                <div className="text-xs text-[var(--success-text)] bg-[var(--success-bg)] border border-[var(--success-border)] rounded-lg px-3 py-2">
                  提示词很安全
                </div>
              )}

              {auditSafe === false && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                      替换部分
                    </div>
                    {auditReplacements.length > 0 ? (
                      <div className="space-y-1">
                        {auditReplacements.map((r, idx) => (
                          <div
                            key={`${idx}-${r.from}-${r.to}`}
                            className="text-[11px] text-[var(--text-tertiary)] font-mono bg-[var(--bg-deep)] border border-[var(--border-primary)] rounded px-2 py-1 whitespace-pre-wrap break-words"
                          >
                            {r.to ? (
                              <>
                                <span className="text-[var(--text-primary)]">{r.from}</span>
                                <span className="mx-2 text-[var(--text-muted)]">→</span>
                                <span className="text-[var(--accent-text)]">{r.to}</span>
                              </>
                            ) : (
                              <>
                                <span className="text-[var(--text-primary)]">{r.from}</span>
                                <span className="ml-2 text-[var(--text-muted)]">(已删除)</span>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-[var(--text-tertiary)]">
                        已替换，但未返回可展示的替换明细。
                      </div>
                    )}
                  </div>

                  {auditResultPrompt && (
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                        替换后提示词
                      </div>
                      <div className="text-[11px] text-[var(--text-tertiary)] font-mono bg-[var(--nav-hover-bg)] border border-[var(--border-primary)] rounded-lg px-3 py-2 whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                        {auditResultPrompt}
                      </div>
                    </div>
                  )}

                  {auditOriginalPrompt && auditResultPrompt && auditOriginalPrompt !== auditResultPrompt && (
                    <div className="text-[10px] text-[var(--text-muted)] font-mono">
                      已自动应用替换到当前提示词。
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleRunAudit}
                  disabled={isAuditing || auditModelOptions.length === 0}
                  className="flex-1 py-2 bg-[var(--btn-primary-bg)] hover:bg-[var(--btn-primary-hover)] text-[var(--btn-primary-text)] rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-[var(--btn-primary-shadow)] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isAuditing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  开始审核
                </button>
                <button
                  onClick={handleCloseAudit}
                  disabled={isAuditing}
                  className="flex-1 py-2 bg-[var(--bg-hover)] hover:bg-[var(--border-secondary)] text-[var(--text-secondary)] rounded-lg text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PromptEditor;
