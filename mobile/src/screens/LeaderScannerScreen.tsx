import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TextInput,
  Alert,
} from 'react-native';
import { Colors, Spacing, Typography } from '../theme/colors';
import { AccessibleButton } from '../components/AccessibleButton';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const LeaderScannerScreen: React.FC = () => {
  const { user } = useAuth();
  const [couponCode, setCouponCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastRedeemed, setLastRedeemed] = useState<any | null>(null);

  const isLeaderOrAdmin = user?.role === 'leader' || user?.role === 'admin';

  const handleRedeem = async (codeToUse?: string) => {
    const code = (codeToUse || couponCode).trim().toUpperCase();
    if (!code) {
      Alert.alert('Atenção', 'Informe o código do cupom ou escaneie o QR Code.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/api/gamification/redeem', { couponCode: code });
      setLastRedeemed(res.data.coupon);
      setCouponCode('');
      Alert.alert('✅ Cupom Validado!', `Sucesso! O cupom de ${res.data.coupon.member_name} foi resgatado.`);
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Erro ao validar cupom.';
      Alert.alert('Não foi possível resgatar', msg);
    } finally {
      setLoading(false);
    }
  };

  if (!isLeaderOrAdmin) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.restrictedContainer}>
          <Text style={styles.restrictedIcon}>🔒</Text>
          <Text style={styles.restrictedTitle}>Área Restrita aos Líderes</Text>
          <Text style={styles.restrictedText}>
            Esta ferramenta é destinada aos pastores e líderes para validação e baixa de prêmios durante os cultos e congressos.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerIcon}>🛡️</Text>
          <Text style={styles.title}>Validador de Cupons</Text>
          <Text style={styles.subtitle}>
            Olá, {user?.name}. Digite ou escaneie o código apresentado pelo irmão para dar baixa no prêmio.
          </Text>
        </View>

        {/* Formulário de Leitura / Digitação */}
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
            loading={loading}
            style={{ marginTop: 12 }}
          />
        </View>

        {/* Cartão de Último Resgate Efetuado */}
        {lastRedeemed && (
          <View style={styles.successCard}>
            <View style={styles.successHeader}>
              <Text style={styles.successIcon}>🎉</Text>
              <View>
                <Text style={styles.successTitle}>ÚLTIMA BAIXA CONFIRMADA</Text>
                <Text style={styles.successMember}>{lastRedeemed.member_name}</Text>
              </View>
            </View>
            <Text style={styles.successReward}>{lastRedeemed.reward_title}</Text>
            <Text style={styles.successPartner}>Local: {lastRedeemed.partner_name}</Text>
            <Text style={styles.successDate}>
              Data da baixa: {new Date(lastRedeemed.redeemed_at).toLocaleString('pt-BR')}
            </Text>
          </View>
        )}

        {/* Atalhos Rápidos para Testar */}
        <View style={styles.shortcutsSection}>
          <Text style={styles.shortcutsTitle}>💡 Testar com cupons do seed:</Text>
          <AccessibleButton
            title="🎟️ Resgatar Cupom Ouro da Dona Maria"
            subtitle="CUPOM-OURO-MARIA2026"
            variant="secondary"
            onPress={() => handleRedeem('CUPOM-OURO-MARIA2026')}
            style={styles.shortcutBtn}
          />
          <AccessibleButton
            title="🎟️ Resgatar Cupom Bronze do João Pedro"
            subtitle="CUPOM-BRONZE-JOAO2026"
            variant="secondary"
            onPress={() => handleRedeem('CUPOM-BRONZE-JOAO2026')}
            style={styles.shortcutBtn}
          />
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
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
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
    marginBottom: Spacing.md,
    borderWidth: 1.5,
    borderColor: '#86efac',
  },
  successHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  successIcon: {
    fontSize: 28,
    marginRight: 8,
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
    marginTop: 4,
  },
  successPartner: {
    fontSize: Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  successDate: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 6,
  },
  shortcutsSection: {
    marginTop: Spacing.md,
  },
  shortcutsTitle: {
    fontSize: Typography.bodySmall,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  shortcutBtn: {
    marginBottom: 8,
    minHeight: 52,
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
    textAlign: 'center',
  },
  restrictedText: {
    fontSize: Typography.bodyMedium,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
});
