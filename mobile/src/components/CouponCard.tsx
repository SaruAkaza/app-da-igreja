import React,{ useState } from 'react';
import {
Image,
Modal,
SafeAreaView,
StyleSheet,
Text,
View
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Coupon } from '../services/api';
import { Colors,Spacing,Typography } from '../theme/colors';
import { AccessibleButton } from './AccessibleButton';

interface CouponCardProps {
  coupon: Coupon;
}

export const CouponCard: React.FC<CouponCardProps> = ({ coupon }) => {
  const [qrModalVisible, setQrModalVisible] = useState(false);

  const isUsed = coupon.status !== 'active';
  const tierColor =
    coupon.tier === 'ouro'
      ? Colors.tierGold
      : coupon.tier === 'prata'
      ? Colors.tierSilver
      : Colors.tierBronze;

  const tierBg =
    coupon.tier === 'ouro'
      ? Colors.tierGoldBg
      : coupon.tier === 'prata'
      ? Colors.tierSilverBg
      : Colors.tierBronzeBg;

  const tierEmoji =
    coupon.tier === 'ouro' ? '🥇' : coupon.tier === 'prata' ? '🥈' : '🥉';

  return (
    <View style={[styles.card, isUsed && styles.cardUsed]}>
      {/* Topo: Nível e Status */}
      <View style={styles.headerRow}>
        <View style={[styles.tierBadge, { backgroundColor: tierBg }]}>
          <Text style={[styles.tierText, { color: tierColor }]}>
            {tierEmoji} NÍVEL {coupon.tier.toUpperCase()}
          </Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            { backgroundColor: isUsed ? '#f1f5f9' : Colors.successSurface },
          ]}
        >
          <Text
            style={[
              styles.statusText,
              { color: isUsed ? Colors.textMuted : Colors.success },
            ]}
          >
            {coupon.status === 'expired' ? 'EXPIRADO' : isUsed ? 'UTILIZADO' : 'DISPONÍVEL'}
          </Text>
        </View>
      </View>

      {/* Conteúdo do Prêmio */}
      {coupon.group_title ? (
        <View style={{ alignSelf: 'flex-start', backgroundColor: '#e8f5e9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginBottom: 6 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#2e7d32' }}>
            📍 Célula {coupon.group_title} {coupon.coupon_code?.includes('PODIO') ? '• 🏆 Pódio' : ''}
          </Text>
        </View>
      ) : null}
      <Text style={styles.title}>{coupon.reward_title}</Text>
      {coupon.reward_description ? (
        <Text style={styles.description}>{coupon.reward_description}</Text>
      ) : null}

      <View style={styles.partnerInfo}>
        <Text style={styles.partnerLabel}>Local / Parceiro de Retirada:</Text>
        <Text style={styles.partnerName}>📍 {coupon.partner_name}</Text>
      </View>

      {/* Mini QR Code Preview + Código */}
      <View style={styles.couponCodeContainer}>
        <View style={styles.qrThumbnail}>
          {coupon.qr_code_data?.startsWith('data:image/') ? (
            <Image
              source={{ uri: coupon.qr_code_data }}
              style={{ width: 70, height: 70 }}
            />
          ) : (
            <QRCode value={coupon.coupon_code} size={64} />
          )}
        </View>
        <View style={styles.codeDetails}>
          <Text style={styles.codeLabel}>CÓDIGO DIGITAL DO CUPOM</Text>
          <Text style={styles.codeValue}>{coupon.coupon_code}</Text>
          <Text style={styles.codeHint}>Apresente na livraria ou para o líder</Text>
        </View>
      </View>

      {/* Botão de Exibir QR Code Grande */}
      {!isUsed && (
        <AccessibleButton
          title="📲 Apresentar QR Code no Culto"
          subtitle="Ampliar na tela para o líder escanear"
          variant="outline"
          onPress={() => setQrModalVisible(true)}
          style={styles.showButton}
        />
      )}

      {/* Modal Tela Cheia do QR Code para Leitura Fácil */}
      <Modal visible={qrModalVisible} transparent={false} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Cupom de Recompensa</Text>
            <Text style={styles.modalSubtitle}>
              Mostre este QR Code para o líder ou atendente da livraria
            </Text>

            <View style={styles.largeQrCard}>
              <View style={styles.qrWrapper}>
                <QRCode value={coupon.coupon_code} size={220} />
              </View>
              <Text style={styles.modalCodeText}>{coupon.coupon_code}</Text>
              <Text style={styles.modalRewardTitle}>{coupon.reward_title}</Text>
              <Text style={styles.modalPartnerText}>Local: {coupon.partner_name}</Text>
            </View>

            <AccessibleButton
              title="Voltar"
              variant="secondary"
              onPress={() => setQrModalVisible(false)}
              style={styles.modalCloseBtn}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  cardUsed: {
    opacity: 0.7,
    backgroundColor: '#fafafa',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  tierBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tierText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  title: {
    fontSize: Typography.titleMedium,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  description: {
    fontSize: Typography.bodySmall,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    lineHeight: 18,
  },
  partnerInfo: {
    backgroundColor: Colors.surfaceAlt,
    padding: 10,
    borderRadius: 12,
    marginBottom: Spacing.sm,
  },
  partnerLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  partnerName: {
    fontSize: Typography.bodyMedium,
    fontWeight: '700',
    color: Colors.primaryDark,
    marginTop: 2,
  },
  couponCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 10,
    marginBottom: Spacing.sm,
  },
  qrThumbnail: {
    padding: 4,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginRight: 12,
  },
  codeDetails: {
    flex: 1,
  },
  codeLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textMuted,
  },
  codeValue: {
    fontSize: 16,
    fontFamily: 'monospace',
    fontWeight: '800',
    color: Colors.textPrimary,
    marginVertical: 2,
  },
  codeHint: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  showButton: {
    minHeight: 52,
    marginTop: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalContent: {
    flex: 1,
    padding: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: Typography.titleHero,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: Typography.bodyMedium,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: Spacing.lg,
  },
  largeQrCard: {
    backgroundColor: '#fff',
    padding: Spacing.lg,
    borderRadius: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    width: '100%',
    maxWidth: 340,
    marginBottom: Spacing.lg,
  },
  qrWrapper: {
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: Spacing.md,
  },
  modalCodeText: {
    fontSize: 18,
    fontFamily: 'monospace',
    fontWeight: '800',
    color: Colors.primaryDark,
    marginBottom: 6,
  },
  modalRewardTitle: {
    fontSize: Typography.bodyLarge,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  modalPartnerText: {
    fontSize: Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  modalCloseBtn: {
    width: '100%',
    maxWidth: 340,
    minHeight: 56,
  },
});
