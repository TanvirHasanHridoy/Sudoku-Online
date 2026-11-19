import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { App as CapApp } from '@capacitor/app';

// Safe check if running in Capacitor native runtime
export const isNativePlatform = () => {
  return typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() === true;
};

// Haptic feedback utilities
export const mobileHaptics = {
  // Light touch for cell selection & keyboard taps
  light: async () => {
    try {
      if (isNativePlatform()) {
        await Haptics.impact({ style: ImpactStyle.Light });
      } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(8);
      }
    } catch {
      // Ignore unsupported platforms
    }
  },

  // Medium touch for actions (Undo, Redo, Notes toggle)
  medium: async () => {
    try {
      if (isNativePlatform()) {
        await Haptics.impact({ style: ImpactStyle.Medium });
      } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(15);
      }
    } catch {
      // Ignore unsupported platforms
    }
  },

  // Double buzz for incorrect move / strike
  error: async () => {
    try {
      if (isNativePlatform()) {
        await Haptics.notification({ type: NotificationType.Error });
      } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([40, 60, 40]);
      }
    } catch {
      // Ignore unsupported platforms
    }
  },

  // Celebratory fanfare for puzzle solve / match win
  success: async () => {
    try {
      if (isNativePlatform()) {
        await Haptics.notification({ type: NotificationType.Success });
      } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([30, 50, 60, 50, 100]);
      }
    } catch {
      // Ignore unsupported platforms
    }
  },

  // Alert vibration for incoming sabotage attack (Ink, Scramble)
  warning: async () => {
    try {
      if (isNativePlatform()) {
        await Haptics.notification({ type: NotificationType.Warning });
      } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([60, 40, 60]);
      }
    } catch {
      // Ignore unsupported platforms
    }
  },

  // Micro tick for scrubbing ink splatters
  tick: async () => {
    try {
      if (isNativePlatform()) {
        await Haptics.impact({ style: ImpactStyle.Light });
      } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(3);
      }
    } catch {
      // Ignore unsupported platforms
    }
  }
};

// Screen Wake Lock utilities
export const mobileScreen = {
  keepAwake: async () => {
    try {
      if (isNativePlatform()) {
        await KeepAwake.keepAwake();
      } else if ('wakeLock' in navigator) {
        // Web WakeLock API fallback
        await navigator.wakeLock.request('screen').catch(() => {});
      }
    } catch {
      // Ignore unsupported platforms
    }
  },

  allowSleep: async () => {
    try {
      if (isNativePlatform()) {
        await KeepAwake.allowSleep();
      }
    } catch {
      // Ignore unsupported platforms
    }
  }
};

// App lifecycle & deep link listeners
export const initMobileListeners = ({ onUrlOpen, onBackButton }) => {
  if (!isNativePlatform()) return () => {};

  let urlSub = null;
  let backSub = null;

  try {
    if (onUrlOpen) {
      urlSub = CapApp.addListener('appUrlOpen', (event) => {
        onUrlOpen(event.url);
      });
    }

    if (onBackButton) {
      backSub = CapApp.addListener('backButton', (data) => {
        onBackButton(data);
      });
    }
  } catch (err) {
    console.warn('[MobileBridge] Error initializing listeners:', err);
  }

  return () => {
    urlSub?.then((s) => s.remove?.());
    backSub?.then((s) => s.remove?.());
  };
};
