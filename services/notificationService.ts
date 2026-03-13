
const NOTIFICATION_ENABLED_KEY = 'meon_notification_enabled';
const NOTIFICATION_POPUP_SHOWN_KEY = 'meon_notification_popup_shown';

export interface NotificationOptions {
  body?: string;
  icon?: string;
  image?: string;
  tag?: string;
}

/**
 * Initialize notification service
 */
export const initNotification = () => {
  // Check if browser supports notifications
  if (!('Notification' in window)) {
    console.warn('This browser does not support desktop notification');
    return;
  }
};

/**
 * Request notification permission
 * @returns Promise<boolean> true if granted
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) {
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      setNotificationEnabled(true);
      return true;
    } else {
      setNotificationEnabled(false);
      return false;
    }
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return false;
  }
};

/**
 * Send a notification
 */
export const sendNotification = (title: string, options?: NotificationOptions) => {
  if (!isNotificationEnabled()) {
    return;
  }

  if (!('Notification' in window)) {
    return;
  }

  if (Notification.permission === 'granted') {
    try {
      new Notification(title, {
        icon: '/logo.png', // Default logo
        ...options,
      });
    } catch (e) {
      console.error('Error sending notification:', e);
    }
  }
};

/**
 * Check if notification is enabled in settings
 */
export const isNotificationEnabled = (): boolean => {
  try {
    const stored = localStorage.getItem(NOTIFICATION_ENABLED_KEY);
    return stored === 'true';
  } catch (e) {
    return false;
  }
};

/**
 * Set notification enabled setting
 */
export const setNotificationEnabled = (enabled: boolean) => {
  try {
    localStorage.setItem(NOTIFICATION_ENABLED_KEY, String(enabled));
  } catch (e) {
    console.error('Error saving notification setting:', e);
  }
};

/**
 * Check if the initial setup popup should be shown
 */
export const shouldShowInitialPopup = (): boolean => {
  try {
    // If permission is already granted or denied, don't show (unless we want to push for it, but user requirement says "after update")
    // Actually, user requirement says "Open website pop-up remind user new notification function...".
    // So we should check if we have shown this specific popup before.
    
    const shown = localStorage.getItem(NOTIFICATION_POPUP_SHOWN_KEY);
    if (shown === 'true') return false;

    // Also check if browser supports it
    if (!('Notification' in window)) return false;

    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Mark the initial popup as shown
 */
export const markInitialPopupShown = () => {
  try {
    localStorage.setItem(NOTIFICATION_POPUP_SHOWN_KEY, 'true');
  } catch (e) {
    console.error('Error saving notification popup state:', e);
  }
};
