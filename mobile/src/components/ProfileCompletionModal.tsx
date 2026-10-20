import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import { Colors, Spacing, Typography } from '../theme/colors';
import { AccessibleButton } from './AccessibleButton';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface ProfileCompletionModalProps {
  visible: boolean;
  onClose: () => void;
}

export const ProfileCompletionModal: React.FC<ProfileCompletionModalProps> = ({ visible, onClose }) => {
  const { user, refreshProfile } = useAuth();

  const [lastName, setLastName] = useState('');
  const [usernameHandle, setUsernameHandle] = useState('');
  const [age, setAge] = useState('');
  const [addressStreet, setAddressStreet] = useState('');
  const [addressNeighborhood, setAddressNeighborhood] = useState('');
  const [addressCity, setAddressCity] = useState('');
  const [addressState, setAddressState] = useState('');
  const [addressZipcode, setAddressZipcode] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setLastName(user.last_name || '');
      setUsernameHandle(user.username_handle || '');
      setAge(user.age ? String(user.age) : '');
      setAddressStreet(user.address_street || '');
      setAddressNeighborhood(user.address_neighborhood || '');
      setAddressCity(user.address_city || 'São Paulo');
      setAddressState(user.address_state || 'SP');
      setAddressZipcode(user.address_zipcode || '');
      setAvatarUrl(user.avatar_url || '');
    }
  }, [user]);

  const percent = user?.profile_completion_percent || 0;
  const missing = user?.missing_profile_fields || [];
  const bonusAwarded = user?.profile_bonus_awarded;

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await api.post('/api/auth/update-profile', {
        lastName: lastName.trim(),
        usernameHandle: usernameHandle.trim(),
        age: age ? Number(age) : undefined,
        addressStreet: addressStreet.trim(),
        addressNeighborhood: addressNeighborhood.trim(),
        addressCity: addressCity.trim(),
        addressState: addressState.trim().toUpperCase(),
        addressZipcode: addressZipcode.trim(),
        avatarUrl: avatarUrl.trim() || undefined,
      });

      await refreshProfile();

      if (res.data.bonus_awarded_now) {
        Alert.alert(
          '🎉 Parabéns!',
          'Seu cadastro atingiu 100% de conclusão!\nVocê ganhou +100 pontos de bônus imediato!'
        );
      } else {
        Alert.alert('Sucesso', `Perfil atualizado! Progresso: ${res.data.profile_completion_percent}%`);
      }
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Erro ao atualizar dados.';
      Alert.alert('Erro', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
              <Text style={styles.emoji}>📋</Text>
              <Text style={styles.title}>Completar Cadastro</Text>
              <Text style={styles.subtitle}>
                Preencha todos os campos para atingir 100% e resgatar o bônus de +100 pontos!
              </Text>
            </View>

            {/* Barra de Progresso */}
            <View style={styles.progressCard}>
              <View style={styles.progressRow}>
                <Text style={styles.progressLabel}>Progresso Atual:</Text>
                <Text style={styles.progressValue}>{percent}%</Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${percent}%` }, percent >= 100 && { backgroundColor: Colors.success }]} />
              </View>

              {percent >= 100 ? (
                <Text style={styles.doneText}>🎉 100% Completo! Bônus de +100 pontos concedido.</Text>
              ) : (
                <View style={styles.missingBox}>
                  <Text style={styles.missingTitle}>Falta preencher:</Text>
                  {missing.map((item, idx) => (
                    <Text key={idx} style={styles.missingItem}>
                      • {item}
                    </Text>
                  ))}
                </View>
              )}
            </View>

            {/* Formulário de Campos Pendentes */}
            <Text style={styles.formSectionTitle}>ATUALIZAR SEUS DADOS:</Text>

            <Text style={styles.label}>SOBRENOME *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Izalas"
              value={lastName}
              onChangeText={setLastName}
            />

            <Text style={styles.label}>NOME DE USUÁRIO (@HANDLE) *</Text>
            <TextInput
              style={styles.input}
              placeholder="@seu.nome"
              autoCapitalize="none"
              value={usernameHandle}
              onChangeText={(t) => setUsernameHandle(t.startsWith('@') ? t : `@${t}`)}
            />

            <Text style={styles.label}>IDADE *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: 24"
              keyboardType="numeric"
              value={age}
              onChangeText={setAge}
            />

            <Text style={styles.label}>FOTO DE PERFIL OU FOTO DO CADERNO (URL)</Text>
            <TextInput
              style={styles.input}
              placeholder="https://suafoto.com/avatar.jpg"
              value={avatarUrl}
              onChangeText={setAvatarUrl}
            />

            <Text style={styles.label}>RUA E NÚMERO</Text>
            <TextInput
              style={styles.input}
              placeholder="Rua das Oliveiras, 100"
              value={addressStreet}
              onChangeText={setAddressStreet}
            />

            <View style={styles.row}>
              <View style={{ flex: 2, marginRight: 8 }}>
                <Text style={styles.label}>BAIRRO</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Jardim da Fé"
                  value={addressNeighborhood}
                  onChangeText={setAddressNeighborhood}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>CEP</Text>
                <TextInput
                  style={styles.input}
                  placeholder="01000-000"
                  keyboardType="numeric"
                  value={addressZipcode}
                  onChangeText={setAddressZipcode}
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={{ flex: 2, marginRight: 8 }}>
                <Text style={styles.label}>CIDADE</Text>
                <TextInput
                  style={styles.input}
                  placeholder="São Paulo"
                  value={addressCity}
                  onChangeText={setAddressCity}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>ESTADO</Text>
                <TextInput
                  style={styles.input}
                  placeholder="SP"
                  maxLength={2}
                  autoCapitalize="characters"
                  value={addressState}
                  onChangeText={setAddressState}
                />
              </View>
            </View>

            <AccessibleButton
              title="Salvar e Resgatar Bônus"
              variant="success"
              onPress={handleSave}
              loading={loading}
              style={{ marginTop: 16 }}
            />

            <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Voltar</Text>
            </TouchableOpacity>
          </ScrollView>
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
    maxHeight: '90%',
    padding: Spacing.md,
  },
  scrollContent: {
    paddingBottom: Spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.sm,
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
    lineHeight: 18,
  },
  progressCard: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 16,
    padding: 12,
    marginVertical: 10,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: Typography.bodySmall,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  progressValue: {
    fontSize: Typography.titleMedium,
    fontWeight: '900',
    color: Colors.primary,
  },
  track: {
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
  doneText: {
    fontSize: 12,
    color: Colors.success,
    fontWeight: '700',
    marginTop: 6,
  },
  missingBox: {
    marginTop: 8,
  },
  missingTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textSecondary,
  },
  missingItem: {
    fontSize: 11,
    color: Colors.warningDark,
    fontWeight: '600',
    marginTop: 2,
  },
  formSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 0.8,
    marginTop: 10,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 8,
    marginBottom: 4,
  },
  input: {
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: Typography.bodyMedium,
    color: Colors.textPrimary,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 6,
  },
  cancelText: {
    color: Colors.textSecondary,
    fontWeight: '600',
  },
});
