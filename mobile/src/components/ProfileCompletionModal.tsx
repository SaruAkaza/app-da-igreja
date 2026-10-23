import { Alert } from '../services/alerts';
import React,{ useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { cleanCep, formatCep, searchCep } from '../services/cep';
import { Colors,Spacing,Typography } from '../theme/colors';
import { AccessibleButton } from './AccessibleButton';

interface ProfileCompletionModalProps {
  visible: boolean;
  onClose: () => void;
}

export const ProfileCompletionModal: React.FC<ProfileCompletionModalProps> = ({ visible, onClose }) => {
  const { user } = useAuth();
  return visible ? <ProfileForm key={user?.id} visible={visible} onClose={onClose} /> : null;
};
const ProfileForm: React.FC<ProfileCompletionModalProps> = ({ visible, onClose }) => {
  const { user, refreshProfile } = useAuth();

  const [lastName, setLastName] = useState(user?.last_name || '');
  const [usernameHandle, setUsernameHandle] = useState(user?.username_handle || '');
  const [age, setAge] = useState(user?.age ? String(user.age) : '');
  const [parentPhone, setParentPhone] = useState(user?.parent_phone || '');
  const [parentCode, setParentCode] = useState('');
  const [consentSent, setConsentSent] = useState(false);
  const [consentDemoCode, setConsentDemoCode] = useState('');
  const [sendingConsent, setSendingConsent] = useState(false);
  const [addressStreet, setAddressStreet] = useState(user?.address_street || '');
  const [addressNeighborhood, setAddressNeighborhood] = useState(user?.address_neighborhood || '');
  const [addressCity, setAddressCity] = useState(user?.address_city || '');
  const [addressState, setAddressState] = useState(user?.address_state || '');
  const [addressZipcode, setAddressZipcode] = useState(user?.address_zipcode || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [loading, setLoading] = useState(false);
  const [cepSearching, setCepSearching] = useState(false);
  const [cepStatus, setCepStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [lastSearchedCep, setLastSearchedCep] = useState('');

  const handleZipcodeChange = (text: string) => {
    const formatted = formatCep(text);
    setAddressZipcode(formatted);
    const digits = cleanCep(text);
    if (digits.length === 8 && digits !== lastSearchedCep) {
      void handleSearchCep(digits);
    }
  };

  const handleSearchCep = async (cepToSearch: string) => {
    const digits = cleanCep(cepToSearch);
    if (digits.length !== 8) {
      setCepStatus({ type: 'error', message: 'Digite o CEP com 8 números.' });
      return;
    }
    setCepSearching(true);
    setCepStatus(null);
    setLastSearchedCep(digits);
    try {
      const res = await searchCep(digits);
      if (res.street) setAddressStreet(res.street);
      if (res.neighborhood) setAddressNeighborhood(res.neighborhood);
      if (res.city) setAddressCity(res.city);
      if (res.state) setAddressState(res.state);
      setAddressZipcode(res.cep);
      setCepStatus({
        type: 'success',
        message: `Endereço localizado via Correios: ${res.street ? res.street + ', ' : ''}${res.neighborhood || ''} - ${res.city}/${res.state}`,
      });
    } catch (err: any) {
      setCepStatus({
        type: 'error',
        message: err.message || 'CEP não encontrado. Preencha manualmente.',
      });
    } finally {
      setCepSearching(false);
    }
  };

  const percent = user?.profile_completion_percent || 0;
  const missing = user?.missing_profile_fields || [];
  const minor = Number(age) > 0 && Number(age) < 18;
  const needsConsent = minor && (!user?.parent_consent_verified || !user?.age || user.age >= 18 || parentPhone.replace(/\D/g, '') !== (user?.parent_phone || '').replace(/\D/g, ''));

  const sendConsent = async () => {
    if (sendingConsent) return;
    setSendingConsent(true);
    try {
      const response = await api.post('/api/auth/parental-consent/send', { parentPhone, childName: user?.name });
      setConsentSent(true);
      setParentCode('');
      setConsentDemoCode(response.data.dev_code || '');
    } catch (error: any) {
      Alert.alert('Autorização do responsável', error.response?.data?.error || 'Não foi possível enviar o código. Tente novamente.');
    } finally {
      setSendingConsent(false);
    }
  };

  const handleSave = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const consent = needsConsent ? await api.post('/api/auth/parental-consent/verify', { parentPhone, code: parentCode.trim() }) : null;
      const res = await api.post('/api/auth/update-profile', {
        lastName: lastName.trim(),
        usernameHandle: usernameHandle.trim(),
        age: age ? Number(age) : undefined,
        ...(minor ? { parentPhone, ...(consent ? { parentConsentToken: consent.data.consentToken } : {}) } : {}),
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

            {minor ? <>
              <Text style={styles.label}>TELEFONE DO RESPONSÁVEL COM DDD</Text>
              <TextInput
                style={styles.input}
                accessibilityLabel="Telefone do responsável com DDD"
                keyboardType="phone-pad"
                value={parentPhone}
                onChangeText={value => { setParentPhone(value); setConsentSent(false); setParentCode(''); setConsentDemoCode(''); }}
              />
              {needsConsent ? <>
                <AccessibleButton title={consentSent ? 'Reenviar código ao responsável' : 'Solicitar autorização ao responsável'} onPress={sendConsent} loading={sendingConsent} disabled={loading} />
                {consentSent ? <Text style={styles.sectionSubtitle}>O código foi enviado diretamente ao seu responsável. Peça que ele confirme a autorização.</Text> : null}
                {consentDemoCode ? <Text style={styles.sectionSubtitle}>Demonstração · código do responsável: {consentDemoCode}</Text> : null}
                <Text style={styles.label}>CÓDIGO INFORMADO PELO RESPONSÁVEL</Text>
                <TextInput
                  style={styles.input}
                  accessibilityLabel="Código informado pelo responsável"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={parentCode}
                  onChangeText={setParentCode}
                />
              </> : null}
            </> : null}

            <Text style={styles.label}>FOTO DE PERFIL OU FOTO DO CADERNO (URL)</Text>
            <TextInput
              style={styles.input}
              placeholder="https://suafoto.com/avatar.jpg"
              value={avatarUrl}
              onChangeText={setAvatarUrl}
            />

            <View style={styles.sectionHeader}>
              <Text style={styles.formSectionTitle}>ENDEREÇO RESIDENCIAL:</Text>
              <Text style={styles.sectionSubtitle}>Digite o CEP para buscar o endereço automaticamente via Correios</Text>
            </View>

            <View style={styles.cepRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.label}>CEP (CORREIOS)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="01001-000"
                  keyboardType="numeric"
                  maxLength={9}
                  value={addressZipcode}
                  onChangeText={handleZipcodeChange}
                />
              </View>
              <TouchableOpacity
                style={[styles.cepSearchBtn, cepSearching && styles.cepSearchBtnDisabled]}
                onPress={() => void handleSearchCep(addressZipcode)}
                disabled={cepSearching}
                accessibilityRole="button"
                accessibilityLabel="Buscar endereço pelo CEP nos Correios"
              >
                {cepSearching ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="search-outline" size={16} color="#fff" />
                    <Text style={styles.cepSearchBtnText}>Buscar CEP</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {cepStatus ? (
              <View style={[styles.cepStatusBox, cepStatus.type === 'success' ? styles.cepSuccess : styles.cepError]}>
                <Ionicons
                  name={cepStatus.type === 'success' ? 'checkmark-circle-outline' : 'alert-circle-outline'}
                  size={16}
                  color={cepStatus.type === 'success' ? Colors.success : Colors.danger}
                />
                <Text style={[styles.cepStatusText, cepStatus.type === 'success' ? styles.cepSuccessText : styles.cepErrorText]}>
                  {cepStatus.message}
                </Text>
              </View>
            ) : null}

            <Text style={styles.label}>RUA E NÚMERO</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Praça da Sé, 100"
              value={addressStreet}
              onChangeText={setAddressStreet}
            />

            <View style={styles.row}>
              <View style={{ flex: 2, marginRight: 8 }}>
                <Text style={styles.label}>BAIRRO</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Sé"
                  value={addressNeighborhood}
                  onChangeText={setAddressNeighborhood}
                />
              </View>
              <View style={{ flex: 2, marginRight: 8 }}>
                <Text style={styles.label}>CIDADE</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: São Paulo"
                  value={addressCity}
                  onChangeText={setAddressCity}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>UF</Text>
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
    marginBottom: 2,
  },
  sectionHeader: {
    marginTop: 8,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  cepRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 4,
  },
  cepSearchBtn: {
    backgroundColor: Colors.primary,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  cepSearchBtnDisabled: {
    opacity: 0.6,
  },
  cepSearchBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  cepStatusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    marginVertical: 4,
    gap: 6,
  },
  cepSuccess: {
    backgroundColor: Colors.accentSurface,
  },
  cepError: {
    backgroundColor: '#fde8e8',
  },
  cepStatusText: {
    fontSize: 11,
    flex: 1,
    lineHeight: 16,
  },
  cepSuccessText: {
    color: Colors.success,
    fontWeight: '600',
  },
  cepErrorText: {
    color: Colors.danger,
    fontWeight: '600',
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
