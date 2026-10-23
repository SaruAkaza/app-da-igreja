import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AccessibleButton } from '../components/AccessibleButton';
import { DevotionalCard } from '../components/DevotionalCard';
import { GroupRewardsPanel } from '../components/GroupRewardsPanel';
import { QuestionsPanel } from '../components/QuestionsPanel';
import { ScreenHeader } from '../components/ScreenHeader';
import { useAuth } from '../context/AuthContext';
import { api, Devotional, Group } from '../services/api';
import { Alert } from '../services/alerts';
import { Colors } from '../theme/colors';

export function GroupWorkspaceScreen({ navigation, route }: { navigation: any; route: any }) {
  const { user } = useAuth();
  const groupId = typeof route.params?.groupId === 'string' ? route.params.groupId : '';
  const [tab, setTab] = useState(route.params?.tab || 'readings');
  const [attachment, setAttachment] = useState<string | undefined>(route.params?.devotionalId);
  const [group, setGroup] = useState<(Group & { members: any[] }) | null>(null);
  const [posts, setPosts] = useState<Devotional[]>([]), [cycle, setCycle] = useState<any>(null);
  const [busy, setBusy] = useState(true), [error, setError] = useState(''), [closing, setClosing] = useState(false);
  const [page, setPage] = useState(1), [more, setMore] = useState(false);
  const load = useCallback(async () => {
    setBusy(true); setError('');
    try {
      const [details, feed, season] = await Promise.all([api.get('/api/groups/' + groupId), api.get('/api/devotionals/feed', { params: { groupId } }), api.get('/api/groups/' + groupId + '/cycle')]);
      setGroup(details.data); setPosts(feed.data); setCycle(season.data); setPage(1); setMore(feed.data.length === 20);
    } catch (e: any) { setGroup(null); setPosts([]); setCycle(null); setError(e.response?.data?.error || 'Não foi possível abrir este grupo. Confira sua conexão e seu acesso.'); }
    finally { setBusy(false); }
  }, [groupId]);
  useFocusEffect(useCallback(() => { if (groupId) void load(); else setBusy(false); }, [load, groupId]));
  async function morePosts() {
    setBusy(true);
    try { const response = await api.get('/api/devotionals/feed', { params: { groupId, page: page + 1 } }); setPosts(current => [...current, ...response.data]); setPage(page + 1); setMore(response.data.length === 20); }
    catch { setError('Não foi possível carregar mais leituras. Tente novamente.'); }
    finally { setBusy(false); }
  }
  async function closeCycle() {
    if (closing) return;
    setClosing(true); setError('');
    try { await api.post('/api/groups/' + groupId + '/close-cycle'); await load(); }
    catch (e: any) { setError(e.response?.data?.error || 'Não foi possível encerrar o ciclo.'); }
    finally { setClosing(false); }
  }
  function ask(id?: string) { setAttachment(id); setTab('questions'); }
  return <SafeAreaView style={s.safe}><ScreenHeader title={group?.title || 'Meu grupo'} subtitle={user?.church_name || 'Grupo de conexão'} navigation={navigation} />
    <ScrollView contentContainerStyle={s.container} refreshControl={<RefreshControl refreshing={busy} onRefresh={() => void load()} />}>
      {error ? <View style={s.card}><Text accessibilityRole="alert" style={s.error}>{error}</Text><AccessibleButton title="Tentar abrir o grupo novamente" variant="outline" onPress={() => void load()} /></View> : null}
      {busy && !group ? <ActivityIndicator color={Colors.primary} /> : null}
      {group ? <>
        <View style={s.hero}><View style={s.row}><Text style={s.eyebrow}>GRUPO DE CONEXÃO</Text><Ionicons name="leaf-outline" size={25} color="#d8edb6" /></View><Text style={s.title}>{group.title}</Text><Text style={s.heroBody}>{group.book_or_theme}</Text>{group.description ? <Text style={s.heroBody}>{group.description}</Text> : null}<View style={s.heroFooter}><Text style={s.heroBody}>{group.member_count || 0} participantes · {group.leader_name || 'Liderança a definir'}</Text><Text style={s.role}>{group.can_manage ? 'Você cuida deste grupo' : 'Você faz parte desta conexão'}</Text></View></View>
        <View style={s.tabs}>{[['readings', 'Leituras'], ['questions', 'Dúvidas'], ['rewards', 'Conquistas'], ['people', 'Pessoas']].map(([key, title]) => <TouchableOpacity key={key} accessibilityRole="tab" accessibilityState={{ selected: tab === key }} onPress={() => setTab(key)} style={[s.tab, tab === key && s.active]}><Text style={tab === key ? s.white : s.green}>{title}</Text></TouchableOpacity>)}</View>
        {tab === 'readings' ? <View style={s.stack}>
          <View style={s.row}><Text style={s.sectionTitle}>Nossa caminhada na Palavra</Text><Ionicons name="book-outline" size={24} color={Colors.primary} /></View>
          <Text style={s.description}>Celebre a leitura dos participantes. A imagem e a reflexão ficam entre o autor e a liderança responsável.</Text>
          {group.cycle_status !== 'completed' && group.is_member ? <AccessibleButton title="Registrar leitura neste grupo" onPress={() => navigation.navigate('Capture', { targetGroupId: groupId })} /> : null}
          {group.can_manage ? <AccessibleButton title="Orientar leituras deste grupo" variant="outline" onPress={() => navigation.navigate('Leader', { groupId })} /> : null}
          {posts.length ? posts.map(p => <View key={p.id}><DevotionalCard devotional={p} onReactionUpdated={() => void load()} />{p.user_id === user?.id ? <AccessibleButton title="Tirar dúvida sobre esta leitura" variant="outline" onPress={() => ask(p.id)} /> : null}</View>) : <View style={s.card}><Text style={s.sectionTitle}>A primeira leitura abre o caminho.</Text><Text style={s.description}>Registre sua imagem e compartilhe o que aprendeu. Depois, envie sua dúvida à liderança por aqui.</Text></View>}
          {more ? <AccessibleButton title="Carregar mais leituras" variant="outline" loading={busy} onPress={() => void morePosts()} /> : null}
        </View> : tab === 'questions' ? <QuestionsPanel groupId={groupId} devotionalId={attachment} /> : tab === 'rewards' ? <View style={s.stack}>
          <GroupRewardsPanel key={group.cycle_status} groupId={groupId} navigation={navigation} canManage={!!group.can_manage_rewards} />
          {cycle ? <View style={s.card}><Text style={s.sectionTitle}>Pódio deste ciclo</Text><Text style={s.description}>{group.cycle_status === 'completed' ? 'Ciclo concluído. Os cupons de pódio foram emitidos.' : 'Classificação pelas leituras deste grupo no período do ciclo.'}</Text>{cycle.podiumMembers.map((m: any) => <View key={m.id} style={s.row}><Text style={s.description}>{m.position}º · {m.name}</Text><Text style={s.green}>{m.total_points} pts</Text></View>)}
            {group.can_manage && group.cycle_status !== 'completed' ? <AccessibleButton title="Encerrar ciclo e premiar pódio" variant="outline" loading={closing} onPress={() => Alert.alert('Encerrar este ciclo?', 'As leituras deste ciclo serão encerradas e os cupons de pódio serão emitidos uma única vez.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Encerrar ciclo', onPress: () => void closeCycle() }])} /> : null}
          </View> : null}
        </View> : <View style={s.stack}><Text style={s.sectionTitle}>Pessoas que caminham com você</Text><Text style={s.description}>Você está em {user?.church_name}. {group.can_manage ? 'Seu acesso de liderança se limita a esta igreja e aos grupos sob seu cuidado.' : 'Seus dados de contato e conversas privadas não são expostos aos demais participantes.'}</Text>{group.members.map(m => <View style={s.card} key={m.id}><View style={s.row}><Text style={s.sectionTitle}>{m.name}</Text><Ionicons name={m.did_devotional_today ? 'checkmark-circle' : 'person-outline'} size={23} color={Colors.primary} /></View><Text style={s.description}>{m.id === group.leader_id ? 'Liderança responsável' : m.role === 'church_admin' ? 'Administração da igreja' : 'Participante'}</Text></View>)}</View>}
      </> : !busy && !error ? <AccessibleButton title="Abrir meus grupos de conexão" onPress={() => navigation.navigate('Connections')} /> : null}
    </ScrollView></SafeAreaView>;
}
const s = StyleSheet.create({ safe: { flex: 1, backgroundColor: Colors.background }, container: { padding: 20, paddingBottom: 45, gap: 20 }, hero: { backgroundColor: Colors.primaryDark, padding: 25, borderRadius: 25, gap: 12 }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }, eyebrow: { color: '#d8edb6', fontSize: 10, letterSpacing: 1.5, fontWeight: '700' }, title: { color: '#fff', fontSize: 29, fontWeight: '700', letterSpacing: -.7 }, heroBody: { color: '#d0ded3', fontSize: 14, lineHeight: 23 }, heroFooter: { marginTop: 10, borderTopWidth: 1, borderColor: '#39604b', paddingTop: 16, gap: 8 }, role: { color: '#d8edb6', fontSize: 12, fontWeight: '600' }, tabs: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' }, tab: { minHeight: 48, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 24, backgroundColor: '#e8eee2' }, active: { backgroundColor: Colors.primary }, white: { color: '#fff', fontSize: 13, fontWeight: '600' }, green: { color: Colors.primary, fontSize: 13, fontWeight: '600' }, stack: { gap: 16 }, sectionTitle: { color: Colors.textPrimary, fontSize: 19, fontWeight: '700', flexShrink: 1 }, description: { color: Colors.textSecondary, fontSize: 14, lineHeight: 23 }, card: { backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.border, padding: 20, borderRadius: 20, gap: 12 }, error: { color: Colors.danger, lineHeight: 23 } });
