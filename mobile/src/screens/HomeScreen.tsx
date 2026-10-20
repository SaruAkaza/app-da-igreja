import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
  Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Spacing, Typography } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { HeaderStreakBanner } from '../components/HeaderStreakBanner';
import { AccessibleButton } from '../components/AccessibleButton';
import { api, Group } from '../services/api';

export const HomeScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user, refreshProfile, logout } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      await refreshProfile();
      const res = await api.get('/api/groups/my');
      setGroups(res.data);
    } catch (e) {
      console.error('Erro ao carregar dados da Home:', e);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const todayCompleted = user?.completed_today;

  return (
    <SafeAreaView style={styles.safeArea}>
      <HeaderStreakBanner user={user} />

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
        }
      >
        {/* Card de Ação Principal do Dia (Super Acessível) */}
        <View style={[styles.actionCard, todayCompleted ? styles.actionCardDone : styles.actionCardPending]}>
          <View style={styles.actionHeader}>
            <Text style={styles.actionIcon}>{todayCompleted ? '🌟' : '📖'}</Text>
            <View style={styles.actionHeaderText}>
              <Text style={styles.actionTitle}>
                {todayCompleted ? 'Devocional de Hoje Concluído!' : 'Devocional Diário de Hoje'}
              </Text>
              <Text style={styles.actionSubtitle}>
                {todayCompleted
                  ? 'Glória a Deus! Você já enviou sua folha de anotação hoje e manteve sua chama acesa.'
                  : 'Abra sua Bíblia ou livro de estudo, anote suas reflexões no caderno e envie a foto da folha.'}
              </Text>
            </View>
          </View>

          {todayCompleted ? (
            <AccessibleButton
              title="👥 Ver o Feed dos Irmãos"
              subtitle="Veja o que os outros irmãos aprenderam hoje"
              variant="outline"
              onPress={() => navigation.navigate('Feed')}
              style={styles.actionBtn}
            />
          ) : (
            <AccessibleButton
              title="📸 Tirar Foto da Folha de Hoje"
              subtitle="Ganhe +50 pts e bônus de constância 🔥"
              variant="success"
              onPress={() => navigation.navigate('Capture')}
              style={styles.actionBtn}
            />
          )}
        </View>

        {/* Atalho para Recompensas do Trimestre */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => navigation.navigate('Rewards')}
          style={styles.rewardsBanner}
        >
          <View style={styles.rewardsLeft}>
            <Text style={styles.rewardsIcon}>🎁</Text>
            <View>
              <Text style={styles.rewardsTitle}>Recompensas do 1º Trimestre</Text>
              <Text style={styles.rewardsSubtitle}>
                Você tem {user?.total_points || 0} pontos acumulados
              </Text>
            </View>
          </View>
          <Text style={styles.rewardsArrow}>Ver Prêmios ›</Text>
        </TouchableOpacity>

        {/* Seção Meus Grupos de Leitura */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Meus Grupos de Estudo</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Explore')}>
            <Text style={styles.sectionLink}>+ Explorar Grupos</Text>
          </TouchableOpacity>
        </View>

        {groups.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📚</Text>
            <Text style={styles.emptyText}>Você ainda não está em nenhum grupo.</Text>
            <AccessibleButton
              title="Entrar em um Grupo de Estudo"
              onPress={() => navigation.navigate('Explore')}
              style={{ marginTop: 12 }}
            />
          </View>
        ) : (
          groups.map((group) => (
            <TouchableOpacity
              key={group.id}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('Feed', { groupId: group.id, groupTitle: group.title })}
              style={styles.groupCard}
            >
              <Image source={{ uri: group.cover_image }} style={styles.groupCover} />
              <View style={styles.groupContent}>
                <View style={styles.groupTopRow}>
                  <Text style={styles.groupCategory}>
                    {group.category === 'biblia' ? '📖 BÍBLIA' : '📕 LIVRO'}
                  </Text>
                  {group.posted_today && (
                    <View style={styles.postedBadge}>
                      <Text style={styles.postedBadgeText}>Hoje Feito ✅</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.groupTitle} numberOfLines={1}>
                  {group.title}
                </Text>
                <Text style={styles.groupTheme} numberOfLines={1}>
                  {group.book_or_theme}
                </Text>
                <View style={styles.groupFooter}>
                  <Text style={styles.groupStats}>
                    👥 {group.member_count} irmãos • 📝 {group.devotional_count} folhas
                  </Text>
                  <Text style={styles.groupOpenText}>Ver Feed ›</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}

        {/* Versículo Inspirador */}
        <View style={styles.verseCard}>
          <Text style={styles.verseText}>
            "Lâmpada para os meus pés é tua palavra e luz, para o meu caminho."
          </Text>
          <Text style={styles.verseRef}>Salmos 119:105</Text>
        </View>

        {/* Botão de Logout Acessível no final */}
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Text style={styles.logoutBtnText}>Encerrar Sessão / Trocar de Usuário</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContainer: {
    padding: Spacing.md,
  },
  actionCard: {
    borderRadius: 24,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 2,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  actionCardPending: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
  },
  actionCardDone: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  actionHeader: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
  },
  actionIcon: {
    fontSize: 36,
    marginRight: 12,
  },
  actionHeaderText: {
    flex: 1,
  },
  actionTitle: {
    fontSize: Typography.titleMedium,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  actionSubtitle: {
    fontSize: Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: 4,
    lineHeight: 20,
  },
  actionBtn: {
    minHeight: 60,
  },
  rewardsBanner: {
    backgroundColor: Colors.accentSurface,
    borderRadius: 18,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
    borderWidth: 1.5,
    borderColor: Colors.accentLight,
  },
  rewardsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rewardsIcon: {
    fontSize: 28,
    marginRight: 10,
  },
  rewardsTitle: {
    fontSize: Typography.bodyMedium,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  rewardsSubtitle: {
    fontSize: Typography.bodySmall,
    color: Colors.accent,
    fontWeight: '600',
    marginTop: 2,
  },
  rewardsArrow: {
    fontSize: Typography.bodyMedium,
    fontWeight: '800',
    color: Colors.accent,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: Typography.titleMedium,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  sectionLink: {
    fontSize: Typography.bodySmall,
    fontWeight: '700',
    color: Colors.primary,
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: Typography.bodyMedium,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  groupCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    elevation: 2,
  },
  groupCover: {
    width: '100%',
    height: 120,
  },
  groupContent: {
    padding: Spacing.md,
  },
  groupTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  groupCategory: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  postedBadge: {
    backgroundColor: Colors.successSurface,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  postedBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.success,
  },
  groupTitle: {
    fontSize: Typography.titleMedium,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  groupTheme: {
    fontSize: Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: 2,
    marginBottom: Spacing.sm,
  },
  groupFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 8,
  },
  groupStats: {
    fontSize: Typography.bodySmall,
    color: Colors.textMuted,
  },
  groupOpenText: {
    fontSize: Typography.bodySmall,
    fontWeight: '700',
    color: Colors.primary,
  },
  verseCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  verseText: {
    fontSize: Typography.bodyMedium,
    fontStyle: 'italic',
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  verseRef: {
    fontSize: Typography.bodySmall,
    fontWeight: '800',
    color: Colors.primary,
    marginTop: 6,
  },
  logoutBtn: {
    marginVertical: Spacing.xl,
    alignItems: 'center',
    padding: Spacing.md,
  },
  logoutBtnText: {
    fontSize: Typography.bodySmall,
    color: Colors.textMuted,
    fontWeight: '600',
  },
});
