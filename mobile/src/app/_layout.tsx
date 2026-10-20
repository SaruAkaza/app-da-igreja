import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider,useAuth } from '../context/AuthContext';
function SessionRoutes() { const { user } = useAuth(); return <Stack key={user?.id || 'guest'} screenOptions={{ headerShown: false }} />; }
export default function RootLayout() {
  return <SafeAreaProvider><AuthProvider><StatusBar style="dark" /><SessionRoutes /></AuthProvider></SafeAreaProvider>;
}
