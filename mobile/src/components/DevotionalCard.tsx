import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Modal,
  SafeAreaView,
} from 'react-native';
import { Colors, Spacing, Typography } from '../theme/colors';
import { Devotional, formatImageUrl, api } from '../services/api';

interface DevotionalCardProps {
  devotional: Devotional;
  onReactionUpdated?: () => void;
}

export const DevotionalCard: React.FC<DevotionalCardProps> = ({
  devotional,
  onReactionUpdated,
}) => {
  const [zoomVisible, setZoomVisible] = useState(false);
  const [amenCount, setAmenCount] = useState(devotional.amen_count || 0);
  const [gloryCount, setGloryCount] = useState(devotional.glory_count || 0);
  const [heartCount, setHeartCount] = useState(devotional.heart_count || 0);
  const [reactedAmen, setReactedAmen] = useState(devotional.reacted_amen || false);
  const [reactedGlory, setReactedGlory] = useState(devotional.reacted_glory || false);
  const [reactedHeart, setReactedHeart] = useState(devotional.reacted_heart || false);

  const handleToggleReaction = async (type: 'amen' | 'glory' | 'heart') => {
    // Atualização otimista na interface
    if (type === 'amen') {
      setAmenCount((prev) => (reactedAmen ? prev - 1 : prev + 1));
      setReactedAmen(!reactedAmen);
    } else if (type === 'glory') {
      setGloryCount((prev) => (reactedGlory ? prev - 1 : prev + 1));
      setReactedGlory(!reactedGlory);
    } else if (type === 'heart') {
      setHeartCount((prev) => (reactedHeart ? prev - 1 : prev + 1));
      setReactedHeart(!reactedHeart);
    }

    try {
      await api.post(`/api/devotionals/${devotional.id}/react`, { reactionType: type });
      onReactionUpdated?.();
    } catch (e) {
      console.error('Erro ao reagir:', e);
    }
  };

  const imageFullUrl = formatImageUrl(devotional.image_url);

  return (
    <View style={styles.card}>
      {/* Topo: Autor & Grupo */}
      <View style={styles.authorRow}>
        <Image
          source={{
            uri: devotional.user_avatar || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
          }}
          style={styles.avatar}
        />
        <View style={styles.authorInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.authorName}>{devotional.user_name}</Text>
            {devotional.user_streak > 0 && (
              <View style={styles.streakBadge}>
                <Text style={styles.streakBadgeText}>🔥 {devotional.user_streak}d</Text>
              </View>
            )}
          </View>
          <Text style={styles.groupSubtitle}>
            {devotional.group_title} • {devotional.devotional_date}
          </Text>
        </View>

        <View style={styles.pointsPill}>
          <Text style={styles.pointsPillText}>+{devotional.points_awarded} pts</Text>
        </View>
      </View>

      {/* Foto da Folha de Caderno com toque para ampliar */}
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => setZoomVisible(true)}
        style={styles.imageWrapper}
      >
        <Image
          source={{ uri: imageFullUrl }}
          style={styles.devotionalImage}
          resizeMode="cover"
        />
        <View style={styles.zoomPill}>
          <Text style={styles.zoomPillText}>🔍 Toque para ampliar a folha</Text>
        </View>
      </TouchableOpacity>

      {/* Passagem Bíblica / Livro e Anotações */}
      <View style={styles.contentBody}>
        {devotional.passage_or_chapter ? (
          <View style={styles.passageBadge}>
            <Text style={styles.passageText}>
              📖 {devotional.passage_or_chapter}
            </Text>
          </View>
        ) : null}

        {devotional.notes ? (
          <Text style={styles.notesText}>"{devotional.notes}"</Text>
        ) : null}
      </View>

      {/* Barra de Reações Bíblicas com botões grandes */}
      <View style={styles.reactionsBar}>
        <TouchableOpacity
          style={[styles.reactionButton, reactedAmen && styles.reactionButtonActive]}
          onPress={() => handleToggleReaction('amen')}
          activeOpacity={0.7}
        >
          <Text style={styles.reactionEmoji}>🙏</Text>
          <Text style={[styles.reactionLabel, reactedAmen && styles.reactionLabelActive]}>
            Amém ({amenCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.reactionButton, reactedGlory && styles.reactionButtonActive]}
          onPress={() => handleToggleReaction('glory')}
          activeOpacity={0.7}
        >
          <Text style={styles.reactionEmoji}>🙌</Text>
          <Text style={[styles.reactionLabel, reactedGlory && styles.reactionLabelActive]}>
            Glória ({gloryCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.reactionButton, reactedHeart && styles.reactionButtonActive]}
          onPress={() => handleToggleReaction('heart')}
          activeOpacity={0.7}
        >
          <Text style={styles.reactionEmoji}>❤️</Text>
          <Text style={[styles.reactionLabel, reactedHeart && styles.reactionLabelActive]}>
            Edificante ({heartCount})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Modal de Zoom da Folha Manuscrita */}
      <Modal visible={zoomVisible} transparent={false} animationType="fade">
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Folha de Anotação</Text>
            <TouchableOpacity
              onPress={() => setZoomVisible(false)}
              style={styles.modalCloseButton}
            >
              <Text style={styles.modalCloseText}>✕ Fechar</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modalImageContainer}>
            <Image
              source={{ uri: imageFullUrl }}
              style={styles.modalImage}
              resizeMode="contain"
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
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  authorInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  authorName: {
    fontSize: Typography.bodyLarge,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  streakBadge: {
    backgroundColor: Colors.fireLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 6,
  },
  streakBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.fire,
  },
  groupSubtitle: {
    fontSize: Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  pointsPill: {
    backgroundColor: Colors.primarySurface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  pointsPillText: {
    fontSize: Typography.bodySmall,
    fontWeight: '800',
    color: Colors.primary,
  },
  imageWrapper: {
    width: '100%',
    height: 280,
    backgroundColor: '#0f172a',
    position: 'relative',
  },
  devotionalImage: {
    width: '100%',
    height: '100%',
  },
  zoomPill: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  zoomPillText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  contentBody: {
    padding: Spacing.md,
  },
  passageBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginBottom: Spacing.xs,
  },
  passageText: {
    fontSize: Typography.bodyMedium,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  notesText: {
    fontSize: Typography.bodyMedium,
    color: Colors.textSecondary,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  reactionsBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    padding: Spacing.sm,
    justifyContent: 'space-around',
    backgroundColor: Colors.surfaceAlt,
  },
  reactionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 44,
  },
  reactionButtonActive: {
    backgroundColor: Colors.primarySurface,
    borderColor: Colors.primaryLight,
  },
  reactionEmoji: {
    fontSize: 18,
    marginRight: 6,
  },
  reactionLabel: {
    fontSize: Typography.bodySmall,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  reactionLabelActive: {
    color: Colors.primaryDark,
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: '#000',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: '#111',
  },
  modalTitle: {
    color: '#fff',
    fontSize: Typography.titleMedium,
    fontWeight: '700',
  },
  modalCloseButton: {
    backgroundColor: '#333',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  modalCloseText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: Typography.bodyMedium,
  },
  modalImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
});
