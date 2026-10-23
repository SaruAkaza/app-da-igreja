import { Alert } from '../services/alerts';
import React,{ useState } from 'react';
import * as Linking from 'expo-linking';
import {

Modal,
Platform,
ScrollView,
StyleSheet,
Switch,
Text,
TextInput,
TouchableOpacity,
View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { api, DEFAULT_API_URL } from '../services/api';
import { Colors,Spacing,Typography } from '../theme/colors';
import { AccessibleButton } from './AccessibleButton';

interface HomeMenuDrawerProps {
  visible: boolean;
  onClose: () => void;
  navigation: any;
  hasActiveBattle: boolean;
  battleTitle?: string;
  onOpenAccountSwitcher: () => void;
  onOpenProfileCompletion: () => void;
}

export const HomeMenuDrawer: React.FC<HomeMenuDrawerProps> = ({
  visible,
  onClose,
  navigation,
  hasActiveBattle,
  battleTitle,
  onOpenAccountSwitcher,
  onOpenProfileCompletion,
}) => {
  const { user, token, isSeniorMode, toggleSeniorMode, joinChurch, joinGroupByCode } = useAuth();
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [churchOrCellCode, setChurchOrCellCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);

  const percent = user?.profile_completion_percent || 0;
  const is100Percent = percent >= 100;

  const handleNavigate = (screenName: string, params?: any) => {
    onClose();
    navigation.navigate(screenName, params);
  };

  const handleJoinCode = async () => {
    if (!churchOrCellCode.trim()) {
      Alert.alert('Atenção', 'Informe o código da congregação ou da célula.');
      return;
    }

    setJoinLoading(true);
    try {
      const code = churchOrCellCode.trim().toUpperCase();
      // Tentar vincular por célula ou igreja
      try { await joinGroupByCode(code); }
      catch (error: any) { if (error.response?.status !== 404) throw error; await joinChurch(code); }
      Alert.alert('Tudo certo!', 'Seu vínculo com a comunidade foi atualizado.');
      setJoinModalVisible(false);
      setChurchOrCellCode('');
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Código não encontrado. Verifique com seu líder ou pastor.';
      Alert.alert('Erro ao vincular', msg);
    } finally {
      setJoinLoading(false);
    }
  };

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

          <View style={styles.drawerCard}>
            {/* Cabeçalho do Drawer */}
            <View style={styles.drawerHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.drawerGreeting}>A paz do Senhor,</Text>
                <Text style={styles.drawerUserName} numberOfLines={1}>
                  {user?.name} {user?.last_name || ''}
                </Text>
                <Text style={styles.drawerHandle}>{user?.username_handle || '@membro'}</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.drawerContent}>
              {/* Card de Progresso do Perfil (100% e Bônus) */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  onClose();
                  onOpenProfileCompletion();
                }}
                style={[styles.profileProgressCard, is100Percent && styles.profileProgressCardDone]}
              >
                <View style={styles.progressHeaderRow}>
                  <Text style={styles.progressTitle}>📋 Status do Seu Perfil</Text>
                  <Text style={[styles.progressPercent, is100Percent && { color: Colors.success }]}>
                    {percent}%
                  </Text>
                </View>

                {/* Barra de Progresso */}
                <View style={styles.progressBarTrack}>
                  <View style={[styles.progressBarFill, { width: `${percent}%` }, is100Percent && { backgroundColor: Colors.success }]} />
                </View>

                <Text style={styles.progressSub}>
                  {is100Percent
                    ? '🎉 Perfil 100% completo! Bônus de +100 pontos garantido.'
                    : 'Toque para completar os dados pendentes e ganhar +100 pontos de bônus!'}
                </Text>
              </TouchableOpacity>

              {/* Seção de Ações Principais */}
              <Text style={styles.menuSectionTitle}>MINHA CONGREGAÇÃO & GRUPOS</Text>

              <AccessibleButton title="Meus grupos de conexão" variant="outline" onPress={() => handleNavigate('Connections')} />
              {/* 1. Ranking da Minha Célula / Grupo */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleNavigate('GroupsRanking')}
                style={styles.menuItem}
              >
                <Text style={styles.menuItemIcon}>🏆</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuItemTitle}>Ranking da Minha Célula</Text>
                  <Text style={styles.menuItemSub}>Classificação e constância dos membros</Text>
                </View>
                <Text style={styles.menuItemArrow}>›</Text>
              </TouchableOpacity>

              {/* 2. Batalha de Células (Condicional) */}
              {hasActiveBattle ? (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handleNavigate('GroupsRanking')}
                  style={[styles.menuItem, styles.menuItemHighlight]}
                >
                  <Text style={styles.menuItemIcon}>⚔️</Text>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={styles.menuItemTitle}>Batalha de Células</Text>
                      <View style={styles.activeBadge}>
                        <Text style={styles.activeBadgeText}>Ativa</Text>
                      </View>
                    </View>
                    <Text style={styles.menuItemSub}>{battleTitle || 'Gincana bíblica entre grupos'}</Text>
                  </View>
                  <Text style={styles.menuItemArrow}>›</Text>
                </TouchableOpacity>
              ) : (
                <View style={[styles.menuItem, styles.menuItemDisabled]}>
                  <Text style={styles.menuItemIcon}>🔒</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.menuItemTitle, { color: Colors.textMuted }]}>
                      Batalha de Células (Bloqueada)
                    </Text>
                    <Text style={styles.menuItemSub}>
                      Ativada quando sua célula estiver inscrita em uma gincana.
                    </Text>
                  </View>
                </View>
              )}

              {/* 3. Meus Prêmios e Cupons */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleNavigate('Rewards')}
                style={styles.menuItem}
              >
                <Text style={styles.menuItemIcon}>🎁</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuItemTitle}>Meus Prêmios & Cupons</Text>
                  <Text style={styles.menuItemSub}>Resgate com QR Code no culto ({user?.total_points || 0} pts)</Text>
                </View>
                <Text style={styles.menuItemArrow}>›</Text>
              </TouchableOpacity>

              {/* 4. Dicas Bíblicas do Líder */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleNavigate('Feedbacks')}
                style={styles.menuItem}
              >
                <Text style={styles.menuItemIcon}>💌</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuItemTitle}>Orientações Pastorais</Text>
                  <Text style={styles.menuItemSub}>Dicas sigilosas do seu discipulador</Text>
                </View>
                <Text style={styles.menuItemArrow}>›</Text>
              </TouchableOpacity>

              {/* 5. Inserir Código de Igreja ou Célula */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setJoinModalVisible(true)}
                style={styles.menuItem}
              >
                <Text style={styles.menuItemIcon}>⛪</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuItemTitle}>Vincular Igreja ou Célula</Text>
                  <Text style={styles.menuItemSub}>
                    {user?.church_name ? `Atual: ${user.church_name} (${user.church_code || ''})` : 'Entrar com código de convite'}
                  </Text>
                </View>
                <Text style={styles.menuItemArrow}>›</Text>
              </TouchableOpacity>

              {/* 6. Painel do Administrador (Exclusivo para Pastores e Admins da Igreja) */}
              {user?.role === 'church_admin' || user?.role === 'super_admin' ? (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    onClose();
                    const url = new URL('/admin/', api.defaults.baseURL || DEFAULT_API_URL).href;
                    if (Platform.OS === 'web' && typeof window !== 'undefined') {
                      if (new URL(url).origin === window.location.origin && token) {
                        window.sessionStorage.setItem('communhao_session', token);
                        window.location.assign(url);
                      } else window.open(url, '_blank', 'noopener,noreferrer');
                    } else void Linking.openURL(url).catch(() => Alert.alert('Painel da Igreja', `Acesse pelo navegador: ${url}`));
                  }}
                  style={[styles.menuItem, { backgroundColor: '#f0f6ec', borderColor: '#bcd8ba', borderWidth: 1 }]}
                >
                  <Text style={styles.menuItemIcon}>💻</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.menuItemTitle, { color: Colors.primaryDark }]}>Painel da Igreja (Web)</Text>
                    <Text style={styles.menuItemSub}>Gerenciar congregação, cargos, células e prêmios</Text>
                  </View>
                  <Text style={[styles.menuItemArrow, { color: Colors.primary }]}>↗</Text>
                </TouchableOpacity>
              ) : null}

              {/* Seção de Acessibilidade & Contas */}
              <Text style={[styles.menuSectionTitle, { marginTop: 16 }]}>PREFERÊNCIAS & FAMÍLIA</Text>

              {/* Alternador do Modo Idoso */}
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchTitle}>👓 Modo Idoso / Letras Grandes</Text>
                  <Text style={styles.switchSub}>Aumenta botões e textos para maior clareza visual.</Text>
                </View>
                <Switch
                  value={isSeniorMode}
                  onValueChange={toggleSeniorMode}
                  trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                  thumbColor={isSeniorMode ? Colors.primary : '#ffffff'}
                />
              </View>

              {/* Alternar Usuário / Família */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  onClose();
                  onOpenAccountSwitcher();
                }}
                style={[styles.menuItem, { marginTop: 10 }]}
              >
                <Text style={styles.menuItemIcon}>👥</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuItemTitle}>Trocar Usuário / Alternar Perfil</Text>
                  <Text style={styles.menuItemSub}>Membros e familiares cadastrados no aparelho</Text>
                </View>
                <Text style={styles.menuItemArrow}>›</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal para Inserir Código de Igreja ou Célula */}
      <Modal visible={joinModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.joinCard}>
            <Text style={styles.joinEmoji}>⛪</Text>
            <Text style={styles.joinTitle}>Código de Convite</Text>
            <Text style={styles.joinSub}>
              Digite o código da sua congregação (ex: VIDEIRA26) ou da sua célula para entrar diretamente.
            </Text>

            <TextInput
              style={styles.joinInput}
              placeholder="Ex: VIDEIRA26 ou TIAGO26"
              autoCapitalize="characters"
              value={churchOrCellCode}
              onChangeText={(t) => setChurchOrCellCode(t.toUpperCase())}
            />

            <AccessibleButton
              title="Vincular Agora"
              variant="primary"
              onPress={handleJoinCode}
              loading={joinLoading}
              style={{ marginTop: 12 }}
            />

            <TouchableOpacity onPress={() => setJoinModalVisible(false)} style={{ marginTop: 10, alignItems: 'center' }}>
              <Text style={{ color: Colors.textSecondary, fontWeight: '600' }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  drawerCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '85%',
    padding: Spacing.lg,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  drawerGreeting: {
    fontSize: Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  drawerUserName: {
    fontSize: Typography.titleLarge,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  drawerHandle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    fontSize: 18,
    color: Colors.textMuted,
    fontWeight: '700',
  },
  drawerContent: {
    paddingBottom: Spacing.xl,
  },
  profileProgressCard: {
    backgroundColor: '#eff6ff',
    borderWidth: 1.5,
    borderColor: '#bfdbfe',
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
  },
  profileProgressCardDone: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  progressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressTitle: {
    fontSize: Typography.bodySmall,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  progressPercent: {
    fontSize: Typography.bodyLarge,
    fontWeight: '900',
    color: Colors.primary,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: '#dbeafe',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
  progressSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 6,
    lineHeight: 16,
  },
  menuSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 6,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
  },
  menuItemHighlight: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  menuItemDisabled: {
    backgroundColor: '#f1f5f9',
    opacity: 0.7,
  },
  menuItemIcon: {
    fontSize: 22,
    marginRight: 12,
  },
  menuItemTitle: {
    fontSize: Typography.bodyMedium,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  menuItemSub: {
    fontSize: Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  menuItemArrow: {
    fontSize: 20,
    color: Colors.textMuted,
    fontWeight: '700',
    marginLeft: 6,
  },
  activeBadge: {
    backgroundColor: Colors.success,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 6,
  },
  activeBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surfaceSecondary,
    padding: 14,
    borderRadius: 16,
  },
  switchTitle: {
    fontSize: Typography.bodyMedium,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  switchSub: {
    fontSize: Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
    maxWidth: 240,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  joinCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    width: '100%',
    padding: Spacing.lg,
    alignItems: 'center',
  },
  joinEmoji: {
    fontSize: 36,
  },
  joinTitle: {
    fontSize: Typography.titleLarge,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginTop: 4,
  },
  joinSub: {
    fontSize: Typography.bodySmall,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginVertical: 8,
  },
  joinInput: {
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 2,
    borderColor: Colors.primaryLight,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 2,
    color: Colors.primaryDark,
    width: '100%',
    marginVertical: 8,
  },
});
