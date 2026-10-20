import { View } from 'react-native';
import { router,useLocalSearchParams } from 'expo-router';
import React from 'react';
const paths: Record<string,string> = { Home: '/(app)/(tabs)/home', Feed: '/(app)/(tabs)/feed', Capture: '/(app)/(tabs)/capture', Feedbacks: '/(app)/(tabs)/feedbacks', GroupsRanking: '/(app)/(tabs)/groups', Leader: '/(app)/(tabs)/leader', Rewards: '/(app)/rewards', Explore: '/(app)/explore', Register: '/register', Login: '/' };
// Mantém os componentes existentes enquanto as rotas são administradas pelo Expo Router.
export function ScreenRoute({ screen: Screen }: { screen: React.ComponentType<any> }) {
  const params = useLocalSearchParams();
  const navigation = {
    navigate: (name: string, values?: any) => {
      const target = name === 'MainTabs' ? (values?.screen || 'Home') : name;
      const clean = Object.fromEntries(Object.entries(values || {}).filter(([key,value]) => key !== 'screen' && value != null));
      router.navigate({ pathname: paths[target] || paths.Home, params: clean } as any);
    },
    goBack: () => router.canGoBack() ? router.back() : router.replace('/(app)/(tabs)/home'),
    canGoBack: () => router.canGoBack(),
  };
  return <View style={{ flex: 1, width: '100%', maxWidth: 840, alignSelf: 'center' }}><Screen key={JSON.stringify(params)} navigation={navigation} route={{ params }} /></View>;
}
