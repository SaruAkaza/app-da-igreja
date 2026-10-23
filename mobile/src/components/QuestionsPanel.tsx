import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { api, Group, GroupQuestion } from '../services/api';
import { Colors } from '../theme/colors';
import { AccessibleButton } from './AccessibleButton';
import { PrivateImage } from './PrivateImage';

export function QuestionsPanel({ groupId, devotionalId, onOpenGroup }: {
  groupId?: string; devotionalId?: string; onOpenGroup?: (id: string) => void;
}) {
  const { user, isSeniorMode } = useAuth();
  const role = user?.role;
  const [questions, setQuestions] = useState<GroupQuestion[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selected, setSelected] = useState(groupId || '');
  const [body, setBody] = useState(''), [attached, setAttached] = useState(devotionalId);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [status, setStatus] = useState('all');
  const [busy, setBusy] = useState(true), [sending, setSending] = useState('');
  const [error, setError] = useState(''), [message, setMessage] = useState('');
  const [page, setPage] = useState(1), [more, setMore] = useState(false);
  const latestRequest = useRef(0);
  const load = useCallback(async (number = 1) => {
    const request = ++latestRequest.current;
    setBusy(true); setError('');
    try {
      const [response, myGroups] = await Promise.all([
        api.get('/api/questions', { params: { groupId, status, page: number } }),
        groupId ? Promise.resolve(null) : api.get(role === 'church_admin' ? '/api/groups' : '/api/groups/my'),
      ]);
      if (request !== latestRequest.current) return;
      setQuestions(current => number === 1 ? response.data : [...current, ...response.data]);
      if (myGroups) { setGroups(myGroups.data); setSelected(current => current || myGroups.data[0]?.id || ''); }
      setPage(number); setMore(response.data.length === 50);
    } catch (e: any) { if (request === latestRequest.current) setError(e.response?.data?.error || 'Não foi possível carregar as conversas. Tente novamente.'); }
    finally { if (request === latestRequest.current) setBusy(false); }
  }, [groupId, status, role]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  async function send() {
    if (sending) return;
    if (!selected || body.trim().length < 5) { setError('Escolha um grupo e escreva sua dúvida com pelo menos 5 caracteres.'); return; }
    setSending('new'); setError(''); setMessage('');
    try {
      await api.post('/api/questions', { groupId: selected, body, ...(attached ? { devotionalId: attached } : {}) });
      setBody(''); setAttached(undefined); setMessage('Dúvida enviada. A liderança responsável poderá responder por aqui.');
      if (status === 'all') await load(); else setStatus('all');
    } catch (e: any) { setError(e.response?.data?.error || 'Sua dúvida não foi enviada. O texto foi mantido para tentar novamente.'); }
    finally { setSending(''); }
  }
  async function answer(question: GroupQuestion) {
    if (sending) return;
    const value = answers[question.id] || '';
    if (value.trim().length < 5) { setError('Escreva uma resposta com pelo menos 5 caracteres.'); return; }
    setSending(question.id); setError(''); setMessage('');
    try {
      await api.post('/api/questions/' + question.id + '/answer', { answer: value });
      setMessage('Resposta enviada com privacidade ao autor da dúvida.'); await load();
    } catch (e: any) { setError(e.response?.data?.error || 'Não foi possível enviar. Sua resposta foi mantida.'); }
    finally { setSending(''); }
  }
  async function markRead(id: string) {
    try { await api.post('/api/questions/' + id + '/read'); await load(); }
    catch (e: any) { setError(e.response?.data?.error || 'Não foi possível atualizar a resposta.'); }
  }
  const fontSize = isSeniorMode ? 20 : 15;
  return <View style={s.container}>
    <View style={s.intro}><Text style={s.eyebrow}>CONVERSAS QUE ACOLHEM</Text><Text style={s.title}>Suas dúvidas têm espaço aqui.</Text>
      <Text style={[s.description, { fontSize }]}>Somente você, o líder responsável e a administração da sua igreja veem esta conversa.</Text></View>
    {error ? <View style={s.error}><Text accessibilityRole="alert" style={s.errorText}>{error}</Text><AccessibleButton title="Atualizar conversas" variant="outline" onPress={() => void load()} /></View> : null}
    {message ? <Text accessibilityRole="alert" style={s.notice}>{message}</Text> : null}
    {(groupId || groups.length > 0) ? <View style={s.card}>
      <Text style={s.cardTitle}>Registrar uma dúvida</Text>
      {!groupId ? <ScrollView horizontal contentContainerStyle={s.chips}>{groups.map(g => <TouchableOpacity key={g.id} accessibilityRole="button" accessibilityState={{ selected: selected === g.id }} accessibilityLabel={'Perguntar no grupo ' + g.title} onPress={() => { setSelected(g.id); setAttached(undefined); }} style={[s.chip, selected === g.id && s.active]}><Text style={selected === g.id ? s.activeText : s.chipText}>{g.title}</Text></TouchableOpacity>)}</ScrollView> : null}
      {attached ? <View style={s.attachment}><Text style={s.description}>Sua imagem e passagem estarão vinculadas a esta dúvida.</Text><AccessibleButton title="Remover vínculo com a leitura" variant="secondary" onPress={() => setAttached(undefined)} /></View> : null}
      <TextInput value={body} onChangeText={setBody} accessibilityLabel="Sua dúvida" placeholder="O que você gostaria de entender melhor sobre sua leitura?" multiline maxLength={3000} style={[s.input, { fontSize }]} />
      <AccessibleButton title="Enviar dúvida ao líder" onPress={() => void send()} loading={sending === 'new'} disabled={!!sending && sending !== 'new'} />
    </View> : <View style={s.card}><Text style={s.description}>Entre em um grupo de conexão da sua igreja para conversar com a liderança.</Text></View>}
    <View style={s.filters}>{[['all', 'Todas'], ['open', 'Em aberto'], ['answered', 'Respondidas']].map(([value, label]) => <TouchableOpacity key={value} accessibilityRole="button" accessibilityState={{ selected: status === value }} onPress={() => setStatus(value)} style={[s.chip, status === value && s.active]}><Text style={status === value ? s.activeText : s.chipText}>{label}</Text></TouchableOpacity>)}</View>
    {busy && !questions.length ? <ActivityIndicator color={Colors.primary} /> : null}
    {!busy && !questions.length ? <View style={s.empty}><Text style={s.cardTitle}>Uma conversa pode começar hoje.</Text><Text style={s.description}>As dúvidas e respostas aparecerão aqui, no grupo certo e com privacidade.</Text></View> : null}
    {questions.map(q => <View key={q.id} style={[s.card, q.unread && s.unread]}>
      <View style={s.row}><Text style={s.badge}>{q.unread ? 'NOVA RESPOSTA' : q.status === 'answered' ? 'RESPONDIDA' : 'AGUARDANDO LIDERANÇA'}</Text><Text style={s.date}>{new Date(q.created_at).toLocaleDateString('pt-BR')}</Text></View>
      <Text style={s.cardTitle}>{q.author_id === user?.id ? 'Minha dúvida' : q.author_name}</Text>
      <TouchableOpacity accessibilityRole="button" disabled={!onOpenGroup} onPress={() => onOpenGroup?.(q.group_id)}><Text style={s.group}>{q.group_title}{q.passage_or_chapter ? ' · ' + q.passage_or_chapter : ''}</Text></TouchableOpacity>
      <Text style={[s.body, { fontSize }]}>{q.body}</Text>
      {q.image_url ? <PrivateImage path={q.image_url} style={s.image} resizeMode="contain" accessibilityLabel="Imagem vinculada à dúvida" /> : null}
      {q.answer ? <View style={s.answer}><Text style={s.group}>{q.answered_by_name || 'Liderança da igreja'} respondeu</Text><Text style={[s.body, { fontSize }]}>{q.answer}</Text>{q.unread ? <AccessibleButton title="Marcar resposta como lida" variant="outline" onPress={() => void markRead(q.id)} /> : null}</View> : q.can_answer ? <View style={s.answer}>
        <TextInput accessibilityLabel={'Resposta para ' + q.author_name} value={answers[q.id] || ''} onChangeText={value => setAnswers(current => ({ ...current, [q.id]: value }))} placeholder="Acolha a dúvida e compartilhe sua orientação..." maxLength={5000} multiline style={[s.input, { fontSize }]} />
        <AccessibleButton title="Enviar resposta" onPress={() => void answer(q)} loading={sending === q.id} disabled={!!sending && sending !== q.id} />
      </View> : null}
    </View>)}
    {more ? <AccessibleButton title="Carregar mais conversas" variant="outline" loading={busy} onPress={() => void load(page + 1)} /> : null}
  </View>;
}
const s = StyleSheet.create({
  container: { gap: 16 }, intro: { gap: 10, paddingVertical: 8 }, eyebrow: { fontSize: 10, letterSpacing: 1.5, fontWeight: '700', color: Colors.primary }, title: { fontSize: 25, fontWeight: '700', color: Colors.textPrimary, letterSpacing: -.7 },
  description: { fontSize: 14, lineHeight: 23, color: Colors.textSecondary }, card: { backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.border, borderRadius: 20, padding: 20, gap: 12 }, cardTitle: { fontSize: 18, color: Colors.textPrimary, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: Colors.borderStrong, borderRadius: 12, minHeight: 120, padding: 15, color: Colors.textPrimary, textAlignVertical: 'top', backgroundColor: '#fff' },
  chips: { gap: 8, paddingVertical: 4 }, filters: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' }, chip: { minHeight: 48, paddingHorizontal: 15, justifyContent: 'center', borderRadius: 24, backgroundColor: '#edf1e8' }, active: { backgroundColor: Colors.primary }, chipText: { color: Colors.primary, fontSize: 13, fontWeight: '600' }, activeText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }, badge: { fontSize: 10, color: Colors.primary, fontWeight: '700', letterSpacing: .5 }, date: { color: Colors.textMuted, fontSize: 11 }, group: { color: Colors.primary, fontSize: 13, lineHeight: 20, fontWeight: '600' }, body: { color: Colors.textPrimary, lineHeight: 25 }, answer: { paddingTop: 16, borderTopWidth: 1, borderColor: Colors.border, gap: 10 },
  unread: { borderColor: Colors.primaryLight, borderWidth: 2 }, notice: { backgroundColor: Colors.primarySurface, color: Colors.primary, padding: 16, borderRadius: 12, lineHeight: 23 }, error: { backgroundColor: Colors.dangerSurface, padding: 16, borderRadius: 12 }, errorText: { color: Colors.danger, lineHeight: 23 }, image: { width: '100%', height: 220, borderRadius: 12, backgroundColor: Colors.background }, attachment: { backgroundColor: Colors.primarySurface, padding: 12, borderRadius: 12 }, empty: { padding: 22, gap: 10 },
});
