import { useAuth } from '../context/AuthContext';
import { useFocusEffect } from 'expo-router';
import React,{ useCallback,useState } from 'react';
import {
FlatList,
Image,
RefreshControl,
SafeAreaView,
ScrollView,
StyleSheet,
Text,
TouchableOpacity,
View,
} from 'react-native';
import { DevotionalCard } from '../components/DevotionalCard';
import { ScreenHeader } from '../components/ScreenHeader';
import { api,Devotional,Group } from '../services/api';
import { Colors,Spacing,Typography } from '../theme/colors';

export const GroupFeedScreen: React.FC<{ navigation: any; route: any }> = ({
  navigation,
  route,
}) => {
  const { user } = useAuth();
  const currentDay = user?.current_day;
  const initialGroupId = route.params?.groupId || null;
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(initialGroupId);
  const [groups, setGroups] = useState<Group[]>([]);
  const [feed, setFeed] = useState<Devotional[]>([]);
  const [activeMembersToday, setActiveMembersToday] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadGroups = async () => {
    try {
      const res = await api.get('/api/groups/my');
      setGroups(res.data);
    } catch (e) {
      console.error('Erro ao carregar grupos:', e);
    }
  };

  const loadFeed = useCallback(async (groupId: string | null) => {
    try {
      const url = groupId ? `/api/devotionals/feed?groupId=${groupId}` : '/api/devotionals/feed';
      const res = await api.get(url);
      setFeed(res.data);

      // Carregar estritamente quem já fez hoje para o grupo selecionado
      if (groupId) {
        const groupDetailsRes = await api.get(`/api/groups/${groupId}`);
        const allMembers = groupDetailsRes.data.members || [];
        // Filtrar estritamente apenas os membros que concluíram devocional HOJE
        const completedToday = allMembers.filter((m: any) => Boolean(m.did_devotional_today));
        setActiveMembersToday(completedToday);
      } else {
        // Geral: buscar irmãos com post na data de hoje
        const today = currentDay || new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
        const todayPosts = res.data.filter((p: Devotional) => p.devotional_date === today);
        const uniqueUsers = Array.from(
          new Map(todayPosts.map((p: Devotional) => [p.user_id, p])).values()
        );
        setActiveMembersToday(uniqueUsers);
      }
    } catch (e) {
      console.error('Erro ao carregar feed:', e);
    } finally {
      setLoading(false);
    }
  }, [currentDay]);

  useFocusEffect(
    useCallback(() => {
      loadGroups();
      loadFeed(selectedGroupId);
    }, [selectedGroupId, loadFeed])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadGroups(), loadFeed(selectedGroupId)]);
    setRefreshing(false);
  };

  const handleSelectGroup = (id: string | null) => {
    setSelectedGroupId(id);
    setLoading(true);
    loadFeed(id);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title="Feed da Igreja"
        subtitle="Celebração da fidelidade na Palavra"
        navigation={navigation}
        showHomeButton={true}
      />

      {/* Barra de Filtros de Grupos */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <TouchableOpacity
            onPress={() => handleSelectGroup(null)}
            style={[styles.filterChip, selectedGroupId === null && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, selectedGroupId === null && styles.filterChipTextActive]}>
              🌟 Todos os Grupos
            </Text>
          </TouchableOpacity>

          {groups.map((g) => (
            <TouchableOpacity
              key={g.id}
              onPress={() => handleSelectGroup(g.id)}
              style={[styles.filterChip, selectedGroupId === g.id && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, selectedGroupId === g.id && styles.filterChipTextActive]}>
                {g.category === 'biblia' ? '📖' : '📕'} {g.title}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Lista: Quem já fez hoje */}
      <View style={styles.streakRowContainer}>
        <Text style={styles.streakRowTitle}>✨ Irmãos que já fizeram hoje:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.streakAvatarScroll}>
          {activeMembersToday.length === 0 ? (
            <Text style={styles.noStreakToday}>Seja o primeiro a enviar sua folha hoje!</Text>
          ) : (
            activeMembersToday.map((m: any, idx) => {
              const name = m.name || m.user_name || 'Irmão';
              const avatar = m.avatar_url || m.user_avatar || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150';
              const streak = m.current_streak || m.user_streak || 1;

              return (
                <View key={m.id || idx} style={styles.avatarItem}>
                  <View style={styles.avatarWrapper}>
                    <Image source={{ uri: avatar }} style={styles.circleAvatar} />
                    <View style={styles.checkBadge}>
                      <Text style={styles.checkText}>✓</Text>
                    </View>
                  </View>
                  <Text style={styles.avatarName} numberOfLines={1}>
                    {name.split(' ')[0]}
                  </Text>
                  <Text style={styles.avatarStreak}>🔥{streak}d</Text>
                </View>
              );
            })
          )}
        </ScrollView>
      </View>

      {/* Feed de Devocionais */}
      <FlatList
        data={feed}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <DevotionalCard devotional={item} onReactionUpdated={() => loadFeed(selectedGroupId)} />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>📜</Text>
              <Text style={styles.emptyTitle}>Nenhuma anotação postada ainda</Text>
              <Text style={styles.emptySubtitle}>
                Abra seu caderno, faça seu devocional e seja o primeiro a abençoar o grupo!
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('Capture', { targetGroupId: selectedGroupId })}
                style={styles.postNowBtn}
              >
                <Text style={styles.postNowText}>📸 Tirar Foto da Minha Folha</Text>
              </TouchableOpacity>
            </View>
          ) : undefined
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  filterBar: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: 10,
  },
  filterScroll: {
    paddingHorizontal: Spacing.md,
  },
  filterChip: {
    backgroundColor: Colors.surfaceAlt,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primaryDark,
  },
  filterChipText: {
    fontSize: Typography.bodySmall,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: '#fff',
  },
  streakRowContainer: {
    backgroundColor: Colors.surface,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  streakRowTitle: {
    fontSize: Typography.bodySmall,
    fontWeight: '700',
    color: Colors.textSecondary,
    paddingHorizontal: Spacing.md,
    marginBottom: 6,
  },
  streakAvatarScroll: {
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
  },
  noStreakToday: {
    fontSize: Typography.bodySmall,
    color: Colors.textMuted,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  avatarItem: {
    alignItems: 'center',
    marginRight: 14,
    width: 60,
  },
  avatarWrapper: {
    position: 'relative',
  },
  circleAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: Colors.success,
  },
  checkBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: Colors.success,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  checkText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },
  avatarName: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 4,
    textAlign: 'center',
  },
  avatarStreak: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.fire,
  },
  listContent: {
    paddingVertical: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: Spacing.xl,
    marginTop: Spacing.lg,
  },
  emptyEmoji: {
    fontSize: 54,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: Typography.titleMedium,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: Typography.bodyMedium,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: Spacing.lg,
    lineHeight: 22,
  },
  postNowBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
  },
  postNowText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: Typography.bodyLarge,
  },
});
