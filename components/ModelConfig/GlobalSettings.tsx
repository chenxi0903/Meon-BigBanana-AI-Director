/**
 * 全局配置组件
 * 包含即梦反代全局配置
 */

import React, { useState, useEffect } from 'react';
import { getJimengGlobalConfig, setJimengGlobalConfig } from '../../services/modelRegistry';
import { 
  isNotificationEnabled, 
  setNotificationEnabled, 
  requestNotificationPermission 
} from '../../services/notificationService';
import { Bell, BellOff } from 'lucide-react';

interface GlobalSettingsProps {
  onRefresh: () => void;
}

const GlobalSettings: React.FC<GlobalSettingsProps> = ({ onRefresh }) => {
  const [jimengBaseUrl, setJimengBaseUrl] = useState('');
  const [jimengSessionToken, setJimengSessionToken] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');

  useEffect(() => {
    const config = getJimengGlobalConfig();
    setJimengBaseUrl(config.baseUrl || '');
    setJimengSessionToken(config.sessionToken || '');
    
    setNotificationsEnabled(isNotificationEnabled());
    if ('Notification' in window) {
      setPermissionStatus(Notification.permission);
    }
  }, []);

  const handleSave = () => {
    setJimengGlobalConfig({
      baseUrl: jimengBaseUrl.trim(),
      sessionToken: jimengSessionToken.trim(),
    });
    onRefresh();
  };

  const toggleNotifications = async () => {
    if (!notificationsEnabled) {
      // Trying to enable
      if (permissionStatus === 'default') {
        const granted = await requestNotificationPermission();
        if (granted) {
          setNotificationsEnabled(true);
          setPermissionStatus('granted');
          setNotificationEnabled(true);
        }
      } else if (permissionStatus === 'granted') {
        setNotificationsEnabled(true);
        setNotificationEnabled(true);
      } else {
        // denied
        alert('浏览器通知权限已被拒绝。请在浏览器设置中允许通知权限。');
      }
    } else {
      // Trying to disable
      setNotificationsEnabled(false);
      setNotificationEnabled(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 通知设置 */}
      <div className="p-4 bg-[var(--bg-elevated)]/50 rounded-lg border border-[var(--border-primary)]">
        <h4 className="text-xs font-bold text-[var(--text-primary)] mb-3 flex items-center gap-2">
          <Bell className="w-3 h-3" />
          系统通知
        </h4>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] text-[var(--text-primary)] font-medium">
              任务完成通知
            </p>
            <p className="text-[9px] text-[var(--text-muted)]">
              当视频或图片生成完成时，通过浏览器发送系统通知
            </p>
          </div>
          <button
            onClick={toggleNotifications}
            className={`
              relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2
              ${notificationsEnabled ? 'bg-[var(--accent)]' : 'bg-[var(--bg-base)] border border-[var(--border-secondary)]'}
            `}
          >
            <span
              className={`
                inline-block h-3 w-3 transform rounded-full bg-white transition-transform
                ${notificationsEnabled ? 'translate-x-5' : 'translate-x-1'}
              `}
            />
          </button>
        </div>
        {permissionStatus === 'denied' && (
          <p className="text-[9px] text-[var(--error)] mt-2 flex items-center gap-1">
            <BellOff className="w-3 h-3" />
            通知权限已被拒绝，请在浏览器设置中手动开启
          </p>
        )}
      </div>

      {/* 即梦反代全局配置 */}
      <div className="p-4 bg-[var(--bg-elevated)]/50 rounded-lg border border-[var(--border-primary)]">
        <h4 className="text-xs font-bold text-[var(--text-primary)] mb-3">即梦反代全局配置</h4>
        <p className="text-[10px] text-[var(--text-muted)] mb-4">
          配置后，所有即梦模型将使用此全局配置的服务器地址和 Session Token。
        </p>
        
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">
              反代服务器地址
            </label>
            <input
              type="text"
              value={jimengBaseUrl}
              onChange={(e) => setJimengBaseUrl(e.target.value)}
              placeholder="例如: http://localhost:5100 或 http://your-ip:5100"
              className="w-full bg-[var(--bg-hover)] border border-[var(--border-secondary)] rounded px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] font-mono"
            />
            <p className="text-[9px] text-[var(--text-muted)] mt-1">
              即梦反代服务的完整地址（包含协议和端口）
            </p>
          </div>

          <div>
            <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">
              Session Token
            </label>
            <input
              type="password"
              value={jimengSessionToken}
              onChange={(e) => setJimengSessionToken(e.target.value)}
              placeholder="输入即梦 Session Token（支持地区前缀和代理前缀）"
              className="w-full bg-[var(--bg-hover)] border border-[var(--border-secondary)] rounded px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] font-mono"
            />
            <p className="text-[9px] text-[var(--text-muted)] mt-1">
              格式: [代理URL@][地区前缀-]session_id
            </p>
          </div>

          <button
            onClick={handleSave}
            className="w-full px-4 py-2 bg-[var(--accent)] text-[var(--text-primary)] text-xs font-bold rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
          >
            保存配置
          </button>
        </div>
      </div>

      {/* 提示 */}
      <div className="p-4 bg-[var(--bg-elevated)]/50 rounded-lg border border-[var(--border-primary)]">
        <h4 className="text-xs font-bold text-[var(--text-tertiary)] mb-2">配置说明</h4>
        <ul className="text-[10px] text-[var(--text-muted)] space-y-1 list-disc list-inside">
          <li>你可以在各模型类别中调整模型参数（温度、Token 等）</li>
          <li>支持添加自定义模型，使用其他 API 服务</li>
          <li>所有配置仅保存在本地浏览器，不会上传到服务器</li>
          <li>即梦反代配置对所有即梦模型生效，无需在每个模型中单独配置</li>
        </ul>
      </div>
    </div>
  );
};

export default GlobalSettings;
