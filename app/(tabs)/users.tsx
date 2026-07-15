import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ChevronDown } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useDebouncedValue } from '@/src/hooks/use-debounced-value';
import { queryClient } from '@/src/lib/query-client';
import { getBatchUsersUsage, getUser, listUserApiKeys, listUsers } from '@/src/services/admin';
import { adminConfigState, hasAuthenticatedAdminSession } from '@/src/store/admin-config';
import type { AdminUser, BatchUserUsageStats } from '@/src/types/admin';

const { useSnapshot } = require('valtio/react');

const colors = {
  page: '#f4efe4',
  card: '#fbf8f2',
  mutedCard: '#f1ece2',
  primary: '#1d5f55',
  text: '#16181a',
  subtext: '#6f665c',
  dangerBg: '#fbf1eb',
  danger: '#c25d35',
  accentBg: '#efe4cf',
  accentText: '#8c5a22',
};

type SortOrder = 'desc' | 'asc';

function formatCost(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '$0.00';
  return `$${value.toFixed(2)}`;
}

function formatActivityTime(value?: string) {
  if (!value) return '时间未知';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '时间未知';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
}

function toTimeValue(value?: string | null) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function getTimeValue(user: AdminUser) {
  return toTimeValue(user.last_used_at) || toTimeValue(user.updated_at) || toTimeValue(user.created_at) || user.id || 0;
}

function getUserNameLabel(user: AdminUser) {
  if (user.username?.trim()) return user.username.trim();
  if (user.notes?.trim()) return user.notes.trim();
  return user.email.split('@')[0] || '未命名';
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    switch (error.message) {
      case 'BASE_URL_REQUIRED':
        return '请先到服务器页填写服务地址。';
      case 'ADMIN_API_KEY_REQUIRED':
        return '请先到服务器页填写 Admin Token。';
      default:
        return error.message;
    }
  }

  return '当前无法加载页面数据，请检查服务地址、Token 和网络。';
}

function MetricTile({ title, value, tone = 'default' }: { title: string; value: string; tone?: 'default' | 'accent' }) {
  const backgroundColor = tone === 'accent' ? colors.accentBg : colors.mutedCard;
  const valueColor = tone === 'accent' ? colors.accentText : colors.text;

  return (
    <View style={{ flex: 1, minWidth: 0, backgroundColor, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 12 }}>
      <Text style={{ fontSize: 11, color: colors.subtext }}>{title}</Text>
      <Text numberOfLines={1} style={{ marginTop: 6, fontSize: 16, fontWeight: '800', color: valueColor }}>
        {value}
      </Text>
    </View>
  );
}

function UserCard({ user, usage }: { user: AdminUser; usage?: BatchUserUsageStats }) {
  const isAdmin = user.role?.trim().toLowerCase() === 'admin';
  const userNameLabel = getUserNameLabel(user);
  const statusLabel = `${isAdmin ? 'admin · ' : ''}${user.status || 'active'} · ${userNameLabel}`;
  const totalCost = Number(usage?.total_actual_cost ?? 0);
  const todayCost = Number(usage?.today_actual_cost ?? 0);
  const balance = Number(user.balance ?? 0);

  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 18, padding: 14 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>{user.email}</Text>
          <Text style={{ marginTop: 4, fontSize: 12, color: colors.subtext }}>最近使用 {formatActivityTime(user.last_used_at || user.updated_at || user.created_at)}</Text>
        </View>
        <View style={{ alignSelf: 'flex-start', backgroundColor: user.status === 'inactive' || user.status === 'disabled' ? '#cfc5b7' : colors.primary, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: '#fff' }}>{statusLabel}</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <MetricTile title="总消费" value={formatCost(totalCost)} tone="accent" />
        <MetricTile title="今日消费" value={formatCost(todayCost)} />
        <MetricTile title="余额" value={formatCost(balance)} />
      </View>
    </View>
  );
}

export default function UsersScreen() {
  const config = useSnapshot(adminConfigState);
  const hasAccount = hasAuthenticatedAdminSession(config);
  const [searchText, setSearchText] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const debouncedSearchText = useDebouncedValue(searchText, 250);
  const serverScope = `${config.baseUrl}|${config.activeAccountId}`;

  const usersQuery = useInfiniteQuery({
    queryKey: ['users', serverScope, debouncedSearchText],
    queryFn: ({ pageParam }) => listUsers(debouncedSearchText, pageParam, 20),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.page < lastPage.pages ? lastPage.page + 1 : undefined,
    enabled: hasAccount,
  });

  const users = useMemo(() => {
    const items = [...(usersQuery.data?.pages.flatMap((page) => page.items) ?? [])];
    items.sort((left, right) => {
      const value = getTimeValue(left) - getTimeValue(right);
      return sortOrder === 'desc' ? -value : value;
    });
    return items;
  }, [sortOrder, usersQuery.data]);

  const userIds = useMemo(() => users.map((user) => user.id), [users]);
  const usageQuery = useQuery({
    queryKey: ['batch-users-usage', serverScope, userIds],
    queryFn: () => getBatchUsersUsage(userIds),
    enabled: hasAccount && userIds.length > 0,
    staleTime: 60_000,
    retry: false,
  });

  const usageByUserId = useMemo(() => new Map(
    Object.entries(usageQuery.data?.stats ?? {}).map(([userId, usage]) => [Number(userId), usage] as const)
  ), [usageQuery.data?.stats]);

  const totalUsers = usersQuery.data?.pages[0]?.total ?? users.length;

  const errorMessage = getErrorMessage(usersQuery.error);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }}>
      <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 14 }}>
        <View style={{ marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 28, fontWeight: '700', color: colors.text }}>用户</Text>
            <Text style={{ marginTop: 4, fontSize: 12, color: '#8a8072' }}>已加载 {users.length} / {totalUsers}，点击用户进入详情。</Text>
          </View>
          <Pressable
            onPress={() => router.push('/users/create-user')}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 24, lineHeight: 24, fontWeight: '500' }}>+</Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <View style={{ flex: 1, backgroundColor: colors.card, borderRadius: 16, padding: 10 }}>
            <TextInput
              value={searchText}
              onChangeText={setSearchText}
              placeholder="搜索邮箱、用户名或备注"
              placeholderTextColor="#9b9081"
              style={{ backgroundColor: colors.mutedCard, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: colors.text }}
            />
          </View>
          <Pressable
            onPress={() => setSortOrder((value) => (value === 'desc' ? 'asc' : 'desc'))}
            style={{ backgroundColor: colors.card, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 14, minWidth: 92, alignItems: 'center' }}
          >
            <Text style={{ fontSize: 11, color: colors.subtext }}>时间</Text>
            <Text style={{ marginTop: 4, fontSize: 13, fontWeight: '700', color: colors.text }}>{sortOrder === 'desc' ? '倒序' : '正序'}</Text>
          </Pressable>
        </View>

        {!hasAccount ? (
          <View style={{ marginTop: 10, backgroundColor: colors.card, borderRadius: 18, padding: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>未连接服务器</Text>
            <Text style={{ marginTop: 8, fontSize: 14, lineHeight: 22, color: colors.subtext }}>请先到“服务器”页完成连接，再查看用户列表。</Text>
            <Pressable
              style={{ marginTop: 14, alignSelf: 'flex-start', backgroundColor: colors.primary, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12 }}
              onPress={() => router.push('/settings')}
            >
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>去配置服务器</Text>
            </Pressable>
          </View>
        ) : usersQuery.isLoading ? (
          <View style={{ marginTop: 10, backgroundColor: colors.card, borderRadius: 18, padding: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>正在加载用户</Text>
            <Text style={{ marginTop: 8, fontSize: 14, lineHeight: 22, color: colors.subtext }}>已连接服务器，正在拉取用户列表。</Text>
          </View>
        ) : usersQuery.error ? (
          <View style={{ marginTop: 10, backgroundColor: colors.card, borderRadius: 18, padding: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>加载失败</Text>
            <View style={{ marginTop: 12, borderRadius: 14, backgroundColor: colors.dangerBg, paddingHorizontal: 14, paddingVertical: 12 }}>
              <Text style={{ color: colors.danger, fontSize: 14, lineHeight: 20 }}>{errorMessage}</Text>
            </View>
          </View>
        ) : (
          <FlatList
            style={{ marginTop: 10, flex: 1 }}
            data={users}
            keyExtractor={(item) => `${item.id}`}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl
              refreshing={usersQuery.isRefetching && !usersQuery.isFetchingNextPage}
              onRefresh={() => {
                const requests: Promise<unknown>[] = [usersQuery.refetch()];
                if (userIds.length > 0) requests.push(usageQuery.refetch());
                void Promise.all(requests);
              }}
              tintColor="#1d5f55"
            />}
            contentContainerStyle={{ paddingBottom: 8, gap: 12, flexGrow: users.length === 0 ? 1 : 0 }}
            ListEmptyComponent={
              <View style={{ backgroundColor: colors.card, borderRadius: 18, padding: 16 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>暂无用户</Text>
                <Text style={{ marginTop: 8, fontSize: 14, lineHeight: 22, color: colors.subtext }}>当前搜索条件下没有匹配结果，可以修改关键词后重试。</Text>
              </View>
            }
            ListFooterComponent={usersQuery.hasNextPage ? (
              <Pressable
                disabled={usersQuery.isFetchingNextPage}
                onPress={() => void usersQuery.fetchNextPage()}
                style={{ height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }}
              >
                {usersQuery.isFetchingNextPage ? <ActivityIndicator color={colors.primary} size="small" /> : <ChevronDown color={colors.primary} size={17} />}
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '800' }}>{usersQuery.isFetchingNextPage ? '加载中' : '加载更多用户'}</Text>
              </Pressable>
            ) : null}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  void queryClient.prefetchQuery({ queryKey: ['user', item.id], queryFn: () => getUser(item.id) });
                  void queryClient.prefetchQuery({ queryKey: ['user-api-keys', item.id], queryFn: () => listUserApiKeys(item.id) });
                  router.push(`/users/${item.id}`);
                }}
              >
                <UserCard user={item} usage={usageByUserId.get(item.id)} />
              </Pressable>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
