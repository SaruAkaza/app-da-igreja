import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AccessibleButton } from '../components/AccessibleButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { useAuth } from '../context/AuthContext';
import { api, Group } from '../services/api';
import { Colors } from '../theme/colors';

export function ConnectionsScreen({ navigation }: { navigation: any }) {
  const { user } = useAuth();
  const role = user?.role;
  const [groups, setGroups] = useState<Group[]>([]), [busy, setBusy] = useState(true), [error, setError] = useState('');
  const load = useCallback(async () => {
    setBusy(true); setError('');
    try {
      const response = await api.get(role === 'church_admin' ? '/api/groups' : '/api/groups/my');
      setGroups(response.data);
    } catch (e: any) { setError(e.response?.data?.error || 'Não foi possível carregar seus grupos.'); }
    finally { setBusy(false); }
  }, [role]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  return <SafeAreaView style={s.safe}><ScreenHeader title="Grupos de conexão" subtitle={user?.church_name || 'Sua comunidade começa aqui'} navigation={navigation} />
    <ScrollView contentContainerStyle={s.container} refreshControl={<RefreshControl refreshing={busy} onRefresh={() => void load()} />}>
      <Text style={s.eyebrow}>UMA CAMINHADA COMPARTILHADA</Text><Text style={s.title}>Tudo começa na conexão.</Text><Text style={s.description}>Leituras, conversas e conquistas reunidas no grupo que caminha com você.</Text>
      {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
      <AccessibleButton title={user?.church_id ? 'Encontrar grupos da minha igreja' : 'Entrar com convite da igreja'} variant="outline" onPress={() => navigation.navigate('Explore')} />
      {busy && !groups.length ? <ActivityIndicator color={Colors.primary} /> : null}
      {!busy && !groups.length ? <View style={s.card}><Ionicons name="people-outline" size={34} color={Colors.primary} /><Text style={s.groupTitle}>Seu lugar na comunidade.</Text><Text style={s.description}>Peça um convite ao seu líder. Ao entrar, você terá acesso somente à sua igreja e aos grupos dos quais participa.</Text></View> : null}
      {groups.map(g => <TouchableOpacity key={g.id} accessibilityRole="button" accessibilityLabel={'Abrir grupo ' + g.title} onPress={() => navigation.navigate('Group', { groupId: g.id })} style={s.card}>
        <View style={s.row}><View style={s.icon}><Ionicons name="leaf-outline" size={25} color={Colors.primary} /></View><Text style={s.badge}>{g.cycle_status === 'completed' ? 'CICLO CONCLUÍDO' : 'EM COMUNIDADE'}</Text></View>
        <Text style={s.groupTitle}>{g.title}</Text><Text style={s.description}>{g.book_or_theme}</Text><Text style={s.description}>{g.member_count || 0} participantes · {g.leader_name || 'Liderança a definir'}</Text>
        <View style={s.footer}><Text style={s.link}>Leituras · Dúvidas · Conquistas</Text><Ionicons name="arrow-forward" size={20} color={Colors.primary} /></View>
        {!!g.unread_answers && <Text style={s.notification}>{g.unread_answers} resposta(s) para você</Text>}
      </TouchableOpacity>)}
    </ScrollView></SafeAreaView>;
}
const s = StyleSheet.create({ safe: { flex: 1, backgroundColor: Colors.background }, container: { padding: 22, gap: 16, paddingBottom: 40 }, eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: Colors.primary }, title: { fontSize: 30, fontWeight: '700', letterSpacing: -.8, color: Colors.textPrimary }, description: { fontSize: 14, lineHeight: 23, color: Colors.textSecondary }, card: { backgroundColor: '#fff', padding: 23, borderRadius: 22, borderWidth: 1, borderColor: Colors.border, gap: 12 }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, icon: { width: 50, height: 50, backgroundColor: Colors.primarySurface, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, badge: { fontSize: 9, letterSpacing: 1, color: Colors.primary, fontWeight: '700' }, groupTitle: { fontSize: 23, letterSpacing: -.5, fontWeight: '700', color: Colors.textPrimary }, footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderColor: Colors.border, paddingTop: 16 }, link: { color: Colors.primary, fontSize: 12, fontWeight: '700' }, notification: { color: Colors.primary, fontSize: 13 }, error: { color: Colors.danger, padding: 12 } });
