import { useInfiniteQuery, useMutation } from '@tanstack/react-query';
import {
  ChevronDown,
  FolderKanban,
  Layers3,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ListCard } from '@/src/components/list-card';
import { ScreenShell } from '@/src/components/screen-shell';
import { useDebouncedValue } from '@/src/hooks/use-debounced-value';
import { getAdminRequestErrorMessage } from '@/src/lib/admin-error-message';
import { queryClient } from '@/src/lib/query-client';
import { createGroup, deleteGroup, listGroups, updateGroup } from '@/src/services/admin';
import { adminConfigState } from '@/src/store/admin-config';
import type {
  AdminGroup,
  CreateGroupRequest,
  GroupPlatform,
  GroupStatus,
  GroupSubscriptionType,
  UpdateGroupRequest,
} from '@/src/types/admin';

const { useSnapshot } = require('valtio/react');

type GroupFormState = {
  name: string;
  description: string;
  platform: GroupPlatform;
  rateMultiplier: string;
  rpmLimit: string;
  subscriptionType: GroupSubscriptionType;
  dailyLimit: string;
  weeklyLimit: string;
  monthlyLimit: string;
  isExclusive: boolean;
  status: GroupStatus;
};

const platforms: GroupPlatform[] = ['anthropic', 'openai', 'gemini', 'antigravity', 'grok'];
const platformLabels: Record<GroupPlatform, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  gemini: 'Gemini',
  antigravity: 'Antigravity',
  grok: 'Grok',
};

const defaultForm: GroupFormState = {
  name: '',
  description: '',
  platform: 'anthropic',
  rateMultiplier: '1',
  rpmLimit: '0',
  subscriptionType: 'standard',
  dailyLimit: '',
  weeklyLimit: '',
  monthlyLimit: '',
  isExclusive: false,
  status: 'active',
};

function toFormState(group: AdminGroup): GroupFormState {
  return {
    name: group.name,
    description: group.description || '',
    platform: platforms.includes(group.platform as GroupPlatform) ? group.platform as GroupPlatform : 'anthropic',
    rateMultiplier: String(group.rate_multiplier ?? 1),
    rpmLimit: String(group.rpm_limit ?? 0),
    subscriptionType: group.subscription_type === 'subscription' ? 'subscription' : 'standard',
    dailyLimit: group.daily_limit_usd == null ? '' : String(group.daily_limit_usd),
    weeklyLimit: group.weekly_limit_usd == null ? '' : String(group.weekly_limit_usd),
    monthlyLimit: group.monthly_limit_usd == null ? '' : String(group.monthly_limit_usd),
    isExclusive: Boolean(group.is_exclusive),
    status: group.status === 'inactive' ? 'inactive' : 'active',
  };
}

function parseOptionalLimit(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : Number.NaN;
}

function getLimitSummary(group: AdminGroup) {
  const limits = [
    group.daily_limit_usd == null ? '' : `日 $${group.daily_limit_usd}`,
    group.weekly_limit_usd == null ? '' : `周 $${group.weekly_limit_usd}`,
    group.monthly_limit_usd == null ? '' : `月 $${group.monthly_limit_usd}`,
  ].filter(Boolean);
  return limits.length ? limits.join(' · ') : '未设置订阅额度';
}

async function confirmDelete(group: AdminGroup) {
  const message = group.account_count
    ? `“${group.name}”当前关联 ${group.account_count} 个账号，确认仍要删除？服务器可能会拒绝该操作。`
    : `确认删除分组“${group.name}”？此操作无法撤销。`;

  if (Platform.OS === 'web') {
    return typeof window !== 'undefined' ? window.confirm(message) : false;
  }

  return new Promise<boolean>((resolve) => {
    Alert.alert('删除分组', message, [
      { text: '取消', style: 'cancel', onPress: () => resolve(false) },
      { text: '删除', style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'decimal-pad' | 'number-pad';
  multiline?: boolean;
}) {
  return (
    <View style={{ gap: 7 }}>
      <Text style={{ color: '#71685d', fontSize: 11, fontWeight: '700' }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9b9081"
        keyboardType={keyboardType}
        multiline={multiline}
        autoCapitalize="none"
        autoCorrect={false}
        style={{ minHeight: multiline ? 76 : 44, borderRadius: 8, backgroundColor: '#f1ece2', paddingHorizontal: 12, paddingVertical: multiline ? 10 : 8, color: '#16181a', fontSize: 14, textAlignVertical: multiline ? 'top' : 'center' }}
      />
    </View>
  );
}

function ChoiceRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={{ gap: 7 }}>
      <Text style={{ color: '#71685d', fontSize: 11, fontWeight: '700' }}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              style={{ minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: selected ? '#1d5f55' : '#f1ece2', paddingHorizontal: 12 }}
            >
              <Text style={{ color: selected ? '#fff' : '#71685d', fontSize: 12, fontWeight: '800' }}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function GroupsScreen() {
  const config = useSnapshot(adminConfigState);
  const [searchText, setSearchText] = useState('');
  const [formVisible, setFormVisible] = useState(false);
  const [editingGroup, setEditingGroup] = useState<AdminGroup | null>(null);
  const [form, setForm] = useState<GroupFormState>(defaultForm);
  const [formError, setFormError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const keyword = useDebouncedValue(searchText.trim(), 300);
  const serverScope = `${config.baseUrl}|${config.activeAccountId}`;

  const groupsQuery = useInfiniteQuery({
    queryKey: ['groups', serverScope, keyword],
    queryFn: ({ pageParam }) => listGroups(keyword, pageParam, 20),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.page < lastPage.pages ? lastPage.page + 1 : undefined,
  });

  const saveMutation = useMutation({
    mutationFn: ({ groupId, body }: { groupId?: number; body: CreateGroupRequest | UpdateGroupRequest }) => (
      groupId ? updateGroup(groupId, body as UpdateGroupRequest) : createGroup(body as CreateGroupRequest)
    ),
    onSuccess: async (_, variables) => {
      setFormVisible(false);
      setEditingGroup(null);
      setActionMessage(variables.groupId ? '分组已更新。' : '分组已创建。');
      await queryClient.invalidateQueries({ queryKey: ['groups', serverScope] });
    },
    onError: (error) => setFormError(getAdminRequestErrorMessage(error, '保存分组失败，请检查填写内容。')),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteGroup,
    onSuccess: async () => {
      setActionMessage('分组已删除。');
      await queryClient.invalidateQueries({ queryKey: ['groups', serverScope] });
    },
    onError: (error) => setActionMessage(getAdminRequestErrorMessage(error, '删除分组失败。')),
  });

  const items = useMemo(() => groupsQuery.data?.pages.flatMap((page) => page.items) ?? [], [groupsQuery.data]);
  const totalGroups = groupsQuery.data?.pages[0]?.total ?? items.length;
  const errorMessage = groupsQuery.error ? getAdminRequestErrorMessage(groupsQuery.error, '分组列表加载失败。') : '';

  function updateForm<K extends keyof GroupFormState>(key: K, value: GroupFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function openCreate() {
    setEditingGroup(null);
    setForm({ ...defaultForm });
    setFormError('');
    setFormVisible(true);
  }

  function openEdit(group: AdminGroup) {
    setEditingGroup(group);
    setForm(toFormState(group));
    setFormError('');
    setFormVisible(true);
  }

  function closeForm() {
    if (saveMutation.isPending) return;
    setFormVisible(false);
    setEditingGroup(null);
    setFormError('');
  }

  function handleSave() {
    setFormError('');
    const name = form.name.trim();
    const rateMultiplier = Number(form.rateMultiplier);
    const rpmLimit = Number(form.rpmLimit || 0);
    const dailyLimit = parseOptionalLimit(form.dailyLimit);
    const weeklyLimit = parseOptionalLimit(form.weeklyLimit);
    const monthlyLimit = parseOptionalLimit(form.monthlyLimit);

    if (!name) {
      setFormError('请输入分组名称。');
      return;
    }
    if (!Number.isFinite(rateMultiplier) || rateMultiplier <= 0) {
      setFormError('倍率必须是大于 0 的数字。');
      return;
    }
    if (!Number.isInteger(rpmLimit) || rpmLimit < 0) {
      setFormError('RPM 限制必须是大于或等于 0 的整数。');
      return;
    }
    if ([dailyLimit, weeklyLimit, monthlyLimit].some((value) => Number.isNaN(value))) {
      setFormError('订阅额度必须是大于或等于 0 的数字，留空表示不限制。');
      return;
    }

    const body: CreateGroupRequest = {
      name,
      description: form.description.trim() || null,
      platform: form.platform,
      rate_multiplier: rateMultiplier,
      rpm_limit: rpmLimit,
      is_exclusive: form.isExclusive,
      subscription_type: form.subscriptionType,
      daily_limit_usd: dailyLimit,
      weekly_limit_usd: weeklyLimit,
      monthly_limit_usd: monthlyLimit,
    };

    saveMutation.mutate({
      groupId: editingGroup?.id,
      body: editingGroup ? { ...body, status: form.status } : body,
    });
  }

  async function handleDelete(group: AdminGroup) {
    setActionMessage('');
    if (await confirmDelete(group)) deleteMutation.mutate(group.id);
  }

  const listHeader = (
    <View style={{ gap: 10, paddingBottom: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 8, backgroundColor: '#fbf8f2', paddingHorizontal: 13, minHeight: 44 }}>
        <Search color="#7d7468" size={18} />
        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder="搜索分组名称"
          placeholderTextColor="#9b9081"
          autoCapitalize="none"
          autoCorrect={false}
          style={{ marginLeft: 10, flex: 1, color: '#16181a', fontSize: 14 }}
        />
      </View>
      {actionMessage ? (
        <Text style={{ borderRadius: 8, backgroundColor: actionMessage.includes('已') ? '#e6f4ee' : '#fbebe4', padding: 10, color: actionMessage.includes('已') ? '#1d5f55' : '#b45131', fontSize: 12 }}>
          {actionMessage}
        </Text>
      ) : null}
    </View>
  );

  return (
    <>
      <ScreenShell
        title="分组管理"
        subtitle="创建路由分组并管理基础配额"
        titleAside={<Text style={{ color: '#a2988a', fontSize: 11 }}>已加载 {items.length} / {totalGroups}</Text>}
        right={(
          <Pressable
            onPress={openCreate}
            accessibilityRole="button"
            accessibilityLabel="新建分组"
            style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#1d5f55' }}
          >
            <Plus color="#fff" size={19} />
          </Pressable>
        )}
        variant="minimal"
        scroll={false}
      >
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item: group }) => (
            <ListCard
              title={group.name}
              meta={`${group.platform} · 倍率 ${group.rate_multiplier ?? 1} · ${group.subscription_type || 'standard'}`}
              badge={group.status || 'active'}
              badgeTone={group.status === 'inactive' ? 'muted' : 'success'}
              icon={FolderKanban}
            >
              <View style={{ gap: 9 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <Layers3 color="#7d7468" size={14} />
                  <Text style={{ color: '#7d7468', fontSize: 12 }}>
                    账号数 {group.account_count ?? 0} · {group.is_exclusive ? '独占分组' : '共享分组'} · RPM {group.rpm_limit || '不限'}
                  </Text>
                </View>
                <Text style={{ color: '#7d7468', fontSize: 11 }}>{getLimitSummary(group)}</Text>
                {group.description ? <Text numberOfLines={2} style={{ color: '#514a42', fontSize: 12, lineHeight: 18 }}>{group.description}</Text> : null}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable
                    onPress={() => openEdit(group)}
                    accessibilityRole="button"
                    accessibilityLabel={`编辑分组 ${group.name}`}
                    style={{ minHeight: 40, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 8, backgroundColor: '#e6f4ee' }}
                  >
                    <Pencil color="#1d5f55" size={15} />
                    <Text style={{ color: '#1d5f55', fontSize: 12, fontWeight: '800' }}>编辑</Text>
                  </Pressable>
                  <Pressable
                    disabled={deleteMutation.isPending}
                    onPress={() => void handleDelete(group)}
                    accessibilityRole="button"
                    accessibilityLabel={`删除分组 ${group.name}`}
                    style={{ minHeight: 40, width: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#fbebe4' }}
                  >
                    {deleteMutation.isPending && deleteMutation.variables === group.id ? <ActivityIndicator color="#b45131" size="small" /> : <Trash2 color="#b45131" size={16} />}
                  </Pressable>
                </View>
              </View>
            </ListCard>
          )}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={groupsQuery.isRefetching && !groupsQuery.isFetchingNextPage} onRefresh={() => void groupsQuery.refetch()} tintColor="#1d5f55" />}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={<ListCard title="暂无分组" meta={errorMessage || '当前服务器还没有可用分组。'} icon={FolderKanban} />}
          ListFooterComponent={groupsQuery.hasNextPage ? (
            <Pressable disabled={groupsQuery.isFetchingNextPage} onPress={() => void groupsQuery.fetchNextPage()} style={{ height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
              {groupsQuery.isFetchingNextPage ? <ActivityIndicator color="#1d5f55" size="small" /> : <ChevronDown color="#1d5f55" size={17} />}
              <Text style={{ color: '#1d5f55', fontSize: 12, fontWeight: '800' }}>{groupsQuery.isFetchingNextPage ? '加载中' : '加载更多分组'}</Text>
            </Pressable>
          ) : <View style={{ height: 12 }} />}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={5}
        />
      </ScreenShell>

      <Modal visible={formVisible} transparent animationType="fade" onRequestClose={closeForm}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(22,24,26,0.42)', padding: 14 }}>
          <View style={{ width: '100%', maxWidth: 560, maxHeight: '94%', alignSelf: 'center', overflow: 'hidden', borderRadius: 8, backgroundColor: '#fbf8f2' }}>
            <View style={{ minHeight: 58, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#e3dacb', paddingHorizontal: 15 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#16181a', fontSize: 17, fontWeight: '800' }}>{editingGroup ? '编辑分组' : '新建分组'}</Text>
                <Text style={{ color: '#71685d', fontSize: 10, marginTop: 3 }}>基础路由、速率与订阅额度</Text>
              </View>
              <Pressable onPress={closeForm} accessibilityLabel="关闭" style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}>
                <X color="#71685d" size={20} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ padding: 15, gap: 14 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Field label="分组名称" value={form.name} onChangeText={(value) => updateForm('name', value)} placeholder="例如：Claude 生产组" />
              <Field label="说明（可选）" value={form.description} onChangeText={(value) => updateForm('description', value)} placeholder="记录用途或路由规则" multiline />
              <ChoiceRow
                label="平台"
                value={form.platform}
                onChange={(value) => updateForm('platform', value)}
                options={platforms.map((value) => ({ value, label: platformLabels[value] }))}
              />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}><Field label="计费倍率" value={form.rateMultiplier} onChangeText={(value) => updateForm('rateMultiplier', value)} keyboardType="decimal-pad" /></View>
                <View style={{ flex: 1 }}><Field label="RPM（0 为不限）" value={form.rpmLimit} onChangeText={(value) => updateForm('rpmLimit', value)} keyboardType="number-pad" /></View>
              </View>
              <ChoiceRow
                label="订阅类型"
                value={form.subscriptionType}
                onChange={(value) => updateForm('subscriptionType', value)}
                options={[{ value: 'standard', label: '标准计费' }, { value: 'subscription', label: '订阅额度' }]}
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}><Field label="每日额度 ($)" value={form.dailyLimit} onChangeText={(value) => updateForm('dailyLimit', value)} keyboardType="decimal-pad" placeholder="不限" /></View>
                <View style={{ flex: 1 }}><Field label="每周额度 ($)" value={form.weeklyLimit} onChangeText={(value) => updateForm('weeklyLimit', value)} keyboardType="decimal-pad" placeholder="不限" /></View>
                <View style={{ flex: 1 }}><Field label="每月额度 ($)" value={form.monthlyLimit} onChangeText={(value) => updateForm('monthlyLimit', value)} keyboardType="decimal-pad" placeholder="不限" /></View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 8, backgroundColor: '#f1ece2', padding: 12, gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#16181a', fontSize: 13, fontWeight: '800' }}>独占分组</Text>
                  <Text style={{ color: '#71685d', fontSize: 10, marginTop: 3 }}>只允许明确绑定该分组的请求使用</Text>
                </View>
                <Switch value={form.isExclusive} onValueChange={(value) => updateForm('isExclusive', value)} trackColor={{ false: '#d2c8b8', true: '#8db9ae' }} thumbColor={form.isExclusive ? '#1d5f55' : '#fbf8f2'} />
              </View>
              {editingGroup ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 8, backgroundColor: '#f1ece2', padding: 12, gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#16181a', fontSize: 13, fontWeight: '800' }}>启用分组</Text>
                    <Text style={{ color: '#71685d', fontSize: 10, marginTop: 3 }}>停用后该分组不再参与调度</Text>
                  </View>
                  <Switch value={form.status === 'active'} onValueChange={(value) => updateForm('status', value ? 'active' : 'inactive')} trackColor={{ false: '#d2c8b8', true: '#8db9ae' }} thumbColor={form.status === 'active' ? '#1d5f55' : '#fbf8f2'} />
                </View>
              ) : null}
              {formError ? <Text style={{ borderRadius: 8, backgroundColor: '#fbebe4', padding: 11, color: '#b45131', fontSize: 12, lineHeight: 18 }}>{formError}</Text> : null}
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 9, borderTopWidth: 1, borderTopColor: '#e3dacb', padding: 12 }}>
              <Pressable disabled={saveMutation.isPending} onPress={closeForm} style={{ minHeight: 44, width: 92, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#e3dacb' }}>
                <Text style={{ color: '#514a42', fontSize: 13, fontWeight: '800' }}>取消</Text>
              </Pressable>
              <Pressable disabled={saveMutation.isPending} onPress={handleSave} style={{ minHeight: 44, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 8, backgroundColor: saveMutation.isPending ? '#8bada6' : '#1d5f55' }}>
                {saveMutation.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Save color="#fff" size={16} />}
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>{saveMutation.isPending ? '保存中' : editingGroup ? '保存修改' : '创建分组'}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
