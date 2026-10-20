import { useFocusEffect } from 'expo-router';
import React,{ useCallback,useState } from 'react';
import {
RefreshControl,
SafeAreaView,
ScrollView,
StyleSheet,
Text,
View
} from 'react-native';
import { ScreenHeader } from '../components/ScreenHeader';
import { ActiveChallenge,api,GroupRanking } from '../services/api';
import { Colors,Spacing,Typography } from '../theme/colors';

export const GroupsRankingScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [groups, setGroups] = useState<GroupRanking[]>([]);
  const [challengeData, setChallengeData] = useState<ActiveChallenge | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [groupsRes, chalRes] = await Promise.all([
        api.get('/api/gamification/groups-ranking'),
        api.get('/api/gamification/challenge'),
      ]);
      setGroups(groupsRes.data);
      setChallengeData(chalRes.data);
    } catch (e) {
      console.error('Erro ao carregar ranking de grupos:', e);
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title="Batalha de Células"
        subtitle="Competição saudável e constância"
        navigation={navigation}
        showHomeButton={true}
      />
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.headerEmoji}>🏆</Text>
          <Text style={styles.title}>Batalha de Células & Grupos</Text>
          <Text style={styles.subtitle}>
            Competição saudável entre os grupos da nossa congregação. Quem liderar o trimestre ganha a premiação de comunhão!
          </Text>
        </View>

        {/* Gincana Inter-Igrejas Ativa (se houver) */}
        {challengeData?.active_challenge && (
          <View style={styles.challengeCard}>
            <View style={styles.challengeBadge}>
              <Text style={styles.challengeBadgeText}>🤝 GINCANA INTER-IGREJAS</Text>
            </View>
            <Text style={styles.challengeTitle}>{challengeData.active_challenge.title}</Text>
            <Text style={styles.challengeDesc}>{challengeData.active_challenge.description}</Text>

            <View style={styles.leaderboardBox}>
              <Text style={styles.leaderboardTitle}>Placar das Igrejas Parceiras:</Text>
              {challengeData.leaderboard.map((item) => (
                <View key={item.church_id} style={styles.leaderboardItem}>
                  <Text style={styles.itemBadge}>{item.badge}</Text>
                  <Text style={styles.itemChurchName}>{item.church_name}</Text>
                  <Text style={styles.itemPoints}>{Number(item.total_points_earned).toLocaleString('pt-BR')} pts</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Ranking de Grupos Internos */}
        <Text style={styles.sectionTitle}>Ranking das Células da Nossa Igreja</Text>

        {groups.map((group, index) => (
          <View
            key={group.id}
            style={[
              styles.groupRankCard,
              index === 0 && styles.firstPlaceCard,
            ]}
          >
            <View style={styles.cardTop}>
              <View style={[styles.posBadge, index === 0 && styles.firstPosBadge]}>
                <Text style={[styles.posText, index === 0 && styles.firstPosText]}>
                  {group.badge || `#${group.position}`}
                </Text>
              </View>
              <View style={styles.streakBadge}>
                <Text style={styles.streakText}>🔥 Média: {group.avg_streak} dias</Text>
              </View>
            </View>

            <Text style={styles.groupTitle}>{group.title}</Text>
            <Text style={styles.leaderText}>Líder Discipulador: {group.leader_name || 'Pastor'}</Text>

            {group.cycle_start_date && group.cycle_end_date ? (
              <View style={styles.cycleBadge}>
                <Text style={styles.cycleBadgeText}>
                  📅 Temporada: {group.cycle_start_date} a {group.cycle_end_date} • {group.cycle_status === 'completed' ? 'Encerrado' : 'Ciclo Ativo'}
                </Text>
              </View>
            ) : null}

            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statVal}>{group.total_members}</Text>
                <Text style={styles.statLbl}>Irmãos</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statVal}>{group.total_devotionals}</Text>
                <Text style={styles.statLbl}>Folhas</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statVal}>{group.avg_points_per_member}</Text>
                <Text style={styles.statLbl}>Média Pts</Text>
              </View>
              <View style={styles.statBoxHighlight}>
                <Text style={styles.statValHighlight}>{Number(group.total_group_points).toLocaleString('pt-BR')}</Text>
                <Text style={styles.statLbl}>Total Pts</Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  headerEmoji: {
    fontSize: 44,
    marginBottom: 6,
  },
  title: {
    fontSize: Typography.titleHero,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Typography.bodyMedium,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 22,
  },
  challengeCard: {
    backgroundColor: '#1e3a8a',
    borderRadius: 24,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  challengeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 8,
  },
  challengeBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  challengeTitle: {
    color: '#fff',
    fontSize: Typography.titleMedium,
    fontWeight: '900',
  },
  challengeDesc: {
    color: '#bfdbfe',
    fontSize: Typography.bodySmall,
    marginTop: 4,
    marginBottom: Spacing.md,
  },
  leaderboardBox: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: Spacing.md,
  },
  leaderboardTitle: {
    color: '#fef08a',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
  },
  leaderboardItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  itemBadge: {
    fontSize: 14,
    marginRight: 6,
  },
  itemChurchName: {
    flex: 1,
    color: '#fff',
    fontSize: Typography.bodySmall,
    fontWeight: '700',
  },
  itemPoints: {
    color: '#fef08a',
    fontSize: Typography.bodyMedium,
    fontWeight: '900',
  },
  sectionTitle: {
    fontSize: Typography.titleMedium,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  groupRankCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    elevation: 2,
  },
  firstPlaceCard: {
    borderColor: '#f59e0b',
    borderWidth: 2,
    backgroundColor: '#fffbeb',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  posBadge: {
    backgroundColor: Colors.surfaceAlt,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  firstPosBadge: {
    backgroundColor: '#fef08a',
  },
  posText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  firstPosText: {
    color: '#854d0e',
  },
  streakBadge: {
    backgroundColor: Colors.fireLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  streakText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.fire,
  },
  groupTitle: {
    fontSize: Typography.titleMedium,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  leaderText: {
    fontSize: Typography.bodySmall,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  cycleBadge: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    alignSelf: 'flex-start',
    marginBottom: Spacing.sm,
  },
  cycleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
  },
  statsGrid: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 8,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statBoxHighlight: {
    flex: 1.2,
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: Colors.border,
  },
  statVal: {
    fontSize: Typography.bodyLarge,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  statValHighlight: {
    fontSize: Typography.bodyLarge,
    fontWeight: '900',
    color: Colors.primary,
  },
  statLbl: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '600',
  },
});
