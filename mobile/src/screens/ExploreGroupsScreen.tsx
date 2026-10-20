import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
  RefreshControl,
} from 'react-native';
import { Colors, Spacing, Typography } from '../theme/colors';
import { AccessibleButton } from '../components/AccessibleButton';
import { api, Group } from '../services/api';
import { ScreenHeader } from '../components/ScreenHeader';

export const ExploreGroupsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [inviteCode, setInviteCode] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [joining, setJoining] = useState(false);

  const loadAllGroups = async () => {
    try {
      const res = await api.get('/api/groups');
      setGroups(res.data);
    } catch (e) {
      console.error('Erro ao listar grupos:', e);
    }
  };

  useEffect(() => {
    loadAllGroups();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAllGroups();
    setRefreshing(false);
  };

  const handleJoinByCode = async () => {
    if (!inviteCode.trim()) {
      Alert.alert('Código Obrigatório', 'Informe o código do grupo (ex: TIAGO26, EGO26, PAIS26).');
      return;
    }
    setJoining(true);
    try {
      const res = await api.post('/api/groups/join', { inviteCode: inviteCode.trim() });
      Alert.alert('Glória a Deus!', res.data.message);
      setInviteCode('');
      await loadAllGroups();
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Não foi possível entrar no grupo.';
      Alert.alert('Aviso', msg);
    } finally {
      setJoining(false);
    }
  };

  const handleJoinById = async (groupId: string, title: string) => {
    try {
      const res = await api.post('/api/groups/join', { groupId });
      Alert.alert('Bem-vindo(a)!', `Você agora faz parte do grupo "${title}".`);
      await loadAllGroups();
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Erro ao entrar no grupo.';
      Alert.alert('Aviso', msg);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title="Explorar Grupos"
        subtitle="Participe de células de estudo bíblico"
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
          <Text style={styles.title}>Grupos de Estudo da Igreja</Text>
          <Text style={styles.subtitle}>
            Participe dos estudos bíblicos e leituras de livros em comunidade.
          </Text>
        </View>

        {/* Entrar com Código de Convite */}
        <View style={styles.inviteCard}>
          <Text style={styles.cardLabel}>TEM UM CÓDIGO DE CONVITE?</Text>
          <View style={styles.inviteInputRow}>
            <TextInput
              value={inviteCode}
              onChangeText={setInviteCode}
              placeholder="Ex: TIAGO26"
              autoCapitalize="characters"
              style={styles.inviteInput}
            />
            <AccessibleButton
              title="Entrar"
              onPress={handleJoinByCode}
              loading={joining}
              style={styles.joinBtn}
            />
          </View>
        </View>

        {/* Lista de Grupos Disponíveis */}
        <Text style={styles.sectionTitle}>Grupos Ativos na Comunidade</Text>

        {groups.map((group) => (
          <View key={group.id} style={styles.groupCard}>
            <Image source={{ uri: group.cover_image }} style={styles.groupCover} />
            <View style={styles.groupBody}>
              <View style={styles.groupHeaderRow}>
                <Text style={styles.categoryPill}>
                  {group.category === 'biblia' ? '📖 BÍBLIA' : '📕 LIVRO'}
                </Text>
                <Text style={styles.codeBadge}>CÓDIGO: {group.invite_code}</Text>
              </View>

              <Text style={styles.groupTitle}>{group.title}</Text>
              <Text style={styles.groupTheme}>Tema: {group.book_or_theme}</Text>
              <Text style={styles.groupDescription}>{group.description}</Text>

              <View style={styles.groupFooter}>
                <Text style={styles.memberCount}>
                  👥 {group.member_count} irmãos participando
                </Text>

                {group.is_member ? (
                  <View style={styles.alreadyMemberBadge}>
                    <Text style={styles.alreadyMemberText}>Você já participa ✅</Text>
                  </View>
                ) : (
                  <AccessibleButton
                    title="Participar Deste Grupo"
                    onPress={() => handleJoinById(group.id, group.title)}
                    style={styles.enrollBtn}
                  />
                )}
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
  inviteCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  inviteInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inviteInput: {
    flex: 1,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: Typography.bodyLarge,
    fontWeight: '800',
    color: Colors.textPrimary,
    minHeight: 52,
    marginRight: 8,
  },
  joinBtn: {
    minHeight: 52,
    paddingHorizontal: Spacing.lg,
  },
  sectionTitle: {
    fontSize: Typography.titleMedium,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  groupCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    marginBottom: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    overflow: 'hidden',
    elevation: 2,
  },
  groupCover: {
    width: '100%',
    height: 130,
  },
  groupBody: {
    padding: Spacing.md,
  },
  groupHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  categoryPill: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primary,
  },
  codeBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textSecondary,
    backgroundColor: Colors.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  groupTitle: {
    fontSize: Typography.titleMedium,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  groupTheme: {
    fontSize: Typography.bodySmall,
    fontWeight: '600',
    color: Colors.primaryDark,
    marginTop: 2,
    marginBottom: 6,
  },
  groupDescription: {
    fontSize: Typography.bodySmall,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: Spacing.sm,
  },
  groupFooter: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberCount: {
    fontSize: Typography.bodySmall,
    color: Colors.textMuted,
  },
  alreadyMemberBadge: {
    backgroundColor: Colors.successSurface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  alreadyMemberText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.success,
  },
  enrollBtn: {
    minHeight: 46,
    paddingHorizontal: 14,
  },
});
