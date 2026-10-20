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
  Image,
} from 'react-native';
import { Colors, Spacing, Typography } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { AccessibleButton } from '../components/AccessibleButton';
import { api } from '../services/api';
import { ScreenHeader } from '../components/ScreenHeader';

type Step = 1 | 2 | 3 | 4 | 5;

export const RegisterScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { register } = useAuth();
  const [currentStep, setCurrentStep] = useState<Step>(1);

  // Etapa 1: Dados Pessoais & Endereço
  const [name, setName] = useState('');
  const [lastName, setLastName] = useState('');
  const [age, setAge] = useState('');
  const [email, setEmail] = useState('');
  const [addressStreet, setAddressStreet] = useState('');
  const [addressNeighborhood, setAddressNeighborhood] = useState('');
  const [addressCity, setAddressCity] = useState('São Paulo');
  const [addressState, setAddressState] = useState('SP');
  const [addressZipcode, setAddressZipcode] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200');

  // Menor de idade (< 18 anos)
  const [parentPhone, setParentPhone] = useState('');
  const [parentConsentCode, setParentConsentCode] = useState('');
  const [parentConsentVerified, setParentConsentVerified] = useState(false);
  const [lgpdAccepted, setLgpdAccepted] = useState(false);

  // Etapa 2: Código 2FA de 6 dígitos
  const [emailVerificationCode, setEmailVerificationCode] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);

  // Etapa 4: Handle & Senha Forte
  const [usernameHandle, setUsernameHandle] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [churchCode, setChurchCode] = useState('');

  // Status
  const [loading, setLoading] = useState(false);
  const [registrationResult, setRegistrationResult] = useState<any>(null);

  const isMinor = age ? Number(age) < 18 : false;

  // 1. Avançar da Etapa 1 para o 2FA
  const handleProceedTo2FA = async () => {
    if (!name.trim() || !lastName.trim() || !email.trim() || !age) {
      Alert.alert('Campos Obrigatórios', 'Por favor, preencha nome, sobrenome, idade e seu e-mail pessoal.');
      return;
    }

    if (isMinor && !parentPhone.trim()) {
      Alert.alert('Atenção', 'Para membros menores de 18 anos, o telefone do pai/responsável é obrigatório.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/api/auth/request-code', { email: email.trim() });
      Alert.alert(
        'Código 2FA Enviado',
        res.data.dev_code
          ? `Código de 6 dígitos gerado: ${res.data.dev_code}\n(No ambiente de produção, este código chega ao seu e-mail).`
          : `Enviamos um código de 6 dígitos para ${email.trim()}.`
      );
      if (res.data.dev_code) {
        setEmailVerificationCode(res.data.dev_code);
      }
      setCurrentStep(2);
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Erro ao enviar código de verificação.';
      Alert.alert('Erro', msg);
    } finally {
      setLoading(false);
    }
  };

  // 2. Validar Código 2FA
  const handleVerify2FACode = async () => {
    if (!emailVerificationCode.trim()) {
      Alert.alert('Atenção', 'Digite o código de 6 dígitos recebido.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/auth/verify-code', {
        email: email.trim(),
        code: emailVerificationCode.trim(),
      });
      setEmailVerified(true);

      // Se for menor de 18 anos, vai para a Etapa 3 (Consentimento Parental WhatsApp)
      // Se for maior, pula direto para a Etapa 4 (Handle e Senha)
      if (isMinor) {
        // Disparar código parental
        await handleSendParentalConsent();
        setCurrentStep(3);
      } else {
        // Pré-sugerir handle
        if (!usernameHandle) {
          setUsernameHandle(`@${name.trim().toLowerCase()}.${lastName.trim().toLowerCase()}`);
        }
        setCurrentStep(4);
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Código inválido ou expirado.';
      Alert.alert('Erro no 2FA', msg);
    } finally {
      setLoading(false);
    }
  };

  // 3. Disparar consentimento para o responsável via WhatsApp
  const handleSendParentalConsent = async () => {
    try {
      const res = await api.post('/api/auth/parental-consent/send', {
        childName: `${name.trim()} ${lastName.trim()}`,
        parentPhone: parentPhone.trim(),
        churchName: churchCode ? `Código ${churchCode}` : 'Igreja',
      });
      if (res.data.dev_code) {
        setParentConsentCode(res.data.dev_code);
      }
    } catch (e) {
      console.warn('Aviso ao gerar consentimento:', e);
    }
  };

  const openParentWhatsApp = () => {
    const cleanPhone = parentPhone.replace(/\D/g, '');
    const msg = `Paz do Senhor! Seu filho(a) ${name} solicitou cadastro no App Devocional da Igreja. Seu código de autorização é: [ ${parentConsentCode || '1234'} ]. Ao repassar este código ao menor, você autoriza sua participação nas atividades devocionais de acordo com nossos Termos de Uso e LGPD.`;
    const url = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(msg)}`;
    if (typeof window !== 'undefined' && window.open) {
      window.open(url, '_blank');
    } else {
      Alert.alert('Mensagem WhatsApp', msg);
    }
  };

  const handleVerifyParentalConsent = async () => {
    if (!parentConsentCode.trim()) {
      Alert.alert('Atenção', 'Digite o código de 4 dígitos informado pelo seu responsável.');
      return;
    }
    if (!lgpdAccepted) {
      Alert.alert('Termos Obrigatórios', 'É necessário aceitar os Termos de Uso e Salvaguarda de Menores (LGPD).');
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/auth/parental-consent/verify', {
        parentPhone: parentPhone.trim(),
        code: parentConsentCode.trim(),
      });
      setParentConsentVerified(true);
      if (!usernameHandle) {
        setUsernameHandle(`@${name.trim().toLowerCase()}.${lastName.trim().toLowerCase()}`);
      }
      setCurrentStep(4);
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Código parental de 4 dígitos incorreto.';
      Alert.alert('Erro', msg);
    } finally {
      setLoading(false);
    }
  };

  // 4. Concluir Registro Final
  const handleCompleteRegistration = async () => {
    if (!usernameHandle.trim() || !password) {
      Alert.alert('Campos Obrigatórios', 'Escolha seu @handle e uma senha forte.');
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
      const result = await register({
        name: name.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        password,
        confirmPassword,
        usernameHandle: usernameHandle.trim(),
        age: Number(age) || 0,
        parentPhone: parentPhone.trim() || undefined,
        parentConsentCode: parentConsentCode.trim() || undefined,
        avatarUrl,
        addressStreet: addressStreet.trim() || undefined,
        addressNeighborhood: addressNeighborhood.trim() || undefined,
        addressCity: addressCity.trim() || undefined,
        addressState: addressState.trim().toUpperCase() || undefined,
        addressZipcode: addressZipcode.trim() || undefined,
        churchCode: churchCode.trim() || undefined,
      });

      setRegistrationResult(result);
      setCurrentStep(5);
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Erro ao concluir cadastro. Verifique os dados.';
      Alert.alert('Erro no Cadastro', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title="Cadastro com Bônus 100%"
        subtitle={`Etapa ${currentStep} de 4`}
        navigation={navigation}
        showHomeButton={false}
      />

      <ScrollView contentContainerStyle={styles.container}>
        {/* Barra de Progresso das Etapas */}
        <View style={styles.stepProgressBar}>
          <View style={[styles.stepDot, currentStep >= 1 && styles.stepDotActive]}>
            <Text style={styles.stepDotText}>1</Text>
          </View>
          <View style={[styles.stepLine, currentStep >= 2 && styles.stepLineActive]} />
          <View style={[styles.stepDot, currentStep >= 2 && styles.stepDotActive]}>
            <Text style={styles.stepDotText}>2</Text>
          </View>
          <View style={[styles.stepLine, currentStep >= 3 && styles.stepLineActive]} />
          <View style={[styles.stepDot, currentStep >= 3 && styles.stepDotActive]}>
            <Text style={styles.stepDotText}>3</Text>
          </View>
          <View style={[styles.stepLine, currentStep >= 4 && styles.stepLineActive]} />
          <View style={[styles.stepDot, currentStep >= 4 && styles.stepDotActive]}>
            <Text style={styles.stepDotText}>4</Text>
          </View>
        </View>

        {/* ETAPA 1: Dados Pessoais & Endereço */}
        {currentStep === 1 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>👤 1. Seus Dados Pessoais</Text>
            <Text style={styles.cardSubtitle}>
              Preencha seu cadastro completo para garantir seus primeiros <Text style={{ fontWeight: '800', color: Colors.primary }}>+100 pontos de bônus</Text>!
            </Text>

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.label}>PRIMEIRO NOME *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Matheus"
                  value={name}
                  onChangeText={setName}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>SOBRENOME *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Izalas"
                  value={lastName}
                  onChangeText={setLastName}
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.label}>IDADE *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: 24"
                  keyboardType="numeric"
                  value={age}
                  onChangeText={setAge}
                />
              </View>
              <View style={{ flex: 2 }}>
                <Text style={styles.label}>SEU E-MAIL PESSOAL *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="seuemail@exemplo.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
            </View>

            {/* Alerta de Menor de Idade */}
            {isMinor && (
              <View style={styles.minorNoticeBox}>
                <Text style={styles.minorNoticeTitle}>🛡️ Regra de Proteção ao Menor (LGPD):</Text>
                <Text style={styles.minorNoticeSub}>
                  Como você tem menos de 18 anos, precisamos do telefone de um dos seus pais ou responsável legal para enviar autorização via WhatsApp.
                </Text>

                <Text style={[styles.label, { color: Colors.primaryDark }]}>
                  TELEFONE DO PAI / MÃE / RESPONSÁVEL *
                </Text>
                <TextInput
                  style={[styles.input, { borderColor: Colors.primary }]}
                  placeholder="(11) 98888-7777"
                  keyboardType="phone-pad"
                  value={parentPhone}
                  onChangeText={setParentPhone}
                />
              </View>
            )}

            {/* Endereço Residencial para 100% de Perfil */}
            <Text style={[styles.sectionDivider, { marginTop: 14 }]}>📍 Endereço Residencial (Para 100% do Perfil):</Text>

            <Text style={styles.label}>RUA E NÚMERO</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Rua das Oliveiras, 150"
              value={addressStreet}
              onChangeText={setAddressStreet}
            />

            <View style={styles.row}>
              <View style={{ flex: 2, marginRight: 8 }}>
                <Text style={styles.label}>BAIRRO</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Jardim da Fé"
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
              title="Avançar para Confirmação 2FA ›"
              subtitle="Receber código de 6 dígitos no e-mail"
              variant="primary"
              onPress={handleProceedTo2FA}
              loading={loading}
              style={{ marginTop: 18 }}
            />
          </View>
        )}

        {/* ETAPA 2: Validação de 2 Fatores (2FA) */}
        {currentStep === 2 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🔐 2. Confirmação em Duas Etapas (2FA)</Text>
            <Text style={styles.cardSubtitle}>
              Enviamos um código de segurança de 6 dígitos para o e-mail:
              {'\n'}<Text style={{ fontWeight: '800', color: Colors.textPrimary }}>{email}</Text>
            </Text>

            <View style={styles.codeBox}>
              <Text style={styles.label}>DIGITE O CÓDIGO DE 6 DÍGITOS:</Text>
              <TextInput
                style={styles.largeCodeInput}
                placeholder="000000"
                keyboardType="numeric"
                maxLength={6}
                value={emailVerificationCode}
                onChangeText={setEmailVerificationCode}
              />
            </View>

            <AccessibleButton
              title="Confirmar Código 2FA ›"
              variant="success"
              onPress={handleVerify2FACode}
              loading={loading}
              style={{ marginTop: 16 }}
            />

            <TouchableOpacity onPress={() => setCurrentStep(1)} style={styles.backStepBtn}>
              <Text style={styles.backStepText}>← Alterar e-mail ou dados</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ETAPA 3: Consentimento Parental WhatsApp (Apenas Menores) */}
        {currentStep === 3 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>👨‍👩‍👧 3. Autorização dos Pais via WhatsApp</Text>
            <Text style={styles.cardSubtitle}>
              Geramos uma mensagem de autorização para o telefone do seu responsável ({parentPhone}).
            </Text>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={openParentWhatsApp}
              style={styles.whatsappActionBtn}
            >
              <Text style={styles.whatsappActionEmoji}>📲</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.whatsappActionTitle}>Abrir WhatsApp do Responsável</Text>
                <Text style={styles.whatsappActionSub}>Enviar mensagem com código de 4 dígitos para os pais.</Text>
              </View>
            </TouchableOpacity>

            <Text style={styles.label}>DIGITE O CÓDIGO DE 4 DÍGITOS DOS SEUS PAIS:</Text>
            <TextInput
              style={[styles.largeCodeInput, { letterSpacing: 10 }]}
              placeholder="0000"
              keyboardType="numeric"
              maxLength={4}
              value={parentConsentCode}
              onChangeText={setParentConsentCode}
            />

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setLgpdAccepted(!lgpdAccepted)}
              style={styles.checkboxRow}
            >
              <Text style={styles.checkboxBox}>{lgpdAccepted ? '☑️' : '⬜'}</Text>
              <Text style={styles.checkboxLabel}>
                Declaro que meus responsáveis autorizam minha participação nas leituras e gincanas devocionais de acordo com a LGPD e termos do app.
              </Text>
            </TouchableOpacity>

            <AccessibleButton
              title="Confirmar Autorização Parental ›"
              variant="primary"
              onPress={handleVerifyParentalConsent}
              loading={loading}
              style={{ marginTop: 14 }}
            />

            <TouchableOpacity onPress={() => setCurrentStep(2)} style={styles.backStepBtn}>
              <Text style={styles.backStepText}>← Voltar para etapa anterior</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ETAPA 4: Escolha de @handle e Senha Forte */}
        {currentStep === 4 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>✨ 4. Nome de Usuário (@handle) e Senha</Text>
            <Text style={styles.cardSubtitle}>
              Crie sua identidade na comunidade da igreja e defina sua senha segura.
            </Text>

            <Text style={styles.label}>ESCOLHA SEU NOME DE USUÁRIO (@HANDLE) *</Text>
            <TextInput
              style={[styles.input, styles.handleInput]}
              placeholder="@nome.sobrenome"
              autoCapitalize="none"
              value={usernameHandle}
              onChangeText={(t) => setUsernameHandle(t.startsWith('@') ? t : `@${t}`)}
            />
            <Text style={styles.hint}>Outros irmãos verão este nome ao celebrar leituras no Feed.</Text>

            <Text style={styles.label}>CÓDIGO DA SUA IGREJA (OPCIONAL)</Text>
            <TextInput
              style={[styles.input, { textTransform: 'uppercase' }]}
              placeholder="Ex: VIDEIRA26 (pode vincular depois)"
              autoCapitalize="characters"
              value={churchCode}
              onChangeText={(t) => setChurchCode(t.toUpperCase())}
            />
            <Text style={styles.hint}>Se você ainda não recebeu o código, não se preocupe: você pode vincular depois!</Text>

            <Text style={styles.label}>SENHA FORTE *</Text>
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
              title="🎉 Concluir e Resgatar Bônus"
              subtitle="Liberar acesso e computar pontuação"
              variant="success"
              onPress={handleCompleteRegistration}
              loading={loading}
              style={{ marginTop: 18 }}
            />

            <TouchableOpacity
              onPress={() => (isMinor ? setCurrentStep(3) : setCurrentStep(2))}
              style={styles.backStepBtn}
            >
              <Text style={styles.backStepText}>← Voltar</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ETAPA 5: Parabéns e Celebração do Bônus 100% */}
        {currentStep === 5 && (
          <View style={styles.cardSuccess}>
            <Text style={styles.successEmoji}>🌟</Text>
            <Text style={styles.successTitle}>Glória a Deus!</Text>
            <Text style={styles.successSubtitle}>
              Seja muito bem-vindo(a), <Text style={{ fontWeight: '800' }}>{name} {lastName}</Text>!
            </Text>

            <View style={styles.bonusBanner}>
              <Text style={styles.bonusBadge}>🎁 BÔNUS DE CADASTRO 100%</Text>
              <Text style={styles.bonusPointsText}>+100 PONTOS</Text>
              <Text style={styles.bonusDesc}>
                Seu perfil foi 100% preenchido e verificado com segurança. Seus primeiros 100 pontos já foram creditados!
              </Text>
            </View>

            <AccessibleButton
              title="Entrar no Meu Devocional"
              subtitle="Iniciar minha leitura de hoje"
              variant="primary"
              onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}
              style={{ width: '100%', marginTop: 16 }}
            />
          </View>
        )}
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
    paddingBottom: Spacing.xl,
  },
  stepProgressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.md,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotActive: {
    backgroundColor: Colors.primary,
  },
  stepDotText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  stepLine: {
    width: 36,
    height: 3,
    backgroundColor: Colors.border,
    marginHorizontal: 4,
  },
  stepLineActive: {
    backgroundColor: Colors.primary,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  cardTitle: {
    fontSize: Typography.titleLarge,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  cardSubtitle: {
    fontSize: Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: 4,
    marginBottom: 14,
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
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
  handleInput: {
    fontWeight: '800',
    color: Colors.primaryDark,
    fontSize: Typography.bodyLarge,
  },
  hint: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 3,
  },
  sectionDivider: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textPrimary,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 12,
  },
  minorNoticeBox: {
    backgroundColor: '#eff6ff',
    borderWidth: 1.5,
    borderColor: '#93c5fd',
    borderRadius: 16,
    padding: 12,
    marginVertical: 12,
  },
  minorNoticeTitle: {
    fontSize: Typography.bodySmall,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  minorNoticeSub: {
    fontSize: Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  codeBox: {
    alignItems: 'center',
    marginVertical: Spacing.md,
  },
  largeCodeInput: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 8,
    textAlign: 'center',
    color: Colors.primaryDark,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 2,
    borderColor: Colors.primaryLight,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    width: '100%',
    maxWidth: 240,
    marginVertical: 10,
  },
  whatsappActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    borderWidth: 1.5,
    borderColor: '#86efac',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  whatsappActionEmoji: {
    fontSize: 26,
    marginRight: 10,
  },
  whatsappActionTitle: {
    fontSize: Typography.bodyMedium,
    fontWeight: '800',
    color: '#166534',
  },
  whatsappActionSub: {
    fontSize: Typography.caption,
    color: '#15803d',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 12,
  },
  checkboxBox: {
    fontSize: 18,
    marginRight: 8,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: Typography.caption,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  backStepBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  backStepText: {
    color: Colors.textSecondary,
    fontWeight: '600',
    fontSize: Typography.bodySmall,
  },
  cardSuccess: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: Spacing.xl,
    alignItems: 'center',
  },
  successEmoji: {
    fontSize: 60,
  },
  successTitle: {
    fontSize: Typography.titleHero,
    fontWeight: '900',
    color: Colors.textPrimary,
    marginTop: 8,
  },
  successSubtitle: {
    fontSize: Typography.bodyMedium,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  bonusBanner: {
    backgroundColor: '#fef3c7',
    borderWidth: 2,
    borderColor: '#fcd34d',
    borderRadius: 20,
    padding: Spacing.lg,
    alignItems: 'center',
    width: '100%',
    marginVertical: Spacing.lg,
  },
  bonusBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400e',
    letterSpacing: 0.8,
  },
  bonusPointsText: {
    fontSize: 34,
    fontWeight: '900',
    color: '#b45309',
    marginVertical: 4,
  },
  bonusDesc: {
    fontSize: Typography.bodySmall,
    color: '#78350f',
    textAlign: 'center',
    lineHeight: 18,
  },
});
