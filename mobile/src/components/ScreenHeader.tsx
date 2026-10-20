import React from 'react';
import { StyleSheet,Text,TouchableOpacity,View } from 'react-native';
import { Colors,Spacing,Typography } from '../theme/colors';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  navigation: any;
  showHomeButton?: boolean;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  subtitle,
  navigation,
  showHomeButton = true,
}) => {
  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('MainTabs', { screen: 'Home' });
    }
  };

  const handleHome = () => {
    navigation.navigate('MainTabs', { screen: 'Home' });
  };

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleBack}
          style={styles.navButton}
          accessibilityLabel="Voltar para a tela anterior"
        >
          <Text style={styles.navButtonIcon}>←</Text>
          <Text style={styles.navButtonText}>Voltar</Text>
        </TouchableOpacity>

        <View style={styles.titleContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {showHomeButton ? (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleHome}
            style={styles.navButton}
            accessibilityLabel="Ir para a tela inicial"
          >
            <Text style={styles.navButtonIcon}>🏠</Text>
            <Text style={styles.navButtonText}>Início</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 46,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: Colors.surfaceSecondary,
  },
  navButtonIcon: {
    fontSize: 16,
    marginRight: 4,
    color: Colors.primary,
    fontWeight: '700',
  },
  navButtonText: {
    fontSize: Typography.bodySmall,
    fontWeight: '700',
    color: Colors.primary,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.xs,
  },
  title: {
    fontSize: Typography.titleMedium,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '500',
    marginTop: 2,
  },
});
