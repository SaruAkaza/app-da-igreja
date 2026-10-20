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
        {/* Identificação da Igreja */}
        <View style={styles.churchBadgeCard}>
          <Text style={styles.churchEmoji}>⛪</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.churchName}>{user?.church_name || 'Igreja Parceira'}</Text>
            <Text style={styles.churchCode}>Código da congregação: {user?.church_code}</Text>
          </View>
        </View>

        {/* Card Alerta de Orientação Pastoral / Discipulado */}
        {user?.feedbacks_count && user.feedbacks_count > 0 ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Feedbacks')}
            style={styles.pastoralAlertCard}
          >
            <Text style={styles.pastoralAlertEmoji}>💌</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.pastoralAlertTitle}>
                Você tem {user.feedbacks_count} dica(s) bíblica(s) do seu líder!
              </Text>
              <Text style={styles.pastoralAlertSub}>
                Toque aqui para ler as orientações pastorais enviadas para você.
              </Text>
            </View>
            <Text style={styles.pastoralAlertArrow}>Ler ›</Text>
          </TouchableOpacity>
        ) : null}

        {/* Card de Ação Principal do Dia */}
        <View style={[styles.actionCard, todayCompleted ? styles.actionCardDone : styles.actionCardPending]}>
          <View style={styles.actionHeader}>
            <Text style={styles.actionIcon}>{todayCompleted ? '🌟' : '📖'}</Text>
            <View style={styles.actionHeaderText}>
              <Text style={styles.actionTitle}>
                {todayCompleted ? 'Devocional de Hoje Concluído!' : 'Devocional Diário de Hoje'}
              </Text>
              <Text style={styles.actionSubtitle}>
                {todayCompleted
                  ? 'Glória a Deus! Sua anotação foi enviada em sigilo ao líder e sua chama continua acesa.'
                  : 'Abra sua Bíblia ou livro de estudo, anote suas reflexões no caderno e fotografe a folha.'}
              </Text>
            </View>
          </View>

          {todayCompleted ? (
            <AccessibleButton
              title="👥 Ver o Feed dos Irmãos"
              subtitle="Veja quem cumpriu a leitura hoje na igreja"
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

        {/* Atalhos: Batalha de Células & Prêmios */}
        <View style={styles.shortcutsRow}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation.navigate('GroupsRanking')}
            style={styles.shortcutBox}
          >
            <Text style={styles.shortcutIcon}>🏆</Text>
            <Text style={styles.shortcutTitle}>Batalha de Células</Text>
            <Text style={styles.shortcutSub}>Ranking dos grupos</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Rewards')}
            style={styles.shortcutBox}
          >
            <Text style={styles.shortcutIcon}>🎁</Text>
            <Text style={styles.shortcutTitle}>Meus Prêmios</Text>
            <Text style={styles.shortcutSub}>{user?.total_points || 0} pontos</Text>
          </TouchableOpacity>
        </View>

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
                  Líder Discipulador: {group.leader_name || 'Pastor'}
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

        {/* Botão de Logout */}
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
  churchBadgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  churchEmoji: {
    fontSize: 24,
    marginRight: 10,
  },
  churchName: {
    fontSize: Typography.bodyLarge,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  churchCode: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  pastoralAlertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.successSurface,
    borderWidth: 1.5,
    borderColor: '#86efac',
    borderRadius: 18,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  pastoralAlertEmoji: {
    fontSize: 28,
    marginRight: 12,
  },
  pastoralAlertTitle: {
    fontSize: Typography.bodyMedium,
    fontWeight: '800',
    color: '#14532d',
  },
  pastoralAlertSub: {
    fontSize: Typography.bodySmall,
    color: Colors.success,
    marginTop: 2,
  },
  pastoralAlertArrow: {
    fontSize: Typography.titleMedium,
    fontWeight: '900',
    color: Colors.success,
    marginLeft: 6,
  },
  actionCard: {
    borderRadius: 24,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 2,
    elevation: 3,
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
  shortcutsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  shortcutBox: {
    flex: 1,
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  shortcutIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  shortcutTitle: {
    fontSize: Typography.bodyMedium,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  shortcutSub: {
    fontSize: Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: 2,
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
