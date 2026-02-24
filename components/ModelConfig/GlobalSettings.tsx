/**
 * 全局配置组件
 * 包含 API Key 配置和折扣广告
 */

import React from 'react';
import { ExternalLink, Gift, Sparkles } from 'lucide-react';

interface GlobalSettingsProps {
  onRefresh: () => void;
}

const GlobalSettings: React.FC<GlobalSettingsProps> = ({ onRefresh }) => {
  return (
    <div className="space-y-6">
      {/* 折扣广告卡片 */}
      <div className="bg-[var(--accent-bg)] border border-[var(--accent-border)] rounded-xl p-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-[var(--accent)] flex items-center justify-center flex-shrink-0">
            <Gift className="w-6 h-6 text-[var(--text-primary)]" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-[var(--text-primary)] mb-1 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[var(--warning-text)]" />
              推荐使用 Meon API
            </h3>
            <p className="text-xs text-[var(--text-tertiary)] mb-3 leading-relaxed">
              支持 GPT-5.1、GPT-5.2、Claude Sonnet 4.5、Gemini-3、Veo 3.1、Sora-2 等多种模型。
              稳定快速，价格优惠。本项目由 Meon API 提供支持。
            </p>
            <div className="flex items-center gap-3">
              <a 
                href="https://api.antsk.cn" 
                target="_blank" 
                rel="noreferrer"
                className="px-4 py-2 bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] text-xs font-bold rounded-lg hover:bg-[var(--btn-primary-hover)] transition-colors inline-flex items-center gap-1.5"
              >
                立即购买
                <ExternalLink className="w-3 h-3" />
              </a>
              <a 
                href="https://ocnf8yod3ljg.feishu.cn/wiki/MgFVw2EoQieTLKktaf2cHvu6nY3" 
                target="_blank" 
                rel="noreferrer"
                className="px-4 py-2 bg-[var(--bg-hover)] text-[var(--text-secondary)] text-xs font-bold rounded-lg hover:bg-[var(--border-secondary)] transition-colors inline-flex items-center gap-1.5"
              >
                使用教程
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* 提示 */}
      <div className="p-4 bg-[var(--bg-elevated)]/50 rounded-lg border border-[var(--border-primary)]">
        <h4 className="text-xs font-bold text-[var(--text-tertiary)] mb-2">配置说明</h4>
        <ul className="text-[10px] text-[var(--text-muted)] space-y-1 list-disc list-inside">
          <li>你可以在各模型类别中调整模型参数（温度、Token 等）</li>
          <li>支持添加自定义模型，使用其他 API 服务</li>
          <li>所有配置仅保存在本地浏览器，不会上传到服务器</li>
        </ul>
      </div>
    </div>
  );
};

export default GlobalSettings;
