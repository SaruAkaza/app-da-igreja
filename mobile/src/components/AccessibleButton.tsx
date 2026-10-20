import React from 'react';
import {
ActivityIndicator,
StyleSheet,
Text,
TextStyle,
TouchableOpacity,
View,
ViewStyle,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Colors,Spacing,Typography } from '../theme/colors';

interface AccessibleButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'accent' | 'outline';
  icon?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  subtitle?: string;
}

export const AccessibleButton: React.FC<AccessibleButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  style,
  textStyle,
  subtitle,
}) => {
  const { isSeniorMode } = useAuth();
  const getBackgroundColor = () => {
    if (disabled) return Colors.borderStrong;
    switch (variant) {
      case 'primary': return Colors.primary;
      case 'secondary': return Colors.surfaceAlt;
      case 'success': return Colors.success;
      case 'danger': return Colors.danger;
      case 'accent': return Colors.accent;
      case 'outline': return 'transparent';
      default: return Colors.primary;
    }
  };

  const getTextColor = () => {
    if (disabled) return Colors.textMuted;
    switch (variant) {
      case 'secondary': return Colors.textPrimary;
      case 'outline': return Colors.primary;
      default: return Colors.textInverted;
    }
  };

  const isOutline = variant === 'outline';

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        { backgroundColor: getBackgroundColor() },
        isOutline && { borderWidth: 2, borderColor: Colors.primary },
        style,
      ]}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <View style={styles.contentRow}>
          {icon && <View style={styles.iconContainer}>{icon}</View>}
          <View style={styles.textContainer}>
            <Text style={[styles.text, { color: getTextColor(), fontSize: isSeniorMode ? 22 : Typography.buttonText }, textStyle]}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={[styles.subtitle, { color: getTextColor() }]}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    minHeight: Spacing.touchMin,
    borderRadius: 16,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: Spacing.xs,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginRight: Spacing.sm,
  },
  textContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: Typography.buttonText,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Typography.bodySmall,
    fontWeight: '500',
    opacity: 0.85,
    marginTop: 2,
  },
});
