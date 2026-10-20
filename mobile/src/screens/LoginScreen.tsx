import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { Colors, Spacing, Typography } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { AccessibleButton } from '../components/AccessibleButton';
import { api, setApiBaseUrl } from '../services/api';
import { ForgotPasswordModal } from '../components/ForgotPasswordModal';
import { ChurchRegisterModal } from '../components/ChurchRegisterModal';
import { AccountSwitcherModal } from '../components/AccountSwitcherModal';

export const LoginScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { login, loginDemo, savedAccounts } = useAuth();
  const [emailOrHandle, setEmailOrHandle] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Modais auxiliares
  const [forgotModalVisible, setForgotModalVisible] = useState(false);
  const [churchModalVisible, setChurchModalVisible] = useState(false);
  const [accountSwitcherVisible, setAccountSwitcherVisible] = useState(false);
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [customIp, setCustomIp] = useState(api.defaults.baseURL || 'http://localhost:3000');

  const handleLogin = async () => {
    if (!emailOrHandle || !password) {
      Alert.alert('Atenção', 'Por favor, informe seu e-mail (ou @handle) e senha.');
      return;
    }
    setLoading(true);
    try {
      await login(emailOrHandle.trim(), password);
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Não foi possível entrar. Verifique seus dados ou o servidor.';
      Alert.alert('Erro ao entrar', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = async (type: 'maria' | 'joao' | 'lider' | 'admin' | 'raquel' | 'pastor_memorial') => {
    setLoading(true);
    try {
      await loginDemo(type);
    } catch (err: any) {
      Alert.alert('Servidor Indisponível', 'Certifique-se de que o backend está rodando.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveApiUrl = async () => {
    await setApiBaseUrl(customIp.trim());
    setConfigModalVisible(false);
    Alert.alert('Sucesso', `Endereço da API atualizado para:\n${customIp.trim()}`);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Cabeçalho Limpo */}
        <View style={styles.header}>
          <Text style={styles.crossIcon}>✝️</Text>
          <Text style={styles.title}>Devocional da Igreja</Text>
          <Text style={styles.subtitle}>
            Acesse seu espaço de fé, reflexão na Palavra e comunhão cristã.
          </Text>
        </View>

        {/* Card de Login Limpo */}
        <View style={styles.formCard}>
          <Text style={styles.inputLabel}>SEU E-MAIL OU @HANDLE</Text>
          <TextInput
            value={emailOrHandle}
            onChangeText={setEmailOrHandle}
            placeholder="exemplo@igreja.com ou @usuario"
            autoCapitalize="none"
            style={styles.input}
          />

          <View style={styles.passwordRow}>
            <Text style={styles.inputLabel}>SUA SENHA</Text>
            <TouchableOpacity onPress={() => setForgotModalVisible(true)}>
              <Text style={styles.forgotLink}>Esqueci minha senha</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            style={styles.input}
          />

          <AccessibleButton
            title="Entrar no Aplicativo"
            onPress={handleLogin}
            loading={loading}
            style={styles.loginBtn}
          />

          {/* Atalho para Alternar Contas Salvas no Aparelho */}
          {savedAccounts.length > 0 ? (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setAccountSwitcherVisible(true)}
              style={styles.switchAccountsBar}
            >
              <Text style={styles.switchAccountsIcon}>👥</Text>
              <Text style={styles.switchAccountsText}>
                Alternar conta familiar salva ({savedAccounts.length})
              </Text>
            </TouchableOpacity>
          ) : null}

          {/* Links de Cadastro */}
          <TouchableOpacity
            onPress={() => navigation.navigate('Register')}
            style={styles.registerLink}
          >
            <Text style={styles.registerLinkText}>
              Ainda não tem conta? <Text style={styles.boldText}>Cadastre-se com bônus de 100 pts</Text>
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setChurchModalVisible(true)}
            style={styles.pastorLink}
          >
            <Text style={styles.pastorLinkText}>
              ⛪ É Pastor ou Líder? <Text style={styles.boldText}>Cadastre sua Igreja aqui</Text>
            </Text>
          </TouchableOpacity>
        </View>

        {/* Demonstração Rápida e Discreta (Homologação) */}
        <View style={styles.demoSection}>
          <Text style={styles.demoTitle}>Acesso rápido para demonstração:</Text>
          <View style={styles.demoRow}>
            <TouchableOpacity onPress={() => handleDemo('maria')} style={styles.demoChip}>
              <Text style={styles.demoChipText}>👵 Dona Maria</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDemo('joao')} style={styles.demoChip}>
              <Text style={styles.demoChipText}>🧑 João Pedro</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDemo('lider')} style={styles.demoChip}>
              <Text style={styles.demoChipText}>🛡️ Líder Marcos</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.demoRow, { marginTop: 6 }]}>
            <TouchableOpacity onPress={() => handleDemo('admin')} style={styles.demoChip}>
              <Text style={styles.demoChipText}>⛪ Pastor Davi</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDemo('raquel')} style={styles.demoChip}>
              <Text style={styles.demoChipText}>👩 Raquel (Memorial)</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Configuração de Servidor */}
        <TouchableOpacity
          onPress={() => setConfigModalVisible(true)}
          style={styles.serverConfigLink}
        >
          <Text style={styles.serverConfigText}>⚙️ Servidor: {api.defaults.baseURL}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modais Integrados */}
      <ForgotPasswordModal
        visible={forgotModalVisible}
        onClose={() => setForgotModalVisible(false)}
      />

      <ChurchRegisterModal
        visible={churchModalVisible}
        onClose={() => setChurchModalVisible(false)}
      />

      <AccountSwitcherModal
        visible={accountSwitcherVisible}
        onClose={() => setAccountSwitcherVisible(false)}
      />

      {/* Modal de Configuração de IP/Host */}
      <Modal visible={configModalVisible} animationType="fade" transparent>
        <View style={styles.configModalOverlay}>
          <View style={styles.configModalCard}>
            <Text style={styles.configModalTitle}>Configuração da API</Text>
            <Text style={styles.configModalDesc}>
              Informe o endereço do backend para testar no seu celular físico.
            </Text>
            <TextInput
              value={customIp}
              onChangeText={setCustomIp}
              placeholder="http://192.168.1.50:3000"
              autoCapitalize="none"
              style={styles.input}
            />
            <AccessibleButton
              title="Salvar Endereço"
              onPress={handleSaveApiUrl}
              style={{ marginTop: 12 }}
            />
            <TouchableOpacity
              onPress={() => setConfigModalVisible(false)}
              style={{ marginTop: 10, alignItems: 'center' }}
            >
              <Text style={{ color: Colors.textSecondary }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    alignItems: 'center',
    paddingBottom: Spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginVertical: Spacing.lg,
    paddingHorizontal: Spacing.sm,
  },
  crossIcon: {
    fontSize: 48,
    marginBottom: Spacing.xs,
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
    marginTop: 6,
    lineHeight: 22,
    maxWidth: 320,
  },
  formCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: Spacing.lg,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  inputLabel: {
    fontSize: Typography.labelSmall,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 6,
    marginTop: 10,
    letterSpacing: 0.5,
  },
  passwordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  forgotLink: {
    fontSize: Typography.caption,
    color: Colors.primary,
    fontWeight: '600',
  },
  input: {
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: Typography.bodyMedium,
    color: Colors.textPrimary,
  },
  loginBtn: {
    marginTop: 20,
    marginBottom: 10,
  },
  switchAccountsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceSecondary,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  switchAccountsIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  switchAccountsText: {
    fontSize: Typography.bodySmall,
    fontWeight: '700',
    color: Colors.primary,
  },
  registerLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  registerLinkText: {
    fontSize: Typography.bodySmall,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  pastorLink: {
    alignItems: 'center',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 8,
    paddingTop: 10,
  },
  pastorLinkText: {
    fontSize: Typography.caption,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  boldText: {
    fontWeight: '800',
    color: Colors.primary,
  },
  demoSection: {
    width: '100%',
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.xs,
  },
  demoTitle: {
    fontSize: Typography.caption,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 8,
    textAlign: 'center',
  },
  demoRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  demoChip: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  demoChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  serverConfigLink: {
    marginTop: Spacing.lg,
    padding: Spacing.sm,
  },
  serverConfigText: {
    fontSize: Typography.caption,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  configModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  configModalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: Spacing.lg,
    width: '100%',
    maxWidth: 380,
  },
  configModalTitle: {
    fontSize: Typography.titleMedium,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  configModalDesc: {
    fontSize: Typography.bodySmall,
    color: Colors.textSecondary,
    marginVertical: 8,
  },
});
