import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TextInput,
  Alert,
  TouchableOpacity,
  Image,
  RefreshControl,
  Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Spacing, Typography } from '../theme/colors';
import { AccessibleButton } from '../components/AccessibleButton';
import { api, formatImageUrl } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ScreenHeader } from '../components/ScreenHeader';

export const LeaderScannerScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'redeem' | 'discipleship'>('discipleship');

  // Aba Validador
  const [couponCode, setCouponCode] = useState('');
  const [loadingRedeem, setLoadingRedeem] = useState(false);
  const [lastRedeemed, setLastRedeemed] = useState<any | null>(null);

  // Aba Discipulado
  const [devotionals, setDevotionals] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDevotional, setSelectedDevotional] = useState<any | null>(null);
  const [guidanceText, setGuidanceText] = useState('');
  const [sendingGuidance, setSendingGuidance] = useState(false);

  const isLeaderOrAdmin = user?.role === 'leader' || user?.role === 'church_admin' || user?.role === 'super_admin';

  const loadLeaderDevotionals = async () => {
    try {
      const res = await api.get('/api/devotionals/leader-reviews');
      setDevotionals(res.data);
    } catch (e) {
      console.error('Erro ao carregar devocionais para discipulado:', e);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (isLeaderOrAdmin) {
        loadLeaderDevotionals();
      }
    }, [isLeaderOrAdmin])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLeaderDevotionals();
    setRefreshing(false);
  };

  const handleRedeem = async (codeToUse?: string) => {
    const code = (codeToUse || couponCode).trim().toUpperCase();
    if (!code) {
      Alert.alert('Atenção', 'Informe o código do cupom ou escaneie o QR Code.');
      return;
    }

    setLoadingRedeem(true);
    try {
      const res = await api.post('/api/gamification/redeem', { couponCode: code });
      setLastRedeemed(res.data.coupon);
      setCouponCode('');
      Alert.alert('✅ Cupom Validado!', `Sucesso! O cupom de ${res.data.coupon.member_name} foi resgatado.`);
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Erro ao validar cupom.';
      Alert.alert('Não foi possível resgatar', msg);
    } finally {
      setLoadingRedeem(false);
    }
  };

  const handleSendGuidance = async () => {
    if (!guidanceText.trim() || !selectedDevotional) {
      Alert.alert('Atenção', 'Escreva uma orientação pastoral para o membro.');
      return;
    }

    setSendingGuidance(true);
    try {
      const res = await api.post(`/api/devotionals/${selectedDevotional.id}/feedback`, {
        pastoralGuidance: guidanceText.trim(),
      });
      Alert.alert('✅ Orientação Enviada', res.data.message);
      setSelectedDevotional(null);
      setGuidanceText('');
      await loadLeaderDevotionals();
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Erro ao enviar orientação.';
      Alert.alert('Erro', msg);
    } finally {
      setSendingGuidance(false);
    }
  };

  if (!isLeaderOrAdmin) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.restrictedContainer}>
          <Text style={styles.restrictedIcon}>🔒</Text>
          <Text style={styles.restrictedTitle}>Área Restrita aos Líderes</Text>
          <Text style={styles.restrictedText}>
            Esta ferramenta é destinada aos pastores e líderes para discipulado bíblico e validação de cupons.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title="Central do Líder"
        subtitle="Discipulado e Validação de Prêmios"
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
          <Text style={styles.headerIcon}>🛡️</Text>
          <Text style={styles.title}>Central do Líder Discipulador</Text>
          <Text style={styles.subtitle}>
            Olá, {user?.name}. Acompanhe o crescimento bíblico dos seus irmãos e valide prêmios no culto.
          </Text>
        </View>

        {/* Abas da Liderança */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'discipleship' && styles.tabButtonActive]}
            onPress={() => setActiveTab('discipleship')}
          >
            <Text
              style={[
                styles.tabButtonText,
                activeTab === 'discipleship' && styles.tabButtonTextActive,
              ]}
            >
              📖 Discipular ({devotionals.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'redeem' && styles.tabButtonActive]}
            onPress={() => setActiveTab('redeem')}
          >
            <Text
              style={[
                styles.tabButtonText,
                activeTab === 'redeem' && styles.tabButtonTextActive,
              ]}
            >
              🎟️ Validar QR Code
            </Text>
          </TouchableOpacity>
        </View>

        {/* ABA 1: DISCIPULADO & AVALIAÇÃO DE ANOTAÇÕES */}
        {activeTab === 'discipleship' && (
          <View>
            <Text style={styles.sectionTitle}>Anotações Recebidas do seu Grupo:</Text>
            {devotionals.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>✨</Text>
                <Text style={styles.emptyText}>Nenhuma anotação pendente no momento.</Text>
              </View>
            ) : (
              devotionals.map((dev) => (
                <View key={dev.id} style={styles.reviewCard}>
                  <View style={styles.memberHeader}>
                    <Image
                      source={{
                        uri: dev.member_avatar || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
                      }}
                      style={styles.avatar}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberName}>{dev.member_name}</Text>
                      <Text style={styles.memberSub}>
                        {dev.group_title} • {dev.devotional_date}
                      </Text>
                    </View>
                    <View style={styles.streakBadge}>
                      <Text style={styles.streakBadgeText}>🔥 {dev.member_streak}d</Text>
                    </View>
                  </View>

                  <View style={styles.passageBadge}>
                    <Text style={styles.passageText}>📖 {dev.passage_or_chapter}</Text>
                  </View>

                  <Image
                    source={{ uri: formatImageUrl(dev.image_url) }}
                    style={styles.previewSheet}
                    resizeMode="cover"
                  />

                  {dev.notes ? (
                    <Text style={styles.memberNotes}>"{dev.notes}"</Text>
                  ) : null}

                  {dev.existing_feedback ? (
                    <View style={styles.feedbackGivenBox}>
                      <Text style={styles.feedbackGivenTitle}>✅ Orientação enviada por você:</Text>
                      <Text style={styles.feedbackGivenText}>"{dev.existing_feedback}"</Text>
                    </View>
                  ) : (
                    <AccessibleButton
                      title="✍️ Enviar Dica Bíblica / Encorajamento"
                      subtitle="Orientação pastoral privada ao membro"
                      variant="primary"
                      onPress={() => setSelectedDevotional(dev)}
                      style={{ marginTop: 8 }}
                    />
                  )}
                </View>
              ))
            )}
          </View>
        )}

        {/* ABA 2: VALIDADOR DE CUPONS */}
        {activeTab === 'redeem' && (
          <View>
            <View style={styles.card}>
              <Text style={styles.inputLabel}>CÓDIGO DIGITAL DO CUPOM</Text>
              <TextInput
                value={couponCode}
                onChangeText={(text) => setCouponCode(text.toUpperCase())}
                placeholder="Ex: CUPOM-OURO-MARIA2026"
                autoCapitalize="characters"
                style={styles.input}
              />

              <AccessibleButton
                title="✅ Validar e Dar Baixa"
                subtitle="Registrar entrega do prêmio no culto"
                variant="success"
                onPress={() => handleRedeem()}
                loading={loadingRedeem}
                style={{ marginTop: 12 }}
              />
            </View>

            {lastRedeemed && (
              <View style={styles.successCard}>
                <Text style={styles.successTitle}>ÚLTIMA BAIXA CONFIRMADA</Text>
                <Text style={styles.successMember}>{lastRedeemed.member_name}</Text>
                <Text style={styles.successReward}>{lastRedeemed.reward_title}</Text>
                <Text style={styles.successPartner}>Local: {lastRedeemed.partner_name}</Text>
              </View>
            )}
          </View>
        )}

        {/* Modal de Envio de Orientação Pastoral */}
        <Modal visible={!!selectedDevotional} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>📖 Discipular {selectedDevotional?.member_name}</Text>
              <Text style={styles.modalSubtitle}>
                Escreva uma palavra pastoral ou dica bíblica. Ela será enviada com 100% de sigilo direto na aba do membro.
              </Text>

              <TextInput
                value={guidanceText}
                onChangeText={setGuidanceText}
                placeholder="Irmão, veja como esse texto aponta para a graça de Cristo..."
                multiline
                numberOfLines={4}
                style={styles.textArea}
              />

              <View style={styles.modalActions}>
                <AccessibleButton
                  title="Enviar Dica Sigilosa"
                  onPress={handleSendGuidance}
                  loading={sendingGuidance}
                  style={{ flex: 1, marginRight: 8 }}
                />
                <AccessibleButton
                  title="Cancelar"
                  variant="secondary"
                  onPress={() => setSelectedDevotional(null)}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </View>
        </Modal>
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
  headerIcon: {
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 16,
    padding: 4,
    marginBottom: Spacing.md,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 14,
  },
  tabButtonActive: {
    backgroundColor: Colors.surface,
    elevation: 2,
  },
  tabButtonText: {
    fontSize: Typography.bodyMedium,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  tabButtonTextActive: {
    color: Colors.primaryDark,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: Typography.titleMedium,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
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
    fontSize: 36,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: Typography.bodyMedium,
    color: Colors.textSecondary,
  },
  reviewCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 10,
  },
  memberName: {
    fontSize: Typography.bodyLarge,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  memberSub: {
    fontSize: Typography.bodySmall,
    color: Colors.textSecondary,
  },
  streakBadge: {
    backgroundColor: Colors.fireLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  streakBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.fire,
  },
  passageBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primarySurface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 8,
  },
  passageText: {
    fontSize: Typography.bodySmall,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  previewSheet: {
    width: '100%',
    height: 200,
    borderRadius: 14,
    marginBottom: 8,
  },
  memberNotes: {
    fontSize: Typography.bodyMedium,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  feedbackGivenBox: {
    backgroundColor: Colors.successSurface,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#86efac',
    marginTop: 4,
  },
  feedbackGivenTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.success,
  },
  feedbackGivenText: {
    fontSize: Typography.bodySmall,
    color: '#14532d',
    fontStyle: 'italic',
    marginTop: 2,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: Spacing.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    fontSize: 18,
    fontFamily: 'monospace',
    fontWeight: '800',
    color: Colors.textPrimary,
    minHeight: 56,
    textAlign: 'center',
  },
  successCard: {
    backgroundColor: Colors.successSurface,
    borderRadius: 20,
    padding: Spacing.md,
    marginTop: Spacing.md,
    borderWidth: 1.5,
    borderColor: '#86efac',
  },
  successTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.success,
  },
  successMember: {
    fontSize: Typography.titleMedium,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  successReward: {
    fontSize: Typography.bodyMedium,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  successPartner: {
    fontSize: Typography.bodySmall,
    color: Colors.textSecondary,
  },
  restrictedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  restrictedIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  restrictedTitle: {
    fontSize: Typography.titleHero,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  restrictedText: {
    fontSize: Typography.bodyMedium,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: Spacing.md,
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: Spacing.lg,
  },
  modalTitle: {
    fontSize: Typography.titleMedium,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: Typography.bodySmall,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  textArea: {
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: Spacing.md,
    fontSize: Typography.bodyMedium,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: Spacing.md,
  },
});
