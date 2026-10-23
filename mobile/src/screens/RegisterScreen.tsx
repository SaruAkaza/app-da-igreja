import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { AccessibleButton } from '../components/AccessibleButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { cleanCep, formatCep, searchCep } from '../services/cep';
import { passwordError } from '../services/password';
export function RegisterScreen({ navigation }: { navigation: any }) {
  const { register } = useAuth();
  const [step, setStep] = useState<'details'|'confirm'>('details');
  const [name,setName]=useState(''),[lastName,setLastName]=useState(''),[email,setEmail]=useState(''),[age,setAge]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[churchCode,setChurchCode]=useState(''),[parentPhone,setParentPhone]=useState('');
  const [addressZipcode, setAddressZipcode] = useState(''), [addressStreet, setAddressStreet] = useState(''), [addressNeighborhood, setAddressNeighborhood] = useState(''), [addressCity, setAddressCity] = useState(''), [addressState, setAddressState] = useState('');
  const [cepSearching, setCepSearching] = useState(false), [cepStatus, setCepStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null), [lastSearchedCep, setLastSearchedCep] = useState('');
  const [emailCode,setEmailCode]=useState(''),[parentCode,setParentCode]=useState(''),[demoCodes,setDemoCodes]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const minor=Number(age)>0&&Number(age)<18;

  const handleZipcodeChange = (text: string) => {
    const formatted = formatCep(text);
    setAddressZipcode(formatted);
    const digits = cleanCep(text);
    if (digits.length === 8 && digits !== lastSearchedCep) {
      void handleSearchCep(digits);
    }
  };

  const handleSearchCep = async (rawToSearch: string) => {
    const digits = cleanCep(rawToSearch);
    if (digits.length !== 8) {
      setCepStatus({ type: 'error', message: 'Digite os 8 dígitos do CEP.' });
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
  async function sendCodes(){
    if(busy)return;
    setError('');
    if(!name.trim()||!email.trim()||!Number.isInteger(Number(age))||Number(age)<1||Number(age)>120){setError('Informe seu nome, e-mail e uma idade válida.');return;}
    const invalidPassword=passwordError(password);if(invalidPassword){setError(invalidPassword);return;}
    if(password!==confirm){setError('As senhas precisam ser iguais.');return;}
    if(minor&&!parentPhone.trim()){setError('Informe o telefone do seu responsável com DDD.');return;}
    setBusy(true);
    try{
      const response=await api.post('/api/auth/request-code',{email:email.trim()});let text=response.data.dev_code?`Demonstração · código do e-mail: ${response.data.dev_code}`:'';
      if(minor){const parent=await api.post('/api/auth/parental-consent/send',{parentPhone,childName:name.trim()});if(parent.data.dev_code)text+=` · código do responsável: ${parent.data.dev_code}`;}
      setDemoCodes(text);setStep('confirm');
    }catch(e:any){setError(e.response?.data?.error||'Não foi possível enviar o código. Tente novamente.');}finally{setBusy(false);}
  }
  async function finish(){
    if(busy)return;setError('');setBusy(true);
    try{
      const verification=await api.post('/api/auth/verify-code',{email:email.trim(),code:emailCode.trim()});
      const consent=minor?await api.post('/api/auth/parental-consent/verify',{parentPhone,code:parentCode.trim()}):null;
      await register({
        name:name.trim(),
        lastName:lastName.trim(),
        email:email.trim(),
        emailVerificationToken:verification.data.verificationToken,
        age:Number(age),
        password,
        confirmPassword:confirm,
        churchCode:churchCode.trim(),
        addressZipcode:addressZipcode.trim(),
        addressStreet:addressStreet.trim(),
        addressNeighborhood:addressNeighborhood.trim(),
        addressCity:addressCity.trim(),
        addressState:addressState.trim().toUpperCase(),
        ...(minor?{parentPhone,parentConsentToken:consent?.data.consentToken}:{})
      });
    }catch(e:any){setError(e.response?.data?.error||'Não conseguimos concluir seu cadastro. Confira os dados e tente novamente.');}finally{setBusy(false);}
  }
  const field=(label:string,value:string,setter:(v:string)=>void,props:React.ComponentProps<typeof TextInput>={})=><View style={s.field}><Text style={s.label}>{label}</Text><TextInput value={value} onChangeText={setter} accessibilityLabel={label} placeholderTextColor={Colors.textMuted} style={s.input} {...props}/></View>;
  return <SafeAreaView style={s.safe}><ScreenHeader navigation={navigation} title="Criar minha conta" subtitle={step==='details'?'Vamos começar sua caminhada.':'Confirme seu e-mail para continuar.'} showHomeButton={false}/><ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled"><View style={s.card}><Text style={s.eyebrow}>ETAPA {step==='details'?'1':'2'} DE 2</Text><Text style={s.title}>{step==='details'?'Um espaço para sua fé.':'Falta só confirmar.'}</Text>{step==='details'?<>
    {field('Nome',name,setName,{autoComplete:'given-name',maxLength:100})}{field('Sobrenome (opcional)',lastName,setLastName,{autoComplete:'family-name',maxLength:100})}{field('Seu e-mail',email,setEmail,{autoCapitalize:'none',keyboardType:'email-address',autoComplete:'email',maxLength:254})}{field('Idade',age,setAge,{keyboardType:'number-pad',maxLength:3})}{minor?field('Telefone do responsável com DDD',parentPhone,setParentPhone,{keyboardType:'phone-pad',maxLength:18}):null}
    {field('Crie uma senha',password,setPassword,{secureTextEntry:true,autoComplete:'new-password',maxLength:128})}<Text style={s.hint}>Pelo menos 8 caracteres, com maiúscula, minúscula, número e símbolo.</Text>{field('Confirme a senha',confirm,setConfirm,{secureTextEntry:true,maxLength:128})}{field('Código da igreja (opcional)',churchCode,setChurchCode,{autoCapitalize:'characters',maxLength:50})}<Text style={s.hint}>Você também pode entrar na sua igreja depois, com um código de convite.</Text>
    
    <View style={s.addressSection}>
      <Text style={s.sectionHeader}>ENDEREÇO RESIDENCIAL (OPCIONAL)</Text>
      <Text style={s.hint}>Preencha o CEP para buscar o endereço via Correios e adiantar seu bônus de 100%.</Text>
      <View style={s.cepRow}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={s.label}>CEP (Correios)</Text>
          <TextInput
            value={addressZipcode}
            onChangeText={handleZipcodeChange}
            placeholder="01001-000"
            placeholderTextColor={Colors.textMuted}
            keyboardType="numeric"
            maxLength={9}
            style={s.input}
          />
        </View>
        <TouchableOpacity
          style={[s.cepBtn, cepSearching && { opacity: 0.6 }]}
          onPress={() => void handleSearchCep(addressZipcode)}
          disabled={cepSearching}
        >
          {cepSearching ? <ActivityIndicator size="small" color="#fff" /> : <><Ionicons name="search-outline" size={16} color="#fff" /><Text style={s.cepBtnText}>Buscar CEP</Text></>}
        </TouchableOpacity>
      </View>
      {cepStatus ? (
        <View style={[s.cepStatus, cepStatus.type === 'success' ? s.cepSuccess : s.cepError]}>
          <Ionicons name={cepStatus.type === 'success' ? 'checkmark-circle-outline' : 'alert-circle-outline'} size={15} color={cepStatus.type === 'success' ? Colors.success : Colors.danger} />
          <Text style={[s.cepStatusText, { color: cepStatus.type === 'success' ? Colors.success : Colors.danger }]}>{cepStatus.message}</Text>
        </View>
      ) : null}
      {field('Rua e número', addressStreet, setAddressStreet, { placeholder: 'Ex: Praça da Sé, 100' })}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>{field('Bairro', addressNeighborhood, setAddressNeighborhood, { placeholder: 'Ex: Sé' })}</View>
        <View style={{ flex: 1 }}>{field('Cidade', addressCity, setAddressCity, { placeholder: 'Ex: São Paulo' })}</View>
        <View style={{ width: 70 }}>{field('UF', addressState, setAddressState, { placeholder: 'SP', maxLength: 2, autoCapitalize: 'characters' })}</View>
      </View>
    </View>
    </>:<><Text style={s.text}>Enviamos um código para {email}. Ele vale por 15 minutos.</Text>{demoCodes?<Text style={s.demo}>{demoCodes}</Text>:null}{field('Código recebido por e-mail',emailCode,setEmailCode,{keyboardType:'number-pad',maxLength:6,autoComplete:'one-time-code'})}{minor?<><Text style={s.text}>Seu responsável recebeu outro código diretamente no telefone informado. Peça que ele confirme a autorização.</Text>{field('Código informado pelo responsável',parentCode,setParentCode,{keyboardType:'number-pad',maxLength:6})}</>:null}</>}
    {error?<Text accessibilityRole="alert" style={s.error}>{error}</Text>:null}<AccessibleButton title={step==='details'?'Receber código de confirmação':'Confirmar e criar minha conta'} loading={busy} onPress={()=>void(step==='details'?sendCodes():finish())}/>{step==='confirm'?<><AccessibleButton title="Reenviar códigos" variant="outline" disabled={busy} onPress={()=>void sendCodes()}/><AccessibleButton title="Corrigir meus dados" variant="secondary" disabled={busy} onPress={()=>{setStep('details');setError('');}}/></>:null}</View><Text style={s.footer}>Sua reflexão pessoal é compartilhada com você e com a liderança responsável pelo grupo. Preencha apenas os dados necessários para começar.</Text></ScrollView></SafeAreaView>;
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:Colors.background},container:{padding:22,width:'100%',maxWidth:600,alignSelf:'center',paddingBottom:40},card:{backgroundColor:'#fff',borderWidth:1,borderColor:Colors.border,borderRadius:20,padding:24},eyebrow:{fontSize:10,letterSpacing:1.5,color:Colors.primary,fontWeight:'700',marginBottom:14},title:{fontSize:25,fontWeight:'600',color:Colors.textPrimary,marginBottom:25,letterSpacing:-.6},field:{marginBottom:18},label:{fontSize:13,fontWeight:'600',color:Colors.textPrimary,marginBottom:8},input:{minHeight:56,borderWidth:1,borderColor:Colors.borderStrong,borderRadius:11,paddingHorizontal:14,color:Colors.textPrimary,fontSize:17},hint:{fontSize:12,lineHeight:20,color:Colors.textSecondary,marginTop:-6,marginBottom:18},text:{fontSize:15,lineHeight:25,color:Colors.textSecondary,marginBottom:22},demo:{backgroundColor:Colors.accentSurface,padding:14,borderRadius:10,fontSize:14,lineHeight:22,color:Colors.warningDark,marginBottom:20},error:{fontSize:14,lineHeight:23,color:Colors.danger,marginBottom:16},footer:{fontSize:12,lineHeight:21,color:Colors.textSecondary,textAlign:'center',padding:20},addressSection:{marginTop:8,marginBottom:18,paddingTop:14,borderTopWidth:1,borderTopColor:Colors.border},sectionHeader:{fontSize:11,fontWeight:'800',color:Colors.primary,letterSpacing:1,marginBottom:4},cepRow:{flexDirection:'row',alignItems:'flex-end',marginBottom:6},cepBtn:{backgroundColor:Colors.primary,minHeight:56,paddingHorizontal:16,borderRadius:11,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6},cepBtnText:{color:'#fff',fontSize:13,fontWeight:'700'},cepStatus:{flexDirection:'row',alignItems:'center',padding:10,borderRadius:10,marginBottom:12,gap:6},cepSuccess:{backgroundColor:Colors.accentSurface},cepError:{backgroundColor:'#fde8e8'},cepStatusText:{fontSize:12,fontWeight:'600',flex:1}});
