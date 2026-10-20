import { Alert } from '../services/alerts';
import React from 'react';
import {

Image,
Modal,
ScrollView,
StyleSheet,
Text,
TouchableOpacity,
View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Colors,Spacing,Typography } from '../theme/colors';
import { AccessibleButton } from './AccessibleButton';

interface AccountSwitcherModalProps {
  visible: boolean;
  onClose: () => void;
  onAddAccount?: () => void;
}

export const AccountSwitcherModal: React.FC<AccountSwitcherModalProps> = ({
  visible,
  onClose,
  onAddAccount,
}) => {
  const { user, savedAccounts, switchAccount, removeSavedAccount, logout } = useAuth();

  const handleSwitch = async (accountId: string) => {
    if (user?.id === accountId) {
      onClose();
      return;
    }
    await switchAccount(accountId);
    onClose();
  };

  const handleRemove = (accountId: string, accountName: string) => {
    Alert.alert(
      'Remover Conta Deste Aparelho',
      `Deseja desconectar a conta de "${accountName}" deste dispositivo?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            await removeSavedAccount(accountId);
            onClose();
          },
        },
      ]
    );
  };

  const handleFullLogout = () => {
    Alert.alert(
      'Sair da Conta',
      'Tem certeza de que deseja encerrar sua sessão atual?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            await logout();
            onClose();
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.header}>
            <Text style={styles.emoji}>👥</Text>
            <Text style={styles.title}>Alternar Usuário</Text>
            <Text style={styles.subtitle}>
              Troque rapidamente de membro ou familiar no mesmo aparelho com 1 toque.
            </Text>
          </View>

          <ScrollView style={styles.listContainer}>
            {savedAccounts.map((acc) => {
              const isCurrent = acc.id === user?.id;
              const avatar =
                acc.avatar_url ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(acc.name)}&background=2563eb&color=fff&size=100`;

              return (
                <TouchableOpacity
                  key={acc.id}
                  activeOpacity={0.8}
                  onPress={() => handleSwitch(acc.id)}
                  style={[styles.accountCard, isCurrent && styles.accountCardActive]}
                >
                  <Image source={{ uri: avatar }} style={styles.avatar} />
                  <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                      <Text style={styles.accountName} numberOfLines={1}>
                        {acc.name}
                      </Text>
                      {isCurrent ? (
                        <View style={styles.activePill}>
                          <Text style={styles.activePillText}>Ativo Agora</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.churchName} numberOfLines={1}>
                      {acc.church_name || 'Igreja Parceira'}
                    </Text>
                    {acc.username_handle ? (
                      <Text style={styles.handleText}>{acc.username_handle}</Text>
                    ) : null}
                  </View>

                  <TouchableOpacity
                    onPress={() => handleRemove(acc.id, acc.name)}
                    style={styles.deleteBtn}
                    accessibilityLabel="Remover conta"
                  >
                    <Text style={styles.deleteIcon}>🗑️</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.footer}>
            {onAddAccount ? (
              <AccessibleButton
                title="+ Conectar Outra Conta"
                variant="outline"
                onPress={() => {
                  onClose();
                  onAddAccount();
                }}
                style={{ marginBottom: 10 }}
              />
            ) : null}

            <AccessibleButton
              title="🚪 Encerrar Sessão (Logout)"
              variant="secondary"
              onPress={handleFullLogout}
              style={{ marginBottom: 10 }}
            />

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    width: '100%',
    maxHeight: '85%',
    padding: Spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  emoji: {
    fontSize: 34,
  },
  title: {
    fontSize: Typography.titleLarge,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginTop: 4,
  },
  subtitle: {
    fontSize: Typography.bodySmall,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  listContainer: {
    maxHeight: 280,
    marginVertical: Spacing.sm,
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  accountCardActive: {
    borderColor: Colors.success,
    backgroundColor: '#f0fdf4',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountName: {
    fontSize: Typography.bodyLarge,
    fontWeight: '700',
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  activePill: {
    backgroundColor: Colors.success,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  activePillText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  churchName: {
    fontSize: Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  handleText: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '600',
  },
  deleteBtn: {
    padding: 8,
    marginLeft: 6,
  },
  deleteIcon: {
    fontSize: 16,
  },
  footer: {
    marginTop: Spacing.sm,
  },
  closeBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  closeText: {
    color: Colors.textSecondary,
    fontWeight: '600',
  },
});
