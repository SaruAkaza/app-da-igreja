import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { api, Coupon, Reward } from '../services/api';
import { Colors } from '../theme/colors';
import { AccessibleButton } from './AccessibleButton';
import { CouponCard } from './CouponCard';

export function GroupRewardsPanel({ groupId, navigation, canManage }: { groupId: string; navigation: any; canManage: boolean }) {
  const { user } = useAuth();
  const [rewards, setRewards] = useState<Reward[]>([]), [coupons, setCoupons] = useState<Coupon[]>([]);
  const [busy, setBusy] = useState(true), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [form, setForm] = useState(false), [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(''), [partner, setPartner] = useState(''), [points, setPoints] = useState('');
  const [type, setType] = useState<'points' | 'podium'>('points'), [position, setPosition] = useState(1);
  const load = useCallback(async () => {
    setBusy(true); setError('');
    try {
      const [catalog, mine] = await Promise.all([api.get('/api/gamification/rewards', { params: { groupId } }), api.get('/api/gamification/my-coupons')]);
      setRewards(catalog.data.rewards || []); setCoupons(mine.data.filter((c: Coupon) => c.group_id === groupId));
    } catch (e: any) { setError(e.response?.data?.error || 'Não foi possível atualizar os prêmios.'); }
    finally { setBusy(false); }
  }, [groupId]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  async function create() {
    if (saving) return;
    setSaving(true); setError(''); setMessage('');
    try {
      await api.post('/api/admin/rewards', { title, tier: type === 'podium' ? 'ouro' : 'bronze', partnerName: partner, pointsRequired: Number(points), groupId, rewardType: type, podiumPosition: position });
      setTitle(''); setPartner(''); setPoints(''); setForm(false); setMessage('Prêmio vinculado a este grupo. Os participantes já podem acompanhar a meta.'); await load();
    } catch (e: any) { setError(e.response?.data?.error || 'Não foi possível cadastrar o prêmio. Confira os dados e tente novamente.'); }
    finally { setSaving(false); }
  }
  return <View style={s.panel}>
    <Text style={s.eyebrow}>CONQUISTAS COM PROPÓSITO</Text><Text style={s.title}>A constância também se celebra.</Text>
    <Text style={s.description}>Prêmios do grupo usam os pontos das suas leituras neste grupo e no ciclo definido. Prêmios gerais usam seus pontos da igreja. Perguntar ou responder não gera pontos.</Text>
    {error ? <View style={s.card}><Text accessibilityRole="alert" style={s.error}>{error}</Text><AccessibleButton title="Atualizar prêmios" variant="outline" onPress={() => void load()} /></View> : null}
    {message ? <Text accessibilityRole="alert" style={s.notice}>{message}</Text> : null}
    {canManage ? <AccessibleButton title={form ? 'Fechar cadastro de prêmio' : 'Cadastrar prêmio neste grupo'} variant="outline" onPress={() => setForm(!form)} /> : null}
    {form && canManage ? <View style={s.card}>
      <Text style={s.cardTitle}>Uma conquista para este grupo</Text>
      <TextInput accessibilityLabel="Nome do prêmio" placeholder="Ex.: Livro de estudo bíblico" value={title} onChangeText={setTitle} maxLength={150} style={s.input} />
      <TextInput accessibilityLabel="Local de retirada" placeholder="Onde o prêmio será entregue?" value={partner} onChangeText={setPartner} maxLength={150} style={s.input} />
      <View style={s.row}>{(['points', 'podium'] as const).map(t => <TouchableOpacity key={t} accessibilityRole="button" onPress={() => setType(t)} style={[s.chip, type === t && s.active]}><Text style={type === t ? s.white : s.green}>{t === 'points' ? 'Meta de pontos' : 'Pódio do ciclo'}</Text></TouchableOpacity>)}</View>
      {type === 'points' ? <TextInput accessibilityLabel="Pontos necessários no grupo" placeholder="Meta de pontos neste grupo" value={points} onChangeText={setPoints} keyboardType="numeric" style={s.input} /> : <View style={s.row}>{[1, 2, 3].map(p => <TouchableOpacity key={p} accessibilityRole="button" onPress={() => setPosition(p)} style={[s.chip, position === p && s.active]}><Text style={position === p ? s.white : s.green}>{p}º lugar</Text></TouchableOpacity>)}</View>}
      <AccessibleButton title="Salvar prêmio do grupo" loading={saving} onPress={() => void create()} />
    </View> : null}
    <Text style={s.cardTitle}>Metas disponíveis</Text>
    {busy ? <ActivityIndicator color={Colors.primary} /> : null}
    {!busy && !rewards.length ? <View style={s.card}><Text style={s.description}>A administração da sua igreja ainda não cadastrou metas para este grupo.</Text></View> : null}
    {rewards.map(r => <View key={r.id} style={s.card}>
      <Text style={s.eyebrow}>{r.group_id ? 'DESTE GRUPO' : 'DA SUA IGREJA'}{r.reward_type === 'podium' ? ' · ' + r.podium_position + 'º LUGAR' : ''}</Text>
      <Text style={s.cardTitle}>{r.title}</Text>{r.description ? <Text style={s.description}>{r.description}</Text> : null}
      <Text style={s.description}>Retirada: {r.partner_name}</Text>
      {r.reward_type === 'podium' ? <Text style={s.green}>{r.already_claimed ? 'Conquista alcançada. Seu cupom está disponível.' : 'A liderança entrega no encerramento do ciclo, conforme o pódio do grupo.'}</Text> : <>
        <View style={s.track}><View style={[s.fill, { width: `${r.progress_percent}%` }]} /></View>
        <Text style={s.description}>{r.user_points} de {r.points_required} pontos {r.group_id ? 'neste grupo' : 'na igreja'}</Text>
        <Text style={s.green}>{r.already_claimed ? 'Cupom já emitido para esta conquista.' : r.unlocked ? 'Meta atingida.' : 'Faltam ' + r.points_remaining + ' pontos.'}</Text>
      </>}
    </View>)}
    <Text style={s.cardTitle}>Meus cupons deste grupo</Text>
    {coupons.length ? coupons.map(c => <CouponCard key={c.id} coupon={c} />) : <Text style={s.description}>Seus cupons aparecerão aqui assim que você alcançar uma meta ou conquistar o pódio.</Text>}
    <AccessibleButton title="Ver todos os meus cupons" variant="outline" onPress={() => navigation.navigate('Rewards')} />
    {['leader', 'church_admin'].includes(user?.role || '') ? <AccessibleButton title="Registrar entrega de prêmio" variant="secondary" onPress={() => navigation.navigate('Leader', { mode: 'redeem', groupId })} /> : null}
  </View>;
}
const s = StyleSheet.create({ panel: { gap: 16 }, eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1, color: Colors.primary }, title: { fontSize: 25, fontWeight: '700', letterSpacing: -.6, color: Colors.textPrimary }, description: { fontSize: 14, lineHeight: 23, color: Colors.textSecondary }, card: { backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: Colors.border, padding: 20, gap: 12 }, cardTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary }, row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' }, chip: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 24, backgroundColor: Colors.primarySurface }, active: { backgroundColor: Colors.primary }, white: { color: '#fff', fontWeight: '600' }, green: { color: Colors.primary, lineHeight: 22, fontWeight: '600', fontSize: 13 }, input: { minHeight: 56, borderWidth: 1, borderColor: Colors.borderStrong, padding: 14, borderRadius: 12, fontSize: 16, color: Colors.textPrimary }, track: { height: 7, borderRadius: 4, backgroundColor: Colors.border, overflow: 'hidden' }, fill: { height: 7, backgroundColor: Colors.primaryLight }, error: { color: Colors.danger, lineHeight: 22 }, notice: { color: Colors.primary, backgroundColor: Colors.primarySurface, padding: 16, borderRadius: 12, lineHeight: 23 } });
