import { useInfiniteQuery } from '@tanstack/react-query';
import { ChevronDown, FolderKanban, Layers3, Search } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';

import { ListCard } from '@/src/components/list-card';
import { ScreenShell } from '@/src/components/screen-shell';
import { useDebouncedValue } from '@/src/hooks/use-debounced-value';
import { listGroups } from '@/src/services/admin';
import { adminConfigState } from '@/src/store/admin-config';

const { useSnapshot } = require('valtio/react');

export default function GroupsScreen() {
  const config = useSnapshot(adminConfigState);
  const [searchText, setSearchText] = useState('');
  const keyword = useDebouncedValue(searchText.trim(), 300);
  const serverScope = `${config.baseUrl}|${config.activeAccountId}`;

  const groupsQuery = useInfiniteQuery({
    queryKey: ['groups', serverScope, keyword],
    queryFn: ({ pageParam }) => listGroups(keyword, pageParam, 20),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.page < lastPage.pages ? lastPage.page + 1 : undefined,
  });

  const items = useMemo(() => groupsQuery.data?.pages.flatMap((page) => page.items) ?? [], [groupsQuery.data]);
  const totalGroups = groupsQuery.data?.pages[0]?.total ?? items.length;
  const errorMessage = groupsQuery.error instanceof Error ? groupsQuery.error.message : '';
  const listHeader = useMemo(
    () => (
      <View className="pb-4">
        <View className="flex-row items-center rounded-[24px] bg-[#fbf8f2] px-4 py-3">
          <Search color="#7d7468" size={18} />
          <TextInput
            defaultValue=""
            onChangeText={setSearchText}
            placeholder="搜索分组名称"
            placeholderTextColor="#9b9081"
            className="ml-3 flex-1 text-base text-[#16181a]"
          />
        </View>
      </View>
    ),
    []
  );
  const renderItem = useCallback(
    ({ item: group }: { item: (typeof items)[number] }) => (
      <ListCard
        title={group.name}
        meta={`${group.platform} · 倍率 ${group.rate_multiplier ?? 1} · ${group.subscription_type || 'standard'}`}
        badge={group.status || 'active'}
        icon={FolderKanban}
      >
        <View className="flex-row items-center gap-2">
          <Layers3 color="#7d7468" size={14} />
          <Text className="text-sm text-[#7d7468]">
            账号数 {group.account_count ?? 0} · {group.is_exclusive ? '独占分组' : '共享分组'}
          </Text>
        </View>
      </ListCard>
    ),
    []
  );
  const emptyState = useMemo(
    () => <ListCard title="暂无分组" meta={errorMessage || '连上 Sub2API 后，这里会展示分组列表。'} icon={FolderKanban} />,
    [errorMessage]
  );

  return (
    <ScreenShell
      title="分组管理"
      subtitle=""
      titleAside={<Text className="text-[11px] text-[#a2988a]">已加载 {items.length} / {totalGroups}</Text>}
      variant="minimal"
      scroll={false}
    >
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => `${item.id}`}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={groupsQuery.isRefetching && !groupsQuery.isFetchingNextPage} onRefresh={() => void groupsQuery.refetch()} tintColor="#1d5f55" />}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={emptyState}
        ListFooterComponent={groupsQuery.hasNextPage ? (
          <Pressable
            disabled={groupsQuery.isFetchingNextPage}
            onPress={() => void groupsQuery.fetchNextPage()}
            className="h-14 flex-row items-center justify-center gap-2"
          >
            {groupsQuery.isFetchingNextPage ? <ActivityIndicator color="#1d5f55" size="small" /> : <ChevronDown color="#1d5f55" size={17} />}
            <Text className="text-xs font-bold text-[#1d5f55]">{groupsQuery.isFetchingNextPage ? '加载中' : '加载更多分组'}</Text>
          </Pressable>
        ) : null}
        ItemSeparatorComponent={() => <View className="h-4" />}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
      />
    </ScreenShell>
  );
}
