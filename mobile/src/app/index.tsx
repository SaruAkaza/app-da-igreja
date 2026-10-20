import { Redirect } from 'expo-router';
import { ActivityIndicator,View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { ScreenRoute } from '../navigation/ScreenRoute';
import { LoginScreen } from '../screens/LoginScreen';
export default function Index() { const { user, loading } = useAuth(); if (loading) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator accessibilityLabel="Restaurando sessão" /></View>; return user ? <Redirect href="/(app)/(tabs)/home" /> : <ScreenRoute screen={LoginScreen} />; }
