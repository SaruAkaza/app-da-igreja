import { Alert } from '../services/alerts';
import React,{ useState } from 'react';
import {

Modal,
ScrollView,
StyleSheet,
Text,
TextInput,
TouchableOpacity,
View,
} from 'react-native';
import { api } from '../services/api';
import { Colors,Spacing,Typography } from '../theme/colors';
import { AccessibleButton } from './AccessibleButton';

interface ForgotPasswordModalProps {
  visible: boolean;
  onClose: () => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({ visible, onClose }) => {
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequestCode = async () => {
    if (!email) {
      Alert.alert('Atenção', 'Informe seu e-mail cadastrado.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/api/auth/forgot-password', { email });
      Alert.alert(
        'Código Enviado',
        res.data.dev_code
          ? `Código de 6 dígitos gerado: ${res.data.dev_code}\n(No ambiente de produção, este código chega ao seu e-mail).`
          : 'Enviamos um código de 6 dígitos para o seu e-mail cadastrado.'
      );
      if (res.data.dev_code) {
        setCode(res.data.dev_code);
      }
      setStep('reset');
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Erro ao solicitar código de recuperação.';
      Alert.alert('Erro', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!code || !newPassword || !confirmPassword) {
      Alert.alert('Atenção', 'Preencha o código e a nova senha.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Erro', 'A confirmação de senha não confere com a nova senha.');
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert('Senha Fraca', 'A senha deve conter no mínimo 8 caracteres.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/auth/reset-password', {
        email,
        code,
        newPassword,
        confirmPassword,
      });

      Alert.alert('Sucesso!', 'Sua senha foi redefinida com sucesso. Você já pode fazer login!');
      resetAndClose();
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Erro ao redefinir senha. Verifique o código digitado.';
      Alert.alert('Erro', msg);
    } finally {
      setLoading(false);
    }
  };

  const resetAndClose = () => {
    setStep('request');
    setEmail('');
    setCode('');
    setNewPassword('');
    setConfirmPassword('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <ScrollView contentContainerStyle={{ paddingBottom: Spacing.md }}>
            <View style={styles.header}>
              <Text style={styles.emoji}>🔑</Text>
              <Text style={styles.title}>Recuperar Minha Senha</Text>
              <Text style={styles.subtitle}>
                {step === 'request'
                  ? 'Informe seu e-mail cadastrado para receber um código de segurança de 6 dígitos.'
                  : 'Digite o código de 6 dígitos recebido e escolha sua nova senha forte.'}
              </Text>
            </View>

            {step === 'request' ? (
              <View>
                <Text style={styles.label}>SEU E-MAIL CADASTRADO</Text>
                <TextInput
                  style={styles.input}
                  placeholder="exemplo@igreja.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />

                <AccessibleButton
                  title="Enviar Código de 6 Dígitos"
                  variant="primary"
                  onPress={handleRequestCode}
                  loading={loading}
                  style={{ marginTop: 16 }}
                />
              </View>
            ) : (
              <View>
                <Text style={styles.label}>CÓDIGO DE 6 DÍGITOS RECEBIDO</Text>
                <TextInput
                  style={[styles.input, styles.codeInput]}
                  placeholder="000000"
                  keyboardType="numeric"
                  maxLength={6}
                  value={code}
                  onChangeText={setCode}
                />

                <Text style={styles.label}>NOVA SENHA FORTE</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Mínimo 8 letras, números e símbolos"
                  secureTextEntry
                  value={newPassword}
                  onChangeText={setNewPassword}
                />

                <Text style={styles.label}>CONFIRMAR NOVA SENHA</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Repita a nova senha"
                  secureTextEntry
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />

                <AccessibleButton
                  title="Redefinir Senha"
                  variant="success"
                  onPress={handleResetPassword}
                  loading={loading}
                  style={{ marginTop: 16 }}
                />

                <TouchableOpacity onPress={() => setStep('request')} style={{ marginTop: 10, alignItems: 'center' }}>
                  <Text style={styles.linkText}>← Voltar e reenviar código</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity onPress={resetAndClose} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Fechar</Text>
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
  codeInput: {
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 6,
    color: Colors.primaryDark,
  },
  linkText: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: Typography.bodySmall,
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
});
