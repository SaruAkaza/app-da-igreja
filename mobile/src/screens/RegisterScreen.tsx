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
} from 'react-native';
import { Colors, Spacing, Typography } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { AccessibleButton } from '../components/AccessibleButton';

export const RegisterScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name || !email || !password) {
      Alert.alert('Campos Obrigatórios', 'Por favor, preencha nome, e-mail e senha.');
      return;
    }
    setLoading(true);
    try {
      await register(name, email, password);
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Erro ao realizar cadastro.';
      Alert.alert('Erro', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Criar Minha Conta</Text>
          <Text style={styles.subtitle}>
            Junte-se à nossa comunidade para cultivar o hábito diário de estar com Deus.
          </Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.inputLabel}>SEU NOME COMPLETO</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Ex: Maria de Lourdes"
            style={styles.input}
          />

          <Text style={styles.inputLabel}>SEU E-MAIL</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="maria@igreja.com"
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
          />

          <Text style={styles.inputLabel}>ESCOLHA UMA SENHA</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Mínimo de 6 caracteres"
            secureTextEntry
            style={styles.input}
          />

          <AccessibleButton
            title="Concluir Cadastro"
            onPress={handleRegister}
            loading={loading}
            style={styles.registerBtn}
          />

          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backLink}
          >
            <Text style={styles.backLinkText}>
              Já tem conta? <Text style={styles.boldText}>Fazer Login</Text>
            </Text>
          </TouchableOpacity>
        </View>
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
  registerBtn: {
    marginTop: Spacing.md,
    minHeight: 56,
  },
  backLink: {
    marginTop: Spacing.md,
    alignItems: 'center',
    paddingVertical: 8,
  },
  backLinkText: {
    fontSize: Typography.bodyMedium,
    color: Colors.textSecondary,
  },
  boldText: {
    fontWeight: '800',
    color: Colors.primary,
  },
});
