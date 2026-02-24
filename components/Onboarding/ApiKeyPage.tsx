import React from 'react';

/**
 * @deprecated
 * This component is no longer used as Global API Key support has been removed.
 * Keeping this file to avoid file deletion if not desired, but functionality is disabled.
 */
const ApiKeyPage: React.FC<any> = () => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
        功能已移除
      </h2>
      <p className="text-[var(--text-tertiary)]">
        全局 API Key 配置已不再支持。请在模型配置中单独设置 API Key。
      </p>
    </div>
  );
};

export default ApiKeyPage;