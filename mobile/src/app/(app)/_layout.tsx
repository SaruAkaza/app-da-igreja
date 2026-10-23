import { Redirect,Stack } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
export default function AuthLayout() { const { user, loading } = useAuth(); if (loading) return null; if (!user) return <Redirect href="/" />; return <Stack key={`${user.id}:${user.church_id || ''}:${user.role}`} screenOptions={{ headerShown: false }} />; }
