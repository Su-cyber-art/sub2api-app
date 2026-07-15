import '@/src/global.css';

import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { queryClient } from '@/src/lib/query-client';
import { AdminComplianceGate } from '@/src/components/admin-compliance-gate';
import { markPerformance } from '@/src/lib/performance';
import { adminConfigState, hydrateAdminConfig } from '@/src/store/admin-config';

const { useSnapshot } = require('valtio/react');

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

const detailScreenBaseOptions = {
  animation: 'slide_from_right' as const,
  presentation: 'card' as const,
  headerShown: true,
  headerTintColor: Platform.OS === 'ios' ? '#007AFF' : '#16181a',
  headerStyle: { backgroundColor: Platform.OS === 'ios' ? '#F2F2F7' : '#f4efe4' },
  headerShadowVisible: false,
  ...(Platform.OS === 'ios'
    ? { headerBackButtonDisplayMode: 'minimal' as const }
    : { headerBackTitle: '返回' }),
};

function detailScreenOptions(title: string) {
  return { ...detailScreenBaseOptions, title };
}

export default function RootLayout() {
  const config = useSnapshot(adminConfigState);

  useEffect(() => {
    hydrateAdminConfig()
      .then(() => markPerformance('config_hydrated'))
      .catch(() => undefined);
  }, []);

  const isReady = config.hydrated;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        {!isReady ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Platform.OS === 'ios' ? '#F2F2F7' : '#f4efe4' }}>
            <ActivityIndicator color={Platform.OS === 'ios' ? '#007AFF' : '#1d5f55'} />
          </View>
        ) : (
          <Stack initialRouteName="(tabs)" screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="login" />
            <Stack.Screen
              name="users/[id]"
              options={detailScreenOptions('用户详情')}
            />
            <Stack.Screen
              name="users/create-account"
              options={detailScreenOptions('添加账号')}
            />
            <Stack.Screen
              name="users/create-user"
              options={detailScreenOptions('添加用户')}
            />
            <Stack.Screen
              name="accounts/create"
              options={detailScreenOptions('添加账号')}
            />
            <Stack.Screen
              name="accounts/overview"
              options={detailScreenOptions('账号清单')}
            />
          </Stack>
        )}
        <AdminComplianceGate />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
