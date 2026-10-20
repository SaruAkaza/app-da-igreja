import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Spacing, Typography } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { CouponCard } from '../components/CouponCard';
import { api, Reward, Coupon } from '../services/api';

export const RewardsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user, refreshProfile } = useAuth();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [quarterTitle, setQuarterTitle] = useState('1º Trimestre 2026');
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'coupons' | 'catalog'>('coupons');

  const loadData = async () => {
    try {
      await refreshProfile();
      const [rewardsRes, couponsRes] = await Promise.all([
        api.get('/api/gamification/rewards'),
        api.get('/api/gamification/my-coupons'),
      ]);

      if (rewardsRes.data.quarter) {
        setQuarterTitle(rewardsRes.data.quarter.title);
      }
      setRewards(rewardsRes.data.rewards || []);
      setCoupons(couponsRes.data || []);
    } catch (e) {
      console.error('Erro ao carregar recompensas:', e);
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

  const userPoints = user?.total_points || 0;
  const activeCouponsCount = coupons.filter((c) => c.status === 'active').length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
        }
      >
        {/* Banner de Cabeçalho com Pontuação */}
        <View style={styles.headerCard}>
          <Text style={styles.quarterBadge}>{quarterTitle}</Text>
          <Text style={styles.pointsTitle}>{userPoints.toLocaleString('pt-BR')} Pontos</Text>
          <Text style={styles.pointsSubtitle}>
            Acumulados com a fidelidade nos seus devocionais diários
          </Text>

          {/* Barra de Progresso Trimestral */}
          <View style={styles.progressContainer}>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  { width: `${Math.min(100, Math.round((userPoints / 4000) * 100))}%` },
                ]}
              />
            </View>
            <View style={styles.tiersMarkers}>
              <Text style={styles.markerText}>🥉 1.500 (Bronze)</Text>
              <Text style={styles.markerText}>🥈 2.800 (Prata)</Text>
              <Text style={styles.markerText}>🥇 4.000 (Ouro)</Text>
            </View>
          </View>
        </View>

        {/* Abas: Meus Cupons (com QR Code) vs Catálogo de Metas */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'coupons' && styles.tabButtonActive]}
            onPress={() => setActiveTab('coupons')}
          >
            <Text
              style={[
                styles.tabButtonText,
                activeTab === 'coupons' && styles.tabButtonTextActive,
              ]}
            >
              🎟️ Meus Cupons ({activeCouponsCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'catalog' && styles.tabButtonActive]}
            onPress={() => setActiveTab('catalog')}
          >
            <Text
              style={[
                styles.tabButtonText,
                activeTab === 'catalog' && styles.tabButtonTextActive,
              ]}
            >
              🏆 Metas & Prêmios
            </Text>
          </TouchableOpacity>
        </View>

        {/* Conteúdo Aba: Meus Cupons */}
        {activeTab === 'coupons' && (
          <View>
            {coupons.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>🎁</Text>
                <Text style={styles.emptyTitle}>Nenhum cupom gerado ainda</Text>
                <Text style={styles.emptySubtitle}>
                  Alcance 1.500 pontos no trimestre para desbloquear seu primeiro cupom digital com QR Code!
                </Text>
              </View>
            ) : (
              coupons.map((coupon) => <CouponCard key={coupon.id} coupon={coupon} />)
            )}
          </View>
        )}

        {/* Conteúdo Aba: Catálogo de Metas */}
        {activeTab === 'catalog' && (
          <View style={styles.catalogSection}>
            {rewards.map((rew) => (
              <View key={rew.id} style={styles.rewardCard}>
                <View style={styles.rewardTop}>
                  <View style={styles.rewardBadgeWrapper}>
                    <Text style={styles.rewardTierBadge}>
                      {rew.tier === 'ouro' ? '🥇 NÍVEL OURO' : rew.tier === 'prata' ? '🥈 NÍVEL PRATA' : '🥉 NÍVEL BRONZE'}
                    </Text>
                  </View>
                  <Text style={styles.rewardPointsRequired}>
                    {rew.points_required.toLocaleString('pt-BR')} pts
                  </Text>
                </View>

                <Text style={styles.rewardTitle}>{rew.title}</Text>
                <Text style={styles.rewardDesc}>{rew.description}</Text>
                <Text style={styles.rewardPartner}>📍 Parceiro: {rew.partner_name}</Text>

                {/* Barra individual */}
                <View style={styles.rewardProgressBar}>
                  <View style={[styles.rewardProgressFill, { width: `${rew.progress_percent}%` }]} />
                </View>

                <View style={styles.rewardFooter}>
                  {rew.unlocked ? (
                    <Text style={styles.unlockedText}>✅ Meta Alcançada! Cupom emitido</Text>
                  ) : (
                    <Text style={styles.lockedText}>
                      Faltam {rew.points_remaining} pontos para alcançar
                    </Text>
                  )}
                  <Text style={styles.percentText}>{rew.progress_percent}%</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Como Funciona o Resgate */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>ℹ️ Como Resgatar Seus Prêmios:</Text>
          <Text style={styles.infoItem}>
            1. No culto ou na livraria da igreja, abra a aba "Meus Cupons".
          </Text>
          <Text style={styles.infoItem}>
            2. Toque em "Apresentar QR Code no Culto" para exibir na tela.
          </Text>
          <Text style={styles.infoItem}>
            3. O líder ou atendente lerá o código com o celular e dará baixa instantânea no seu prêmio!
          </Text>
        </View>
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
  headerCard: {
    backgroundColor: Colors.primaryDark,
    borderRadius: 24,
    padding: Spacing.lg,
    alignItems: 'center',
    marginBottom: Spacing.md,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  quarterBadge: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  pointsTitle: {
    fontSize: Typography.titleHero + 4,
    fontWeight: '900',
    color: '#fff',
  },
  pointsSubtitle: {
    fontSize: Typography.bodySmall,
    color: '#cbd5e1',
    textAlign: 'center',
    marginTop: 4,
  },
  progressContainer: {
    width: '100%',
    marginTop: Spacing.md,
  },
  track: {
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 6,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: Colors.accentLight,
    borderRadius: 6,
  },
  tiersMarkers: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  markerText: {
    fontSize: 10,
    color: '#e2e8f0',
    fontWeight: '700',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
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
  emptyCard: {
    backgroundColor: Colors.surface,
    padding: Spacing.xl,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    marginHorizontal: Spacing.md,
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
  catalogSection: {
    paddingHorizontal: Spacing.xs,
  },
  rewardCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  rewardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rewardBadgeWrapper: {
    backgroundColor: Colors.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  rewardTierBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  rewardPointsRequired: {
    fontSize: Typography.bodyLarge,
    fontWeight: '900',
    color: Colors.primaryDark,
  },
  rewardTitle: {
    fontSize: Typography.titleMedium,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  rewardDesc: {
    fontSize: Typography.bodySmall,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 6,
  },
  rewardPartner: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.accent,
    marginBottom: 10,
  },
  rewardProgressBar: {
    height: 8,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  rewardProgressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
  rewardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  unlockedText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.success,
  },
  lockedText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  percentText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: Spacing.md,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoTitle: {
    fontSize: Typography.bodyLarge,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  infoItem: {
    fontSize: Typography.bodySmall,
    color: Colors.textSecondary,
    marginBottom: 4,
    lineHeight: 20,
  },
});
