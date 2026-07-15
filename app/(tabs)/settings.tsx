import { router } from 'expo-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ExternalLink, PackageCheck, RefreshCw } from 'lucide-react-native';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { z } from 'zod';

import { checkSystemUpdates, getAdminSettings, getDashboardStats } from '@/src/services/admin';
import { getAdminRequestErrorMessage } from '@/src/lib/admin-error-message';
import { isAdminApiError } from '@/src/lib/admin-fetch';
import { queryClient } from '@/src/lib/query-client';
import { adminConfigState, removeAdminAccount, saveAdminConfig, switchAdminAccount, type AdminAccountProfile } from '@/src/store/admin-config';

const { useSnapshot } = require('valtio/react');

const schema = z
  .object({
    baseUrl: z.string().min(1, '请输入服务器地址'),
    adminApiKey: z.string(),
  })
  .refine((values) => values.adminApiKey.trim().length > 0, {
    path: ['adminApiKey'],
    message: '请输入 Admin Key',
  });

type FormValues = z.infer<typeof schema>;
type ConnectionState = 'idle' | 'checking' | 'success' | 'error';

const colors = {
  page: '#f4efe4',
  card: '#fbf8f2',
  mutedCard: '#f1ece2',
  primary: '#1d5f55',
  text: '#16181a',
  subtext: '#6f665c',
  border: '#e7dfcf',
  dangerBg: '#fbf1eb',
  danger: '#c25d35',
  successBg: '#e6f4ee',
  success: '#1d5f55',
};

function getConnectionErrorMessage(error: unknown) {
  return getAdminRequestErrorMessage(error, '连接失败，请检查服务器地址、Admin Key 和网络连通性。');
}

function formatVersion(value?: string) {
  const version = value?.trim();
  if (!version) return '--';
  return version.toLowerCase().startsWith('v') ? version : `v${version}`;
}

function ServerCard({
  account,
  active,
  onSelect,
  onDelete,
}: {
  account: AdminAccountProfile;
  active: boolean;
  onSelect: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  return (
    <Pressable
      onPress={onSelect}
      style={{
        backgroundColor: active ? '#e6f4ee' : colors.card,
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: active ? colors.success : colors.border,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{account.label}</Text>
          <Text style={{ marginTop: 6, fontSize: 13, lineHeight: 20, color: colors.subtext }}>{account.baseUrl}</Text>
          <Text style={{ marginTop: 8, fontSize: 11, color: '#8a8072' }}>更新时间 {new Date(account.updatedAt).toLocaleString()}</Text>
        </View>
        {active ? (
          <View style={{ backgroundColor: colors.success, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>当前使用</Text>
          </View>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
        <Pressable onPress={onSelect} style={{ flex: 1, backgroundColor: active ? '#d7eee4' : colors.primary, borderRadius: 14, paddingVertical: 11, alignItems: 'center' }}>
          <Text style={{ color: active ? colors.success : '#fff', fontSize: 13, fontWeight: '700' }}>{active ? '已选中' : '切换到此服务器'}</Text>
        </Pressable>
        <Pressable onPress={onDelete} style={{ backgroundColor: colors.border, borderRadius: 14, paddingHorizontal: 16, justifyContent: 'center' }}>
          <Text style={{ color: '#7a3d31', fontSize: 13, fontWeight: '700' }}>删除</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const config = useSnapshot(adminConfigState);
  const [showForm, setShowForm] = useState(config.accounts.length === 0);
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [connectionMessage, setConnectionMessage] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAdminKey, setShowAdminKey] = useState(false);
  const serverScope = `${config.baseUrl}|${config.activeAccountId}`;
  const updateQueryKey = ['system-update-check', serverScope] as const;
  const updateQuery = useQuery({
    queryKey: updateQueryKey,
    queryFn: () => checkSystemUpdates(false),
    enabled: Boolean(config.baseUrl.trim() && config.adminApiKey.trim()),
    retry: false,
    staleTime: 15 * 60_000,
  });
  const forceUpdateCheck = useMutation({
    mutationFn: () => checkSystemUpdates(true),
    onSuccess: (data) => queryClient.setQueryData(updateQueryKey, data),
  });
  const { control, handleSubmit, formState, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      baseUrl: '',
      adminApiKey: '',
    },
  });

  async function verifyAndEnter(successMessage: string) {
    setConnectionState('checking');
    setConnectionMessage('正在检测当前服务是否可用...');

    try {
      queryClient.clear();
      await queryClient.fetchQuery({ queryKey: ['admin-settings'], queryFn: getAdminSettings });
      await queryClient.prefetchQuery({ queryKey: ['monitor-stats'], queryFn: getDashboardStats });
      setConnectionState('success');
      setConnectionMessage(successMessage);
      router.replace('/monitor');
    } catch (error) {
      setConnectionState('error');
      setConnectionMessage(getConnectionErrorMessage(error));
    }
  }

  async function handleAdd(values: FormValues) {
    await saveAdminConfig(values);
    reset({ baseUrl: '', adminApiKey: '' });
    setShowForm(false);
    await verifyAndEnter('服务器已添加并切换成功。');
  }

  async function handleSelect(account: AdminAccountProfile) {
    await switchAdminAccount(account.id);
    await verifyAndEnter(`已切换到 ${account.label}。`);
  }

  async function handleDelete(account: AdminAccountProfile) {
    await removeAdminAccount(account.id);
    queryClient.clear();
  }

  async function handleRefresh() {
    if (!config.baseUrl.trim()) {
      return;
    }

    setIsRefreshing(true);
    setConnectionState('idle');
    setConnectionMessage('');

    try {
      await Promise.all([
        queryClient.fetchQuery({ queryKey: ['admin-settings'], queryFn: getAdminSettings }),
        queryClient.prefetchQuery({ queryKey: ['monitor-stats'], queryFn: getDashboardStats }),
      ]);
    } catch (error) {
      setConnectionState('error');
      setConnectionMessage(getConnectionErrorMessage(error));
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 110, gap: 14 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void handleRefresh()} tintColor="#1d5f55" />}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 28, fontWeight: '700', color: colors.text }}>服务器</Text>
            <Text style={{ marginTop: 6, fontSize: 13, color: '#8a8072' }}>选择当前管理的服务器，或添加新的服务器。</Text>
          </View>
          <Pressable
            onPress={() => {
              setShowForm((value) => !value);
              setConnectionState('idle');
              setConnectionMessage('');
            }}
            style={{ backgroundColor: colors.primary, borderRadius: 999, width: 42, height: 42, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: '#fff', fontSize: 24, lineHeight: 24 }}>+</Text>
          </Pressable>
        </View>

        {config.baseUrl.trim() && config.adminApiKey.trim() ? (
          <View style={{ backgroundColor: colors.card, borderRadius: 8, borderWidth: 1, borderColor: colors.border, padding: 15, gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 38, height: 38, borderRadius: 8, backgroundColor: colors.successBg, alignItems: 'center', justifyContent: 'center' }}>
                <PackageCheck color={colors.primary} size={20} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: '800' }}>版本检查</Text>
                <Text style={{ color: colors.subtext, fontSize: 11, marginTop: 3 }}>只读检查，不会执行升级或重启</Text>
              </View>
            </View>

            {updateQuery.isLoading ? (
              <View style={{ minHeight: 54, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.primary} /></View>
            ) : updateQuery.data ? (
              <>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1, minWidth: 0, borderRadius: 8, backgroundColor: colors.mutedCard, padding: 11 }}>
                    <Text style={{ color: colors.subtext, fontSize: 10 }}>当前版本</Text>
                    <Text numberOfLines={1} style={{ color: colors.text, fontSize: 15, fontWeight: '800', marginTop: 5 }}>{formatVersion(updateQuery.data.current_version)}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0, borderRadius: 8, backgroundColor: updateQuery.data.has_update ? '#f7edcf' : colors.successBg, padding: 11 }}>
                    <Text style={{ color: colors.subtext, fontSize: 10 }}>最新版本</Text>
                    <Text numberOfLines={1} style={{ color: updateQuery.data.has_update ? '#8a641a' : colors.success, fontSize: 15, fontWeight: '800', marginTop: 5 }}>{formatVersion(updateQuery.data.latest_version)}</Text>
                  </View>
                </View>
                <Text style={{ color: updateQuery.data.has_update ? '#8a641a' : colors.success, fontSize: 12, fontWeight: '700' }}>
                  {updateQuery.data.has_update ? '检测到新版本，可查看发布说明后安排升级。' : '当前已是最新版本。'}
                </Text>
                <Text style={{ color: colors.subtext, fontSize: 11 }}>构建类型 {updateQuery.data.build_type || 'unknown'} · {updateQuery.data.cached ? '缓存结果' : '实时结果'}</Text>
                {updateQuery.data.warning ? <Text style={{ color: colors.danger, fontSize: 11, lineHeight: 17 }}>{updateQuery.data.warning}</Text> : null}
              </>
            ) : updateQuery.error ? (
              <Text style={{ color: isAdminApiError(updateQuery.error) && updateQuery.error.status === 404 ? colors.subtext : colors.danger, fontSize: 12, lineHeight: 18 }}>
                {isAdminApiError(updateQuery.error) && updateQuery.error.status === 404
                  ? '当前服务器版本不支持在线版本检查。'
                  : getAdminRequestErrorMessage(updateQuery.error, '版本检查失败。')}
              </Text>
            ) : null}

            {forceUpdateCheck.error ? <Text style={{ color: colors.danger, fontSize: 12 }}>{getAdminRequestErrorMessage(forceUpdateCheck.error, '刷新版本信息失败。')}</Text> : null}

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                disabled={forceUpdateCheck.isPending}
                onPress={() => forceUpdateCheck.mutate()}
                style={{ minHeight: 42, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 8, backgroundColor: colors.primary }}
              >
                {forceUpdateCheck.isPending ? <ActivityIndicator color="#fff" size="small" /> : <RefreshCw color="#fff" size={16} />}
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>{forceUpdateCheck.isPending ? '检查中' : '重新检查'}</Text>
              </Pressable>
              {updateQuery.data?.release_info?.html_url ? (
                <Pressable
                  onPress={() => void Linking.openURL(updateQuery.data!.release_info!.html_url)}
                  style={{ minHeight: 42, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 8, backgroundColor: colors.border }}
                >
                  <ExternalLink color="#514a42" size={16} />
                  <Text style={{ color: '#514a42', fontSize: 12, fontWeight: '800' }}>发布说明</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}

        {showForm ? (
          <View style={{ backgroundColor: colors.card, borderRadius: 18, padding: 16, gap: 14 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>添加服务器</Text>

            <View>
              <Text style={{ marginBottom: 8, fontSize: 12, color: colors.subtext }}>服务器地址</Text>
              <Controller
                control={control}
                name="baseUrl"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    placeholder="例如：https://api.example.com"
                    placeholderTextColor="#9b9081"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={{ backgroundColor: colors.mutedCard, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.text }}
                  />
                )}
              />
            </View>

            <View>
              <Text style={{ marginBottom: 8, fontSize: 12, color: colors.subtext }}>Admin Key</Text>
              <Controller
                control={control}
                name="adminApiKey"
                render={({ field: { onChange, value } }) => (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TextInput
                      value={value}
                      onChangeText={onChange}
                      placeholder="admin-xxxxxxxx"
                      placeholderTextColor="#9b9081"
                      autoCapitalize="none"
                      autoCorrect={false}
                      secureTextEntry={!showAdminKey}
                      style={{
                        flex: 1,
                        backgroundColor: colors.mutedCard,
                        borderRadius: 16,
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        fontSize: 16,
                        color: colors.text,
                      }}
                    />
                    <Pressable
                      onPress={() => setShowAdminKey((value) => !value)}
                      style={{ backgroundColor: colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#4e463e' }}>{showAdminKey ? '隐藏' : '显示'}</Text>
                    </Pressable>
                  </View>
                )}
              />
            </View>

            {formState.errors.baseUrl || formState.errors.adminApiKey ? (
              <View style={{ borderRadius: 14, backgroundColor: colors.dangerBg, paddingHorizontal: 14, paddingVertical: 12 }}>
                <Text style={{ color: colors.danger, fontSize: 14 }}>{formState.errors.baseUrl?.message || formState.errors.adminApiKey?.message}</Text>
              </View>
            ) : null}

            {connectionMessage ? (
              <View style={{ borderRadius: 14, backgroundColor: connectionState === 'success' ? colors.successBg : colors.dangerBg, paddingHorizontal: 14, paddingVertical: 12 }}>
                <Text style={{ color: connectionState === 'success' ? colors.success : colors.danger, fontSize: 14 }}>{connectionMessage}</Text>
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={handleSubmit(handleAdd)}
                disabled={connectionState === 'checking'}
                style={{ flex: 1, backgroundColor: connectionState === 'checking' ? '#7ca89f' : colors.primary, borderRadius: 16, paddingVertical: 14, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{connectionState === 'checking' ? '检测中...' : '保存并使用'}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowForm(false);
                  setConnectionState('idle');
                  setConnectionMessage('');
                  reset({ baseUrl: '', adminApiKey: '' });
                }}
                style={{ flex: 1, backgroundColor: colors.border, borderRadius: 16, paddingVertical: 14, alignItems: 'center' }}
              >
                <Text style={{ color: '#4e463e', fontSize: 14, fontWeight: '700' }}>取消</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={{ gap: 12 }}>
          {config.accounts.map((account: AdminAccountProfile) => (
            <ServerCard
              key={account.id}
              account={account}
              active={account.id === config.activeAccountId}
              onSelect={() => handleSelect(account)}
              onDelete={() => handleDelete(account)}
            />
          ))}

          {config.accounts.length === 0 ? (
            <View style={{ backgroundColor: colors.card, borderRadius: 18, padding: 18 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>还没有服务器</Text>
              <Text style={{ marginTop: 8, fontSize: 13, lineHeight: 21, color: colors.subtext }}>点击右上角 + 添加服务器，保存成功后会自动切换并进入概览。</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
