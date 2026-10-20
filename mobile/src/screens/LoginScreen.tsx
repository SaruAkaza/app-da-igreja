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

export const LoginScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { login, loginDemo } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Modal para configurar IP do Backend (útil para Expo Go no celular físico)
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [customIp, setCustomIp] = useState(api.defaults.baseURL || 'http://localhost:3000');

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Atenção', 'Por favor, informe seu e-mail e senha.');
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Não foi possível entrar. Verifique seus dados ou o servidor.';
      Alert.alert('Erro ao entrar', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = async (type: 'maria' | 'joao' | 'lider' | 'admin') => {
    setLoading(true);
    try {
      await loginDemo(type);
    } catch (err: any) {
      Alert.alert('Servidor Indisponível', 'Certifique-se de que o backend está rodando (npm run dev na pasta backend).');
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
        {/* Topo / Logo da Igreja */}
        <View style={styles.header}>
          <Text style={styles.crossIcon}>✝️</Text>
          <Text style={styles.title}>Devocional da Igreja</Text>
          <Text style={styles.subtitle}>
            Pratique a leitura diária, envie a foto do seu caderno e celebre a comunhão.
          </Text>
        </View>

        {/* Formulário de Acesso Acessível */}
        <View style={styles.formCard}>
          <Text style={styles.inputLabel}>SEU E-MAIL</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="exemplo@igreja.com"
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
          />

          <Text style={styles.inputLabel}>SUA SENHA</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="••••••"
            secureTextEntry
            style={styles.input}
          />

          <AccessibleButton
            title="Entrar no Aplicativo"
            onPress={handleLogin}
            loading={loading}
            style={styles.loginBtn}
          />

          <TouchableOpacity
            onPress={() => navigation.navigate('Register')}
            style={styles.registerLink}
          >
            <Text style={styles.registerLinkText}>
              Ainda não tem conta? <Text style={styles.boldText}>Cadastre-se aqui</Text>
            </Text>
          </TouchableOpacity>
        </View>

        {/* Acesso Rápido de Demonstração (1 toque) */}
        <View style={styles.demoSection}>
          <Text style={styles.demoTitle}>Ou experimente em 1 toque:</Text>

          <AccessibleButton
            title="👵 Dona Maria (Idosa - Sequência 30d 🔥)"
            subtitle="Membro exemplar, nível Ouro alcançado"
            variant="secondary"
            onPress={() => handleDemo('maria')}
            style={styles.demoBtn}
          />

          <AccessibleButton
            title="🧑 João Pedro (Jovens - Nível Bronze)"
            subtitle="Devocional em Tiago, sequência ativa"
            variant="secondary"
            onPress={() => handleDemo('joao')}
            style={styles.demoBtn}
          />

          <AccessibleButton
            title="🛡️ Líder Marcos (Validador de QR Code)"
            subtitle="Acesso à leitura e baixa de cupons nos cultos"
            variant="secondary"
            onPress={() => handleDemo('lider')}
            style={styles.demoBtn}
          />

          <AccessibleButton
            title="👑 Pastor Davi (Administrador)"
            subtitle="Visão geral, bônus e moderação"
            variant="secondary"
            onPress={() => handleDemo('admin')}
            style={styles.demoBtn}
          />
        </View>

        {/* Botão de Configuração de IP */}
        <TouchableOpacity
          onPress={() => setConfigModalVisible(true)}
          style={styles.configBtn}
        >
          <Text style={styles.configBtnText}>
            ⚙️ Configurar Servidor ({api.defaults.baseURL})
          </Text>
        </TouchableOpacity>

        {/* Modal de Configuração de Servidor */}
        <Modal visible={configModalVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Conexão com o Servidor</Text>
              <Text style={styles.modalSubtitle}>
                Se estiver testando no celular físico via Expo Go, informe o IP do seu computador na rede Wi-Fi (ex: http://192.168.1.50:3000):
              </Text>
              <TextInput
                value={customIp}
                onChangeText={setCustomIp}
                style={styles.input}
                placeholder="http://192.168.1.10:3000"
                autoCapitalize="none"
              />
              <View style={styles.modalActions}>
                <AccessibleButton
                  title="Salvar Endereço"
                  onPress={handleSaveApiUrl}
                  style={{ flex: 1, marginRight: 8 }}
                />
                <AccessibleButton
                  title="Cancelar"
                  variant="secondary"
                  onPress={() => setConfigModalVisible(false)}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
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
  },
  header: {
    alignItems: 'center',
    marginVertical: Spacing.lg,
    paddingHorizontal: Spacing.sm,
  },
  crossIcon: {
    fontSize: 48,
    marginBottom: 8,
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
  },
  formCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: Spacing.lg,
    width: '100%',
    borderWidth: 1.5,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    fontSize: Typography.bodyLarge,
    color: Colors.textPrimary,
    minHeight: 54,
  },
  loginBtn: {
    marginTop: Spacing.md,
    minHeight: 56,
  },
  registerLink: {
    marginTop: Spacing.md,
    alignItems: 'center',
    paddingVertical: 8,
  },
  registerLinkText: {
    fontSize: Typography.bodyMedium,
    color: Colors.textSecondary,
  },
  boldText: {
    fontWeight: '800',
    color: Colors.primary,
  },
  demoSection: {
    width: '100%',
    marginTop: Spacing.lg,
  },
  demoTitle: {
    fontSize: Typography.bodyMedium,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  demoBtn: {
    marginBottom: Spacing.xs,
    minHeight: 58,
  },
  configBtn: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
    padding: Spacing.sm,
  },
  configBtnText: {
    fontSize: Typography.bodySmall,
    color: Colors.textMuted,
    textDecorationLine: 'underline',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: Spacing.lg,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: Typography.titleMedium,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: Typography.bodySmall,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    lineHeight: 18,
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: Spacing.md,
  },
});
