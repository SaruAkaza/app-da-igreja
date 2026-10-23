import { useFocusEffect } from 'expo-router';
import React,{ useCallback,useState } from 'react';
import {
Image,
RefreshControl,
SafeAreaView,
ScrollView,
StyleSheet,
Text,
View,
} from 'react-native';
import { ScreenHeader } from '../components/ScreenHeader';
import { QuestionsPanel } from '../components/QuestionsPanel';
import { api,LeaderFeedback } from '../services/api';
import { Colors,Spacing,Typography } from '../theme/colors';

export const FeedbacksScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [feedbacks, setFeedbacks] = useState<LeaderFeedback[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [, setLoading] = useState(true);

  const loadFeedbacks = async () => {
    try {
      const res = await api.get('/api/devotionals/my-feedbacks');
      setFeedbacks(res.data);
    } catch (e) {
      console.error('Erro ao carregar orientações pastorais:', e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadFeedbacks();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFeedbacks();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title="Conversas e orientações"
        subtitle="Um espaço privado com sua liderança"
        navigation={navigation}
        showHomeButton={true}
      />
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
        }
      >
        <QuestionsPanel onOpenGroup={id => navigation.navigate('Group', { groupId: id, tab: 'questions' })} />
        <View style={styles.header}>
          <Text style={styles.icon}>💌</Text>
          <Text style={styles.title}>Orientações sobre suas leituras</Text>
          <Text style={styles.subtitle}>
            Orientações bíblicas, exegéticas e palavras de encorajamento enviadas com sigilo pelo seu líder de estudo.
          </Text>
        </View>

        {feedbacks.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🕊️</Text>
            <Text style={styles.emptyTitle}>Nenhuma orientação pendente</Text>
            <Text style={styles.emptySubtitle}>
              Continue postando suas anotações do caderno! Seu líder inspecionará suas leituras para enviar dicas de aprofundamento.
            </Text>
          </View>
        ) : (
          feedbacks.map((fb) => (
            <View key={fb.id} style={styles.feedbackCard}>
              <View style={styles.leaderRow}>
                <Image
                  source={{
                    uri: fb.leader_avatar || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
                  }}
                  style={styles.leaderAvatar}
                />
                <View style={styles.leaderInfo}>
                  <Text style={styles.leaderName}>{fb.leader_name}</Text>
                  <Text style={styles.groupText}>{fb.group_title} • {new Date(fb.feedback_date).toLocaleDateString('pt-BR')}</Text>
                </View>
                <View style={styles.passagePill}>
                  <Text style={styles.passagePillText}>📖 {fb.passage_or_chapter}</Text>
                </View>
              </View>

              <View style={styles.guidanceBox}>
                <Text style={styles.guidanceQuote}>&quot;{fb.pastoral_guidance}&quot;</Text>
              </View>
            </View>
          ))
        )}
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
  icon: {
    fontSize: 40,
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
  emptyCard: {
    backgroundColor: Colors.surface,
    padding: Spacing.xl,
    borderRadius: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginTop: Spacing.lg,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: Typography.titleMedium,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  emptySubtitle: {
    fontSize: Typography.bodyMedium,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 22,
  },
  feedbackCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1.5,
    borderColor: '#86efac',
    elevation: 2,
  },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  leaderAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 10,
    borderWidth: 2,
    borderColor: Colors.primaryLight,
  },
  leaderInfo: {
    flex: 1,
  },
  leaderName: {
    fontSize: Typography.bodyLarge,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  groupText: {
    fontSize: Typography.bodySmall,
    color: Colors.textSecondary,
  },
  passagePill: {
    backgroundColor: Colors.primarySurface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  passagePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  guidanceBox: {
    backgroundColor: Colors.successSurface,
    borderRadius: 16,
    padding: Spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: Colors.success,
  },
  guidanceQuote: {
    fontSize: Typography.bodyMedium,
    color: '#14532d',
    lineHeight: 22,
    fontStyle: 'italic',
  },
});
