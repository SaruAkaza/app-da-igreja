import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TextInput,
  Alert,
  TouchableOpacity,
  Image,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Spacing, Typography } from '../theme/colors';
import { AccessibleButton } from '../components/AccessibleButton';
import { PhotoReviewModal } from '../components/PhotoReviewModal';
import { api, Group } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const PhotoCaptureScreen: React.FC<{ navigation: any; route: any }> = ({
  navigation,
  route,
}) => {
  const { refreshProfile } = useAuth();
  const preselectedGroupId = route.params?.targetGroupId || null;

  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(preselectedGroupId);
  const [passageOrChapter, setPassageOrChapter] = useState('');
  const [notes, setNotes] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);

  // Modal acessível de confirmação de nitidez para idosos
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadMyGroups();
  }, []);

  const loadMyGroups = async () => {
    try {
      const res = await api.get('/api/groups/my');
      setGroups(res.data);
      if (!selectedGroupId && res.data.length > 0) {
        setSelectedGroupId(res.data[0].id);
      }
    } catch (e) {
      console.error('Erro ao carregar grupos:', e);
    }
  };

  const handleLaunchCamera = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permissão Necessária',
          'Precisamos de permissão para abrir a câmera para que você possa fotografar sua folha.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImageUri(result.assets[0].uri);
        setReviewModalVisible(true);
      }
    } catch (err) {
      console.error('Erro na câmera:', err);
      Alert.alert('Aviso', 'Não foi possível acessar a câmera. Você pode escolher uma foto da galeria.');
    }
  };

  const handleLaunchGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImageUri(result.assets[0].uri);
        setReviewModalVisible(true);
      }
    } catch (err) {
      console.error('Erro na galeria:', err);
      Alert.alert('Aviso', 'Não foi possível acessar a galeria de fotos.');
    }
  };

  // Envio final para o backend com upload multipart
  const handleConfirmSubmit = async () => {
    if (!imageUri) {
      Alert.alert('Foto Obrigatória', 'Por favor, tire a foto da sua folha manuscrita.');
      return;
    }
    if (!selectedGroupId) {
      Alert.alert('Selecione o Grupo', 'Escolha para qual grupo de estudo você está enviando esta anotação.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('groupId', selectedGroupId);
      formData.append('passageOrChapter', passageOrChapter.trim());
      formData.append('notes', notes.trim());

      const filename = imageUri.split('/').pop() || 'folha_devocional.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      formData.append('photo', {
        uri: Platform.OS === 'ios' ? imageUri.replace('file://', '') : imageUri,
        name: filename,
        type,
      } as any);

      const res = await api.post('/api/devotionals', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setReviewModalVisible(false);
      await refreshProfile();

      const { points_earned, user_stats, unlocked_coupons } = res.data;

      let msg = `Você ganhou +${points_earned.total} pontos!\nSua sequência agora é de 🔥 ${user_stats.current_streak} dia(s).`;
      if (unlocked_coupons && unlocked_coupons.length > 0) {
        msg += `\n\n🎉 PARABÉNS! Você desbloqueou novo cupom de recompensa: ${unlocked_coupons[0].reward_title}!`;
      }

      Alert.alert('✅ Devocional Publicado com Sucesso!', msg, [
        {
          text: 'Glória a Deus! Ver no Feed',
          onPress: () => {
            navigation.navigate('Feed', { groupId: selectedGroupId });
          },
        },
      ]);
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Erro ao enviar foto do devocional.';
      Alert.alert('Não foi possível enviar', errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Envio da Folha Manuscrita</Text>
          <Text style={styles.subtitle}>
            Fotografe a página do seu caderno onde você fez as anotações do estudo de hoje.
          </Text>
        </View>

        {/* Escolha do Grupo de Estudo */}
        <View style={styles.card}>
          <Text style={styles.label}>1. ESCOLHA O GRUPO DESTE DEVOCIONAL</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.groupScroll}>
            {groups.map((g) => (
              <TouchableOpacity
                key={g.id}
                onPress={() => setSelectedGroupId(g.id)}
                style={[
                  styles.groupChip,
                  selectedGroupId === g.id && styles.groupChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.groupChipText,
                    selectedGroupId === g.id && styles.groupChipTextActive,
                  ]}
                >
                  {g.title}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Passagem Bíblica / Capítulo */}
        <View style={styles.card}>
          <Text style={styles.label}>2. TEXTO BÍBLICO OU CAPÍTULO LIDO</Text>
          <TextInput
            value={passageOrChapter}
            onChangeText={setPassageOrChapter}
            placeholder="Ex: Tiago 1:19-27 ou Capítulo 3"
            style={styles.input}
          />
        </View>

        {/* Reflexão ou Destaque */}
        <View style={styles.card}>
          <Text style={styles.label}>3. O QUE DEUS FALOU COM VOCÊ HOJE? (OPCIONAL)</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Escreva em poucas palavras o que mais tocou seu coração..."
            multiline
            numberOfLines={3}
            style={[styles.input, styles.textArea]}
          />
        </View>

        {/* Pré-visualização ou Botões Grandes de Captura */}
        <View style={styles.actionSection}>
          {imageUri ? (
            <View style={styles.previewBox}>
              <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="cover" />
              <AccessibleButton
                title="👀 Conferir Nitidez da Imagem"
                subtitle="Abrir tela de confirmação acessível"
                variant="accent"
                onPress={() => setReviewModalVisible(true)}
                style={{ marginTop: 12 }}
              />
            </View>
          ) : (
            <View style={styles.buttonStack}>
              <AccessibleButton
                title="📸 Bater Foto com a Câmera"
                subtitle="Aponte para o seu caderno de anotações"
                variant="primary"
                onPress={handleLaunchCamera}
                style={styles.bigActionBtn}
              />

              <AccessibleButton
                title="🖼️ Escolher da Galeria de Fotos"
                subtitle="Se você já tirou a foto anteriormente"
                variant="secondary"
                onPress={handleLaunchGallery}
                style={styles.bigActionBtn}
              />
            </View>
          )}
        </View>
      </ScrollView>

      {/* Modal Acessível com confirmação "Tirar Outra" vs "Tudo Certo, Enviar!" */}
      <PhotoReviewModal
        visible={reviewModalVisible}
        imageUri={imageUri}
        onRetake={() => {
          setReviewModalVisible(false);
          handleLaunchCamera();
        }}
        onConfirm={handleConfirmSubmit}
        isSubmitting={submitting}
      />
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
  header: {
    alignItems: 'center',
    marginVertical: Spacing.md,
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
    marginTop: 4,
    lineHeight: 22,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  groupScroll: {
    flexDirection: 'row',
  },
  groupChip: {
    backgroundColor: Colors.surfaceAlt,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    marginRight: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  groupChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primaryDark,
  },
  groupChipText: {
    fontSize: Typography.bodySmall,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  groupChipTextActive: {
    color: '#fff',
  },
  input: {
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: Typography.bodyLarge,
    color: Colors.textPrimary,
    minHeight: 52,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  actionSection: {
    marginTop: Spacing.sm,
  },
  buttonStack: {
    gap: Spacing.sm,
  },
  bigActionBtn: {
    minHeight: 64,
  },
  previewBox: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: 240,
    borderRadius: 14,
  },
});
