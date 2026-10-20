import { Alert as NativeAlert, Platform, type AlertButton, type AlertOptions } from 'react-native';
export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) {
    if (Platform.OS !== 'web') return NativeAlert.alert(title, message, buttons, options);
    const content = [title, message].filter(Boolean).join('\n\n');
    if (buttons && buttons.length > 1) {
      const confirmed = window.confirm(content);
      const button = confirmed ? buttons.find(b => b.style !== 'cancel') : buttons.find(b => b.style === 'cancel');
      button?.onPress?.();
    } else { window.alert(content); buttons?.[0]?.onPress?.(); }
  },
};
