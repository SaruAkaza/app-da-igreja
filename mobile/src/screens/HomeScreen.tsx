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
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Spacing, Typography } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { HeaderStreakBanner } from '../components/HeaderStreakBanner';
import { AccessibleButton } from '../components/AccessibleButton';
import { api, Group } from '../services/api';
import { HomeMenuDrawer } from '../components/HomeMenuDrawer';
import { AccountSwitcherModal } from '../components/AccountSwitcherModal';
import { ProfileCompletionModal } from '../components/ProfileCompletionModal';

export const HomeScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user, refreshProfile, logout } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Status de Batalha de Células (Condicional)
  const [hasActiveBattle, setHasActiveBattle] = useState(false);
  const [battleTitle, setBattleTitle] = useState('Batalha de Células');

  // Modais
  const [menuDrawerVisible, setMenuDrawerVisible] = useState(false);
  const [accountSwitcherVisible, setAccountSwitcherVisible] = useState(false);
  const [profileCompletionVisible, setProfileCompletionVisible] = useState(false);

  const loadData = async () => {
    try {
      await refreshProfile();
      const [groupsRes, battleRes] = await Promise.all([
        api.get('/api/groups/my').catch(() => ({ data: [] })),
        api.get('/api/auth/battle-status').catch(() => ({ data: { has_active_battle: false } })),
      ]);

      setGroups(groupsRes.data || []);
      setHasActiveBattle(Boolean(battleRes.data?.has_active_battle));
      if (battleRes.data?.battle_title) {
        setBattleTitle(battleRes.data.battle_title);
      }
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
  const percent = user?.profile_completion_percent || 0;
  const is100Percent = percent >= 100;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Banner Superior com Trocar Usuário no canto esquerdo, Três Barrinhas abaixo da foto e Igreja ao lado do nome */}
      <HeaderStreakBanner
        user={user}
        onOpenAccountSwitcher={() => setAccountSwitcherVisible(true)}
        onOpenMenuDrawer={() => setMenuDrawerVisible(true)}
        onPressChurchBadge={() => setMenuDrawerVisible(true)}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
        }
      >
        {/* Caso o usuário ainda não tenha igreja vinculada */}
        {!user?.church_id ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setMenuDrawerVisible(true)}
            style={styles.unboundChurchCard}
          >
            <Text style={styles.unboundChurchEmoji}>⛪</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.unboundChurchTitle}>Vincule-se à sua Igreja</Text>
              <Text style={styles.unboundChurchSub}>
                Toque aqui para digitar o código de convite (ex: VIDEIRA26) ou código da sua célula.
              </Text>
            </View>
            <Text style={styles.unboundChurchArrow}>Inserir ›</Text>
          </TouchableOpacity>
        ) : null}

        {/* Card Interativo: Progresso do Perfil (0 a 100% com Bônus de +100 Pontos) */}
        {!is100Percent ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setProfileCompletionVisible(true)}
            style={styles.profileBonusCard}
          >
            <View style={styles.profileBonusTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.profileBonusBadge}>🎁 BÔNUS DE CADASTRO DISPONÍVEL</Text>
                <Text style={styles.profileBonusTitle}>
                  Seu perfil está {percent}% completo
                </Text>
                <Text style={styles.profileBonusSub}>
                  Complete os dados pendentes para ganhar +100 pontos de bônus imediato!
                </Text>
              </View>
              <Text style={styles.profileBonusPercent}>{percent}%</Text>
            </View>

            <View style={styles.profileTrack}>
              <View style={[styles.profileFill, { width: `${percent}%` }]} />
            </View>
          </TouchableOpacity>
        ) : null}

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
                  ? 'Glória a Deus! Sua anotação foi entregue ao líder em sigilo.'
                  : 'Abra sua Bíblia, anote suas reflexões no caderno e fotografe a folha.'}
              </Text>
            </View>
          </View>

          {todayCompleted ? (
            <AccessibleButton
              title="👥 Ver o Feed dos Irmãos"
              subtitle="Veja quem cumpriu a leitura hoje na congregação"
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

        {/* Atalhos: Batalha de Células (Habilitada Condicionalmente) & Meus Prêmios */}
        <View style={styles.shortcutsRow}>
          {hasActiveBattle ? (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => navigation.navigate('GroupsRanking')}
              style={[styles.shortcutBox, styles.shortcutBoxActive]}
            >
              <Text style={styles.shortcutIcon}>⚔️</Text>
              <View style={styles.shortcutTitleRow}>
                <Text style={styles.shortcutTitle}>Batalha de Células</Text>
                <View style={styles.activePill}>
                  <Text style={styles.activePillText}>Ativa</Text>
                </View>
              </View>
              <Text style={styles.shortcutSub}>Ranking e gincana dos grupos</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() =>
                Alert.alert(
                  'Batalha de Células',
                  'Esta função é ativada quando sua célula for inscrita em uma gincana bíblica ou quando você entrar em um grupo participante.\n\nToque em "Explorar Grupos" para participar de uma célula!'
                )
              }
              style={[styles.shortcutBox, styles.shortcutBoxDisabled]}
            >
              <Text style={styles.shortcutIcon}>🔒</Text>
              <Text style={[styles.shortcutTitle, { color: Colors.textMuted }]}>Batalha de Células</Text>
              <Text style={styles.shortcutSub}>Entrar em grupo participante</Text>
            </TouchableOpacity>
          )}

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
            <Text style={styles.emptyText}>Você ainda não está em nenhum grupo de estudo.</Text>
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
                  Tema: {group.book_or_theme}
                </Text>

                <View style={styles.groupFooter}>
                  <Text style={styles.groupMembers}>👥 {group.member_count || 1} membros</Text>
                  <Text style={styles.groupLeader} numberOfLines={1}>
                    Líder: {group.leader_name || 'Discipulador'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Drawer Lateral Acionado pelas 3 Barrinhas */}
      <HomeMenuDrawer
        visible={menuDrawerVisible}
        onClose={() => setMenuDrawerVisible(false)}
        navigation={navigation}
        hasActiveBattle={hasActiveBattle}
        battleTitle={battleTitle}
        onOpenAccountSwitcher={() => setAccountSwitcherVisible(true)}
        onOpenProfileCompletion={() => setProfileCompletionVisible(true)}
      />

      {/* Modal de Alternância Rápida de Contas Familiares */}
      <AccountSwitcherModal
        visible={accountSwitcherVisible}
        onClose={() => setAccountSwitcherVisible(false)}
        onAddAccount={() => logout()}
      />

      {/* Modal de Completar Perfil e Resgatar Bônus de 100 Pontos */}
      <ProfileCompletionModal
        visible={profileCompletionVisible}
        onClose={() => setProfileCompletionVisible(false)}
      />
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
    paddingBottom: Spacing.xl,
  },
  unboundChurchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 1.5,
    borderColor: '#93c5fd',
    borderRadius: 18,
    padding: 14,
    marginBottom: Spacing.md,
  },
  unboundChurchEmoji: {
    fontSize: 26,
    marginRight: 10,
  },
  unboundChurchTitle: {
    fontSize: Typography.bodyMedium,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  unboundChurchSub: {
    fontSize: Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  unboundChurchArrow: {
    color: Colors.primary,
    fontWeight: '800',
    fontSize: Typography.bodySmall,
    marginLeft: 6,
  },
  profileBonusCard: {
    backgroundColor: '#fffbeb',
    borderWidth: 1.5,
    borderColor: '#fde68a',
    borderRadius: 18,
    padding: 14,
    marginBottom: Spacing.md,
  },
  profileBonusTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  profileBonusBadge: {
    fontSize: 9,
    fontWeight: '800',
    color: '#b45309',
    letterSpacing: 0.5,
  },
  profileBonusTitle: {
    fontSize: Typography.bodyMedium,
    fontWeight: '800',
    color: '#78350f',
    marginTop: 2,
  },
  profileBonusSub: {
    fontSize: Typography.caption,
    color: '#92400e',
    marginTop: 2,
  },
  profileBonusPercent: {
    fontSize: Typography.titleLarge,
    fontWeight: '900',
    color: '#b45309',
    marginLeft: 10,
  },
  profileTrack: {
    height: 6,
    backgroundColor: '#fef3c7',
    borderRadius: 3,
    overflow: 'hidden',
  },
  profileFill: {
    height: '100%',
    backgroundColor: '#d97706',
  },
  pastoralAlertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fdf4ff',
    borderWidth: 1.5,
    borderColor: '#f0abfc',
    borderRadius: 18,
    padding: 14,
    marginBottom: Spacing.md,
  },
  pastoralAlertEmoji: {
    fontSize: 26,
    marginRight: 10,
  },
  pastoralAlertTitle: {
    fontSize: Typography.bodyMedium,
    fontWeight: '800',
    color: '#86198f',
  },
  pastoralAlertSub: {
    fontSize: Typography.caption,
    color: '#a21caf',
    marginTop: 2,
  },
  pastoralAlertArrow: {
    color: '#a21caf',
    fontWeight: '800',
    fontSize: Typography.bodySmall,
    marginLeft: 6,
  },
  actionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 22,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1.5,
  },
  actionCardPending: {
    borderColor: Colors.border,
  },
  actionCardDone: {
    borderColor: Colors.success,
    backgroundColor: '#f0fdf4',
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  actionIcon: {
    fontSize: 32,
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
    lineHeight: 18,
  },
  actionBtn: {
    width: '100%',
  },
  shortcutsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
    gap: 12,
  },
  shortcutBox: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  shortcutBoxActive: {
    borderColor: Colors.primaryLight,
    backgroundColor: '#faf5ff',
  },
  shortcutBoxDisabled: {
    backgroundColor: '#f8fafc',
    opacity: 0.8,
  },
  shortcutIcon: {
    fontSize: 26,
    marginBottom: 6,
  },
  shortcutTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shortcutTitle: {
    fontSize: Typography.bodyMedium,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  activePill: {
    backgroundColor: Colors.success,
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginLeft: 4,
  },
  activePillText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  shortcutSub: {
    fontSize: Typography.caption,
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
    color: Colors.primary,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: Spacing.xl,
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
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  groupCover: {
    width: 90,
    height: 100,
  },
  groupContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  groupTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  groupCategory: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.primary,
  },
  postedBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  postedBadgeText: {
    fontSize: 9,
    color: '#15803d',
    fontWeight: '800',
  },
  groupTitle: {
    fontSize: Typography.bodyMedium,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  groupTheme: {
    fontSize: Typography.caption,
    color: Colors.textSecondary,
  },
  groupFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  groupMembers: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  groupLeader: {
    fontSize: 10,
    color: Colors.primaryDark,
    fontWeight: '600',
    maxWidth: 120,
  },
});
