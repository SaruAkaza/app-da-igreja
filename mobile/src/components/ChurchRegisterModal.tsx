import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Alert,
  Clipboard,
} from 'react-native';
import { Colors, Spacing, Typography } from '../theme/colors';
import { AccessibleButton } from './AccessibleButton';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface ChurchRegisterModalProps {
  visible: boolean;
  onClose: () => void;
}

export const ChurchRegisterModal: React.FC<ChurchRegisterModalProps> = ({ visible, onClose }) => {
  const { registerChurch } = useAuth();
  const [step, setStep] = useState<'form' | 'success'>('form');

  // Form State
  const [churchName, setChurchName] = useState('');
  const [denomination, setDenomination] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [addressFull, setAddressFull] = useState('');
  const [phone, setPhone] = useState('');
  const [pastorName, setPastorName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Success State
  const [createdChurch, setCreatedChurch] = useState<any>(null);

  const handleRegister = async () => {
    if (!churchName || !pastorName || !email || !password) {
      Alert.alert('Campos Obrigatórios', 'Preencha o nome da igreja, seu nome de pastor, e-mail e senha.');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Senha Fraca', 'A senha deve conter no mínimo 8 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Atenção', 'A confirmação de senha não confere com a senha digitada.');
      return;
    }

    setLoading(true);
    try {
      const res = await registerChurch({
        churchName: churchName.trim(),
        denomination: denomination.trim(),
        cnpj: cnpj.trim() || undefined,
        city: city.trim(),
        state: state.trim().toUpperCase(),
        addressFull: addressFull.trim(),
        phone: phone.trim(),
        pastorName: pastorName.trim(),
        email: email.trim().toLowerCase(),
        password,
      });

      setCreatedChurch(res.church);
      setStep('success');
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Erro ao cadastrar congregação. Tente novamente.';
      Alert.alert('Erro no Cadastro', msg);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    if (Clipboard?.setString) {
      Clipboard.setString(text);
      Alert.alert('Copiado!', `${label} copiado para a área de transferência.`);
    }
  };

  const openWhatsAppShare = () => {
    if (!createdChurch) return;
    const shareText = createdChurch.whatsapp_share_text || `A paz do Senhor! Entre no nosso app devocional com o código ${createdChurch.slug_code}`;
    const url = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    if (typeof window !== 'undefined' && window.open) {
      window.open(url, '_blank');
    } else {
      Alert.alert('Compartilhar no WhatsApp', shareText);
    }
  };

  const resetAndClose = () => {
    setStep('form');
    setChurchName('');
    setDenomination('');
    setCnpj('');
    setCity('');
    setState('');
    setAddressFull('');
    setPhone('');
    setPastorName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {step === 'form' ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
              <View style={styles.header}>
                <Text style={styles.emoji}>⛪</Text>
                <Text style={styles.title}>Cadastrar Minha Igreja</Text>
                <Text style={styles.subtitle}>
                  Crie o espaço digital da sua congregação, monte células de estudo e receba relatórios pastorais.
                </Text>
              </View>

              {/* Seção 1: Dados Institucionais da Igreja */}
              <Text style={styles.sectionHeading}>1. DADOS DA CONGREGAÇÃO</Text>

              <Text style={styles.label}>NOME DA IGREJA *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Igreja Videira Central"
                value={churchName}
                onChangeText={setChurchName}
              />

              <Text style={styles.label}>DENOMINAÇÃO</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Batista, Presbiteriana, Comunidade, etc."
                value={denomination}
                onChangeText={setDenomination}
              />

              <View style={styles.row}>
                <View style={{ flex: 2, marginRight: 8 }}>
                  <Text style={styles.label}>CNPJ (OPCIONAL)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="00.000.000/0001-00"
                    value={cnpj}
                    onChangeText={setCnpj}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>UF</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="SP"
                    maxLength={2}
                    autoCapitalize="characters"
                    value={state}
                    onChangeText={setState}
                  />
                </View>
              </View>
              <Text style={styles.hint}>ℹ️ O CNPJ é opcional para igrejas e células em fase de formalização.</Text>

              <Text style={styles.label}>CIDADE DO TEMPLO</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: São Paulo"
                value={city}
                onChangeText={setCity}
              />

              <Text style={styles.label}>ENDEREÇO COMPLETO</Text>
              <TextInput
                style={styles.input}
                placeholder="Rua, número, bairro"
                value={addressFull}
                onChangeText={setAddressFull}
              />

              <Text style={styles.label}>TELEFONE DA SECRETARIA</Text>
              <TextInput
                style={styles.input}
                placeholder="(11) 98765-4321"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />

              {/* Seção 2: Dados do Pastor / Administrador */}
              <Text style={[styles.sectionHeading, { marginTop: 20 }]}>2. DADOS DO PASTOR / ADMIN</Text>

              <Text style={styles.label}>NOME DO PASTOR OU LÍDER *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Pastor Davi Almeida"
                value={pastorName}
                onChangeText={setPastorName}
              />

              <Text style={styles.label}>E-MAIL PASTORAL *</Text>
              <TextInput
                style={styles.input}
                placeholder="pastor@suaigreja.com"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />

              <Text style={styles.label}>SENHA DE ACESSO *</Text>
              <TextInput
                style={styles.input}
                placeholder="Mínimo 8 letras, números e símbolos (!@#$)"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />

              <Text style={styles.label}>CONFIRMAR SENHA *</Text>
              <TextInput
                style={styles.input}
                placeholder="Repita sua senha"
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />

              <AccessibleButton
                title="Concluir Cadastro da Igreja"
                subtitle="Gerar código de congregação e liberar painel"
                variant="primary"
                onPress={handleRegister}
                loading={loading}
                style={{ marginTop: 16 }}
              />

              <TouchableOpacity onPress={resetAndClose} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Voltar / Cancelar</Text>
              </TouchableOpacity>
            </ScrollView>
          ) : (
            /* Tela de Boas-Vindas ao Pastor com Código e Link de WhatsApp */
            <View style={styles.successContainer}>
              <Text style={styles.successEmoji}>🎉</Text>
              <Text style={styles.successTitle}>Glória a Deus!</Text>
              <Text style={styles.successSub}>
                Sua congregação <Text style={{ fontWeight: '800' }}>{createdChurch?.name}</Text> foi criada com sucesso!
              </Text>

              <View style={styles.codeCard}>
                <Text style={styles.codeLabel}>CÓDIGO EXCLUSIVO DA SUA IGREJA:</Text>
                <Text style={styles.codeText}>{createdChurch?.slug_code}</Text>
                <Text style={styles.codeHint}>Seus membros devem digitar este código ao entrar no aplicativo.</Text>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => copyToClipboard(createdChurch?.slug_code, 'Código da Igreja')}
                  style={styles.copyPill}
                >
                  <Text style={styles.copyPillText}>📋 Copiar Código</Text>
                </TouchableOpacity>
              </View>

              <AccessibleButton
                title="📲 Compartilhar no WhatsApp"
                subtitle="Enviar convite pronto com link nos grupos"
                variant="success"
                onPress={openWhatsAppShare}
                style={{ width: '100%', marginBottom: 12 }}
              />

              <AccessibleButton
                title="🚪 Entrar no Aplicativo"
                subtitle="Acessar sua igreja como Administrador"
                variant="primary"
                onPress={resetAndClose}
                style={{ width: '100%' }}
              />
            </View>
          )}
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
    marginBottom: Spacing.md,
  },
  emoji: {
    fontSize: 36,
  },
  title: {
    fontSize: Typography.titleLarge,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginTop: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Typography.bodySmall,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 0.8,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 10,
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
  row: {
    flexDirection: 'row',
  },
  hint: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 4,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  cancelText: {
    color: Colors.textSecondary,
    fontWeight: '600',
    fontSize: Typography.bodyMedium,
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  successEmoji: {
    fontSize: 54,
  },
  successTitle: {
    fontSize: Typography.titleHero,
    fontWeight: '900',
    color: Colors.textPrimary,
    marginTop: 8,
  },
  successSub: {
    fontSize: Typography.bodyMedium,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 22,
    paddingHorizontal: Spacing.sm,
  },
  codeCard: {
    backgroundColor: Colors.primarySurface,
    borderWidth: 2,
    borderColor: Colors.primaryLight,
    borderRadius: 20,
    padding: Spacing.lg,
    width: '100%',
    alignItems: 'center',
    marginVertical: Spacing.lg,
  },
  codeLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  codeText: {
    fontSize: 32,
    fontWeight: '900',
    color: Colors.primaryDark,
    marginVertical: 6,
    letterSpacing: 2,
  },
  codeHint: {
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 10,
  },
  copyPill: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  copyPillText: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: Typography.bodySmall,
  },
});
