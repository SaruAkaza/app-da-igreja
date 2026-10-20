import { useEffect,useState } from 'react';
import { Image,ImageProps,Platform,Text } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { formatImageUrl } from '../services/api';
import { Colors } from '../theme/colors';
type Props = Omit<ImageProps, 'source'> & { path: string };
export function PrivateImage({ path, ...props }: Props) {
  const { token } = useAuth();
  const [loaded, setLoaded] = useState<{ key: string; uri?: string; failed?: boolean } | null>(null);
  const key = path + token;
  const needsBlob = Platform.OS === 'web' && path.startsWith('/api/');
  useEffect(() => {
    if (!needsBlob) return;
    const controller = new AbortController(); let localUrl = '';
    fetch(formatImageUrl(path), { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error('Foto indisponível'); const blob = await response.blob(); if (controller.signal.aborted) return; localUrl = URL.createObjectURL(blob); setLoaded({ key, uri: localUrl }); })
      .catch(() => { if (!controller.signal.aborted) setLoaded({ key, failed: true }); });
    return () => { controller.abort(); if (localUrl) URL.revokeObjectURL(localUrl); };
  }, [path, token, key, needsBlob]);
  const uri = needsBlob ? loaded?.key === key ? loaded.uri : null : formatImageUrl(path);
  if (loaded?.key === key && loaded.failed) return <Text style={{ color: Colors.textSecondary, padding: 16 }}>Não foi possível carregar esta foto.</Text>;
  if (!uri) return null;
  return <Image {...props} source={{ uri, ...(Platform.OS !== 'web' && path.startsWith('/api/') ? { headers: { Authorization: `Bearer ${token}` } } : {}) }} onError={() => setLoaded({ key, failed: true })} />;
}
