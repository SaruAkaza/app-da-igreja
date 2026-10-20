import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Colors, Spacing, Typography } from '../theme/colors';
import { User } from '../services/api';

interface HeaderStreakBannerProps {
  user: User | null;
  onOpenAccountSwitcher?: () => void;
  onOpenMenuDrawer?: () => void;
  onPressChurchBadge?: () => void;
}

export const HeaderStreakBanner: React.FC<HeaderStreakBannerProps> = ({
  user,
  onOpenAccountSwitcher,
  onOpenMenuDrawer,
  onPressChurchBadge,
}) => {
  if (!user) return null;

  const streak = user.current_streak || 0;
  const points = user.total_points || 0;

  return (
    <View style={styles.container}>
      {/* Linha Superior: Botão Trocar Usuário / Sair no canto superior esquerdo + Badge de Pontos no canto direito */}
      <View style={styles.topControlRow}>
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={onOpenAccountSwitcher}
          style={styles.switchUserButton}
          accessibilityLabel="Trocar ou encerrar usuário"
        >
          <Text style={styles.switchUserIcon}>👥</Text>
          <Text style={styles.switchUserText}>Trocar / Sair</Text>
        </TouchableOpacity>

        <View style={styles.pointsBadge}>
          <Text style={styles.pointsLabel}>PONTOS</Text>
          <Text style={styles.pointsValue}>{points.toLocaleString('pt-BR')}</Text>
        </View>
      </View>

      {/* Linha Principal do Perfil: Foto + Três Barrinhas Abaixo da Foto + Identificação da Igreja Evidente Próxima ao Nome */}
      <View style={styles.profileSection}>
        {/* Coluna da Foto com as 3 Barrinhas Logo Abaixo */}
        <View style={styles.avatarColumn}>
          <Image
            source={{
              uri:
                user.avatar_url ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=2563eb&color=fff&size=150`,
            }}
            style={styles.avatar}
          />
          {/* Três Barrinhas (Menu Hambúrguer) posicionado logo abaixo da foto */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onOpenMenuDrawer}
            style={styles.hamburgerBtn}
            accessibilityLabel="Abrir menu de opções e células"
          >
            <Text style={styles.hamburgerIcon}>☰</Text>
            <Text style={styles.hamburgerText}>Menu</Text>
          </TouchableOpacity>
        </View>

        {/* Informações do Usuário com Igreja Evidente Próxima ao Nome */}
        <View style={styles.userInfoColumn}>
          <Text style={styles.greeting}>A paz do Senhor,</Text>
          <Text style={styles.userName} numberOfLines={1}>
            {user.name} {user.last_name ? user.last_name : ''}
          </Text>

          {user.username_handle ? (
            <Text style={styles.userHandle}>{user.username_handle}</Text>
          ) : null}

          {/* Identificação da Igreja Evidente Próxima ao Nome */}
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={onPressChurchBadge}
            style={styles.churchIdentityPill}
          >
            <Text style={styles.churchEmoji}>⛪</Text>
            <Text style={styles.churchIdentityName} numberOfLines={1}>
              {user.church_name || 'Vincular Congregação'}
            </Text>
            {user.church_code ? (
              <View style={styles.churchCodeTag}>
                <Text style={styles.churchCodeTagText}>{user.church_code}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>
      </View>

      {/* Card da Sequência de Fé (Streak) */}
      <View style={styles.streakCard}>
        <View style={styles.streakLeft}>
          <Text style={styles.streakFlame}>🔥</Text>
          <View>
            <Text style={styles.streakNumber}>
              {streak} {streak === 1 ? 'dia' : 'dias'}
            </Text>
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
    backgroundColor: '#ffffff',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  topControlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  switchUserButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceSecondary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  switchUserIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  switchUserText: {
    fontSize: Typography.caption,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  pointsBadge: {
    backgroundColor: Colors.primarySurface,
    borderRadius: 14,
    paddingVertical: 4,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  pointsLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  pointsValue: {
    fontSize: Typography.bodyLarge,
    fontWeight: '900',
    color: Colors.primaryDark,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  avatarColumn: {
    alignItems: 'center',
    marginRight: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: Colors.primarySurface,
  },
  hamburgerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginTop: 6,
  },
  hamburgerIcon: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '900',
    marginRight: 3,
  },
  hamburgerText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  userInfoColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  greeting: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  userName: {
    fontSize: Typography.titleMedium,
    fontWeight: '800',
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  userHandle: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 1,
    marginBottom: 4,
  },
  churchIdentityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  churchEmoji: {
    fontSize: 12,
    marginRight: 4,
  },
  churchIdentityName: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  churchCodeTag: {
    backgroundColor: Colors.primarySurface,
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginLeft: 6,
  },
  churchCodeTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.primary,
  },
  streakCard: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 16,
    padding: Spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  streakLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  streakFlame: {
    fontSize: 24,
    marginRight: 8,
  },
  streakNumber: {
    fontSize: Typography.bodyLarge,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  streakSubtitle: {
    fontSize: Typography.caption,
    color: Colors.textSecondary,
  },
  streakRight: {
    alignItems: 'flex-end',
  },
  streakMotivation: {
    fontSize: Typography.caption,
    color: Colors.primary,
    fontWeight: '700',
  },
});
