import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Colors } from '../theme/colors';
import { AccessibleButton } from './AccessibleButton';

export function ChurchInviteCard({ onJoined }: { onJoined: () => void }) {
  const { joinChurch, joinGroupByCode } = useAuth();
  const [code, setCode] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function join() {
    if (busy) return;
    if (!code.trim()) { setError('Informe o código de convite recebido da sua igreja ou do grupo.'); return; }
    setBusy(true); setError('');
    try {
      try { await joinGroupByCode(code.trim()); }
      catch (e: any) { if (e.response?.status !== 404) throw e; await joinChurch(code.trim()); }
      onJoined();
    } catch (e: any) { setError(e.response?.data?.error || 'Não foi possível entrar. Confira o convite e tente novamente.'); }
    finally { setBusy(false); }
  }
  return <View style={s.card}><Text style={s.eyebrow}>BEM-VINDO À PLATAFORMA</Text><Text style={s.title}>Encontre a sua igreja.</Text><Text style={s.body}>Use o convite da liderança para conectar sua conta. Você terá acesso aos grupos, conversas e conquistas da sua comunidade.</Text>
    <TextInput accessibilityLabel="Convite da minha igreja ou grupo" placeholder="Código recebido da liderança" autoCapitalize="characters" autoCorrect={false} value={code} onChangeText={setCode} style={s.input} />
    {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}<AccessibleButton title="Conectar à minha igreja" loading={busy} onPress={() => void join()} />
  </View>;
}
const s = StyleSheet.create({ card: { padding: 23, gap: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.border, borderRadius: 22, marginBottom: 20 }, eyebrow: { color: Colors.primary, fontSize: 10, letterSpacing: 1.4, fontWeight: '700' }, title: { color: Colors.textPrimary, fontSize: 26, fontWeight: '700', letterSpacing: -.6 }, body: { color: Colors.textSecondary, fontSize: 15, lineHeight: 24 }, input: { minHeight: 56, padding: 14, borderWidth: 1, borderColor: Colors.borderStrong, borderRadius: 12, fontSize: 16, color: Colors.textPrimary }, error: { color: Colors.danger, lineHeight: 22 } });
