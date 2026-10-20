import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Colors, Spacing, Typography } from '../theme/colors';
import { User } from '../services/api';

interface HeaderStreakBannerProps {
  user: User | null;
  onPressProfile?: () => void;
}

export const HeaderStreakBanner: React.FC<HeaderStreakBannerProps> = ({ user }) => {
  if (!user) return null;

  const streak = user.current_streak || 0;
  const points = user.total_points || 0;

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.userProfile}>
          <Image
            source={{
              uri: user.avatar_url || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
            }}
            style={styles.avatar}
          />
          <View>
            <Text style={styles.greeting}>A paz do Senhor,</Text>
            <Text style={styles.userName} numberOfLines={1}>
              {user.name}
            </Text>
          </View>
        </View>

        <View style={styles.pointsBadge}>
          <Text style={styles.pointsLabel}>PONTOS</Text>
          <Text style={styles.pointsValue}>{points.toLocaleString('pt-BR')}</Text>
        </View>
      </View>

      <View style={styles.streakCard}>
        <View style={styles.streakLeft}>
          <Text style={styles.streakFlame}>🔥</Text>
          <View>
            <Text style={styles.streakNumber}>{streak} {streak === 1 ? 'dia' : 'dias'}</Text>
            <Text style={styles.streakSubtitle}>Sequência de Fé & Leitura</Text>
          </View>
        </View>
        <View style={styles.streakRight}>
          <Text style={styles.streakMotivation}>
            {streak >= 30
              ? '🏆 Exemplo de fidelidade!'
              : streak >= 7
              ? '✨ Hábito consolidado!'
              : streak >= 1
              ? '🌱 Firme no propósito!'
              : '📖 Comece seu dia hoje!'}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  userProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.sm,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: Spacing.sm,
    borderWidth: 2,
    borderColor: Colors.primarySurface,
  },
  greeting: {
    fontSize: Typography.bodySmall,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  userName: {
    fontSize: Typography.titleMedium,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  pointsBadge: {
    backgroundColor: Colors.accentSurface,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.accentLight,
    alignItems: 'center',
  },
  pointsLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.accent,
    letterSpacing: 0.5,
  },
  pointsValue: {
    fontSize: Typography.bodyLarge,
    fontWeight: '800',
    color: Colors.accent,
  },
  streakCard: {
    backgroundColor: Colors.fireLight,
    borderRadius: 16,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  streakLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  streakFlame: {
    fontSize: 32,
    marginRight: Spacing.sm,
  },
  streakNumber: {
    fontSize: Typography.titleLarge,
    fontWeight: '800',
    color: Colors.fire,
    lineHeight: 26,
  },
  streakSubtitle: {
    fontSize: Typography.bodySmall,
    fontWeight: '600',
    color: '#9a3412',
  },
  streakRight: {
    alignItems: 'flex-end',
  },
  streakMotivation: {
    fontSize: Typography.bodySmall,
    fontWeight: '700',
    color: Colors.fire,
  },
});
