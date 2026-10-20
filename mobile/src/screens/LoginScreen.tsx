import { Ionicons } from '@expo/vector-icons';
import { useEffect,useState } from 'react';
import { KeyboardAvoidingView,Modal,Platform,ScrollView,StyleSheet,Text,TextInput,TouchableOpacity,View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AccessibleButton } from '../components/AccessibleButton';
import { AccountSwitcherModal } from '../components/AccountSwitcherModal';
import { ChurchRegisterModal } from '../components/ChurchRegisterModal';
import { ForgotPasswordModal } from '../components/ForgotPasswordModal';
import { useAuth } from '../context/AuthContext';
import { api,setApiBaseUrl } from '../services/api';
import { Colors } from '../theme/colors';
export function LoginScreen({ navigation }: { navigation: any }) {
  const { login, savedAccounts } = useAuth();
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false), [church, setChurch] = useState(false), [accounts, setAccounts] = useState(false), [config, setConfig] = useState(false), [showPassword, setShowPassword] = useState(false);
  const [server, setServer] = useState(api.defaults.baseURL || ''), [demo, setDemo] = useState(false);
  useEffect(() => { api.get('/api/health').then(r => setDemo(Boolean(r.data.demo_mode))).catch(() => {}); }, []);
  async function enter(identifier = email, secret = password) {
    if (busy) return;
    if (!identifier.trim() || !secret) { setError('Preencha seu e-mail e sua senha para continuar.'); return; }
    setError(''); setBusy(true);
    try { await login(identifier.trim(), secret); }
    catch (e: any) { setError(e.response?.data?.error || 'Não foi possível conectar. Confira o servidor e tente novamente.'); }
    finally { setBusy(false); }
  }
  async function saveServer() {
    setBusy(true); setError('');
    try { await setApiBaseUrl(server.trim()); const r = await api.get('/api/health'); setDemo(Boolean(r.data.demo_mode)); setConfig(false); }
    catch (e: any) { setError(e.message?.startsWith('Informe') ? e.message : 'O servidor não respondeu. Confira o endereço e sua conexão.'); }
    finally { setBusy(false); }
  }
  return <SafeAreaView style={s.safe}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.container}>
    <View style={s.brand}><View style={s.mark}><Ionicons name="leaf-outline" size={28} color="#fff" /></View><Text style={s.brandText}>comunhão</Text></View>
    <Text style={s.eyebrow}>FÉ QUE SE VIVE, JUNTOS.</Text><Text style={s.title}>Um novo dia.{'\n'}Um encontro com a Palavra.</Text><Text style={s.subtitle}>Seu espaço de leitura, reflexão e vida em comunidade.</Text>
    <View style={s.form}><Text style={s.formTitle}>Que bom ter você aqui.</Text><Text style={s.label}>E-mail ou nome de usuário</Text><TextInput style={s.input} value={email} onChangeText={setEmail} placeholder="seuemail@igreja.com" placeholderTextColor={Colors.textMuted} autoCapitalize="none" autoCorrect={false} autoComplete="username" accessibilityLabel="E-mail ou nome de usuário" returnKeyType="next" />
    <View style={s.labelRow}><Text style={s.label}>Senha</Text><TouchableOpacity onPress={() => setForgot(true)} style={s.linkButton}><Text style={s.link}>Esqueceu a senha?</Text></TouchableOpacity></View><View style={s.password}><TextInput style={[s.input, { flex: 1, borderWidth: 0, marginBottom: 0 }]} value={password} onChangeText={setPassword} placeholder="Sua senha" placeholderTextColor={Colors.textMuted} secureTextEntry={!showPassword} autoComplete="current-password" accessibilityLabel="Senha" onSubmitEditing={() => void enter()} returnKeyType="go" /><TouchableOpacity onPress={() => setShowPassword(!showPassword)} accessibilityLabel={showPassword ? 'Ocultar senha' : 'Mostrar senha'} accessibilityRole="button" style={s.eye}><Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={21} color={Colors.textSecondary} /></TouchableOpacity></View>
    {error && !config ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}<AccessibleButton title="Entrar na minha comunidade" loading={busy} onPress={() => void enter()} style={{ marginTop: 12 }} />
    <TouchableOpacity onPress={() => navigation.navigate('Register')} style={s.register}><Text style={s.registerText}>Primeira vez por aqui? <Text style={s.link}>Criar minha conta</Text></Text></TouchableOpacity>
    {savedAccounts.length ? <AccessibleButton title="Alternar conta salva" variant="outline" onPress={() => setAccounts(true)} /> : null}
    </View>
    <TouchableOpacity onPress={() => setChurch(true)} style={s.churchLink}><Ionicons name="business-outline" size={19} color={Colors.primary} /><Text style={s.link}>Levar o Comunhão para minha igreja</Text></TouchableOpacity>
    {demo ? <View style={s.demo}><Text style={s.demoLabel}>ACESSO RÁPIDO DO ADMINISTRADOR</Text><View style={s.demoRow}>{[['Administrador de demonstração', 'admin@igreja.com', '123456']].map(([label, value, pwd]) => <TouchableOpacity disabled={busy} key={value} onPress={() => void enter(value, pwd)} style={s.demoChip}><Text style={s.link}>{label}</Text></TouchableOpacity>)}</View></View> : null}
    <TouchableOpacity onPress={() => { setError(''); setConfig(true); }} style={s.serverLink}><Ionicons name="settings-outline" color={Colors.textSecondary} size={15} /><Text style={s.serverText}>Configurar conexão com o servidor</Text></TouchableOpacity>
    <ForgotPasswordModal visible={forgot} onClose={() => setForgot(false)} /><ChurchRegisterModal visible={church} onClose={() => setChurch(false)} /><AccountSwitcherModal visible={accounts} onClose={() => setAccounts(false)} />
    <Modal visible={config} transparent animationType="fade" onRequestClose={() => setConfig(false)}><View style={s.overlay}><View style={s.modal}><Text style={s.formTitle}>Conectar à sua igreja</Text><Text style={s.subtitle}>Informe o endereço da API fornecido pelo administrador.</Text><TextInput style={s.input} value={server} onChangeText={setServer} autoCapitalize="none" autoCorrect={false} placeholder="http://192.168.1.15:3000" accessibilityLabel="Endereço do servidor" />{error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}<AccessibleButton title="Verificar e salvar conexão" loading={busy} onPress={() => void saveServer()} /><AccessibleButton title="Voltar" variant="secondary" onPress={() => setConfig(false)} /></View></View></Modal>
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:Colors.background},container:{width:'100%',maxWidth:520,alignSelf:'center',padding:26,paddingTop:40,paddingBottom:28},brand:{flexDirection:'row',gap:12,alignItems:'center',justifyContent:'center'},mark:{backgroundColor:Colors.primary,width:48,height:48,borderRadius:15,alignItems:'center',justifyContent:'center'},brandText:{fontSize:32,fontWeight:'700',letterSpacing:-1.5,color:Colors.primaryDark},eyebrow:{fontSize:9,letterSpacing:2,color:Colors.textSecondary,textAlign:'center',marginTop:14},title:{fontSize:29,lineHeight:39,letterSpacing:-1,fontWeight:'600',textAlign:'center',color:Colors.textPrimary,marginTop:34},subtitle:{fontSize:14,lineHeight:23,textAlign:'center',color:Colors.textSecondary,marginVertical:14},form:{backgroundColor:'#fff',padding:23,borderWidth:1,borderColor:Colors.border,borderRadius:21,marginTop:16},formTitle:{fontSize:20,fontWeight:'700',letterSpacing:-.5,color:Colors.textPrimary,marginBottom:24},label:{fontSize:12,fontWeight:'600',color:Colors.textPrimary,marginBottom:9},input:{minHeight:56,borderWidth:1,borderColor:Colors.borderStrong,borderRadius:11,paddingHorizontal:14,fontSize:16,color:Colors.textPrimary,backgroundColor:'#fff',marginBottom:16},labelRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},password:{flexDirection:'row',borderWidth:1,borderColor:Colors.borderStrong,borderRadius:11,alignItems:'center',marginBottom:8},eye:{width:50,minHeight:56,alignItems:'center',justifyContent:'center'},linkButton:{minHeight:48,justifyContent:'center'},link:{color:Colors.primary,fontSize:12,fontWeight:'700'},register:{minHeight:56,alignItems:'center',justifyContent:'center',marginTop:12},registerText:{fontSize:12,color:Colors.textSecondary,textAlign:'center',lineHeight:22},churchLink:{flexDirection:'row',gap:9,minHeight:56,alignItems:'center',justifyContent:'center',marginTop:20},demo:{marginTop:18,borderTopWidth:1,borderTopColor:Colors.border,paddingTop:20},demoLabel:{fontSize:8,letterSpacing:1.4,color:Colors.textSecondary,textAlign:'center'},demoRow:{flexDirection:'row',justifyContent:'center',gap:10,marginTop:14},demoChip:{minHeight:48,paddingHorizontal:22,justifyContent:'center',backgroundColor:'#eaf1e2',borderRadius:10},serverLink:{flexDirection:'row',gap:7,minHeight:56,alignItems:'center',justifyContent:'center',marginTop:16},serverText:{fontSize:11,color:Colors.textSecondary},error:{paddingVertical:12,fontSize:14,color:Colors.danger,lineHeight:22},overlay:{flex:1,backgroundColor:'#193a2c88',padding:24,alignItems:'center',justifyContent:'center'},modal:{backgroundColor:'#fff',borderRadius:20,padding:25,width:'100%',maxWidth:430}});
