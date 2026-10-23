import { Ionicons } from '@expo/vector-icons';
import { Tabs,type TabsScreenOptions } from 'expo-router/js-tabs';
import React from 'react';
import { useAuth } from '../../../context/AuthContext';
import { Colors } from '../../../theme/colors';
export default function TabLayout() {
  const { user, isSeniorMode } = useAuth();
  const leader = ['leader','church_admin','super_admin'].includes(user?.role || '');
  const tab = (title: string, name: React.ComponentProps<typeof Ionicons>['name']): TabsScreenOptions => ({ title, tabBarIcon: ({ color, size }) => <Ionicons name={name} size={size} color={typeof color === 'string' ? color : Colors.primary} /> });
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: Colors.primary, tabBarInactiveTintColor: Colors.textSecondary, tabBarStyle: { minHeight: 76, paddingTop: 9, paddingBottom: 12, borderTopColor: Colors.border, backgroundColor: Colors.surface }, tabBarLabelStyle: { fontSize: isSeniorMode ? 13 : 11, fontWeight: '600' } }}>
    <Tabs.Screen name="home" options={tab('Início','home-outline')} />
    <Tabs.Screen name="connections" options={tab('Conexões','people-outline')} />
    <Tabs.Screen name="feed" options={{ ...tab('Comunidade','people-outline'), href: null }} />
    <Tabs.Screen name="capture" options={tab('Registrar','add-circle-outline')} />
    <Tabs.Screen name="feedbacks" options={tab('Conversas','chatbubble-ellipses-outline')} />
    <Tabs.Screen name="groups" options={{ ...tab('Grupos','leaf-outline'), href: null }} />
    <Tabs.Screen name="leader" options={{ ...tab('Liderança','shield-checkmark-outline'), href: leader ? undefined : null }} />
  </Tabs>;
}
