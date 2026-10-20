import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { Colors, Typography } from './src/theme/colors';

import { LoginScreen } from './src/screens/LoginScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { GroupFeedScreen } from './src/screens/GroupFeedScreen';
import { PhotoCaptureScreen } from './src/screens/PhotoCaptureScreen';
import { RewardsScreen } from './src/screens/RewardsScreen';
import { ExploreGroupsScreen } from './src/screens/ExploreGroupsScreen';
import { LeaderScannerScreen } from './src/screens/LeaderScannerScreen';
import { FeedbacksScreen } from './src/screens/FeedbacksScreen';
import { GroupsRankingScreen } from './src/screens/GroupsRankingScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const { user } = useAuth();
  const isLeaderOrAdmin = user?.role === 'leader' || user?.role === 'church_admin' || user?.role === 'super_admin';

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          height: 68,
          paddingBottom: 10,
          paddingTop: 8,
          backgroundColor: '#ffffff',
          borderTopColor: Colors.border,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Início',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>🏠</Text>,
        }}
      />
      <Tab.Screen
        name="Feed"
        component={GroupFeedScreen}
        options={{
          tabBarLabel: 'Mural',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>👥</Text>,
        }}
      />
      <Tab.Screen
        name="Capture"
        component={PhotoCaptureScreen}
        options={{
          tabBarLabel: 'Tirar Foto',
          tabBarIcon: () => (
            <View style={styles.captureTabHighlight}>
              <Text style={{ fontSize: 22 }}>📸</Text>
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Feedbacks"
        component={FeedbacksScreen}
        options={{
          tabBarLabel: 'Dicas Líder',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>💌</Text>,
        }}
      />
      <Tab.Screen
        name="GroupsRanking"
        component={GroupsRankingScreen}
        options={{
          tabBarLabel: 'Células',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>🏆</Text>,
        }}
      />
      {isLeaderOrAdmin && (
        <Tab.Screen
          name="Leader"
          component={LeaderScannerScreen}
          options={{
            tabBarLabel: 'Líder',
            tabBarIcon: () => <Text style={{ fontSize: 20 }}>🛡️</Text>,
          }}
        />
      )}
    </Tab.Navigator>
  );
}

function NavigationRoot() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Carregando congregação...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen name="Rewards" component={RewardsScreen} />
            <Stack.Screen name="Explore" component={ExploreGroupsScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <NavigationRoot />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: Typography.bodyMedium,
    color: Colors.textSecondary,
    marginTop: 12,
    fontWeight: '600',
  },
  captureTabHighlight: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primarySurface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.primaryLight,
    marginTop: -8,
  },
});
