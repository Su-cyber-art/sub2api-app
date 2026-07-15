import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';

import { useDebouncedValue } from '@/src/hooks/use-debounced-value';
import { queryClient } from '@/src/lib/query-client';
import { getBatchUsersUsage, getUser, listUserApiKeys, listUsers } from '@/src/services/admin';
import { adminConfigState, hasAuthenticatedAdminSession } from '@/src/store/admin-config';
import type { AdminUser } from '@/src/types/admin';

const { useSnapshot } = require('valtio/react');

export type UserSortOrder = 'desc' | 'asc';

function toTimeValue(value?: string | null) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function getTimeValue(user: AdminUser) {
  return toTimeValue(user.last_used_at) || toTimeValue(user.updated_at) || toTimeValue(user.created_at) || user.id || 0;
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

export function useUsersList() {
  const config = useSnapshot(adminConfigState);
  const hasAccount = hasAuthenticatedAdminSession(config);
  const [searchText, setSearchText] = useState('');
  const [sortOrder, setSortOrder] = useState<UserSortOrder>('desc');
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

  function openUser(user: AdminUser) {
    void queryClient.prefetchQuery({ queryKey: ['user', user.id], queryFn: () => getUser(user.id) });
    void queryClient.prefetchQuery({ queryKey: ['user-api-keys', user.id], queryFn: () => listUserApiKeys(user.id) });
    router.push(`/users/${user.id}`);
  }

  return {
    hasAccount,
    searchText,
    setSearchText,
    sortOrder,
    setSortOrder,
    usersQuery,
    users,
    userIds,
    usageQuery,
    usageByUserId,
    totalUsers: usersQuery.data?.pages[0]?.total ?? users.length,
    errorMessage: getErrorMessage(usersQuery.error),
    openUser,
  };
}

export type UsersListState = ReturnType<typeof useUsersList>;
