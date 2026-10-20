import React from 'react';
import {
Image,
Modal,
SafeAreaView,
ScrollView,
StyleSheet,
Text,
View,
} from 'react-native';
import { Colors,Spacing,Typography } from '../theme/colors';
import { AccessibleButton } from './AccessibleButton';

interface PhotoReviewModalProps {
  visible: boolean;
  imageUri: string | null;
  onRetake: () => void;
  onConfirm: () => void;
  onClose: () => void;
  isSubmitting?: boolean;
}

export const PhotoReviewModal: React.FC<PhotoReviewModalProps> = ({
  visible,
  imageUri,
  onRetake,
  onConfirm,
  onClose,
  isSubmitting = false,
}) => {
  if (!imageUri) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Confirmação da Folha</Text>
            <Text style={styles.subtitle}>
              Verifique se a sua escrita ficou legível para a liderança responsável.
            </Text>
          </View>

          {/* Imagem em destaque */}
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: imageUri }}
              style={styles.imagePreview}
              resizeMode="contain"
            />
          </View>

          {/* Pergunta Amigável Acessível */}
          <View style={styles.questionCard}>
            <Text style={styles.questionIcon}>👀</Text>
            <Text style={styles.questionText}>
              Sua anotação ficou nítida e legível?
            </Text>
            <Text style={styles.questionHint}>
              Se a imagem estiver tremida ou escura, toque em &quot;Tirar Outra&quot;.
            </Text>
          </View>

          {/* Botões Gigantes Acessíveis (>= 56px) */}
          <View style={styles.buttonGroup}>
            <AccessibleButton
              title="✅ Tudo Certo, Enviar!"
              subtitle="Ganhe +50 pontos e avance sua sequência 🔥"
              variant="success"
              onPress={onConfirm}
              loading={isSubmitting}
              style={styles.mainButton}
            />

            <AccessibleButton
              title="📸 Tirar Outra Foto"
              subtitle="Voltar para a câmera e bater novamente"
              variant="secondary"
              onPress={onRetake}
              disabled={isSubmitting}
              style={styles.secondaryButton}
            />
            <AccessibleButton title="Voltar aos dados da leitura" variant="outline" onPress={onClose} disabled={isSubmitting} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.md,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.md,
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
  imageContainer: {
    width: '100%',
    height: 340,
    backgroundColor: '#0f172a',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: Colors.borderStrong,
    marginBottom: Spacing.md,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  questionCard: {
    backgroundColor: Colors.accentSurface,
    borderRadius: 18,
    padding: Spacing.md,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.accentLight,
    marginBottom: Spacing.md,
  },
  questionIcon: {
    fontSize: 32,
    marginBottom: 4,
  },
  questionText: {
    fontSize: Typography.titleMedium,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  questionHint: {
    fontSize: Typography.bodySmall,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  buttonGroup: {
    width: '100%',
    marginTop: Spacing.xs,
  },
  mainButton: {
    minHeight: 64,
    marginBottom: Spacing.sm,
  },
  secondaryButton: {
    minHeight: 56,
  },
});
