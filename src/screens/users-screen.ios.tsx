import {
  Button,
  Form,
  HStack,
  Host,
  Image,
  Picker,
  Section,
  Spacer,
  Text,
  TextField,
  VStack,
} from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  autocorrectionDisabled,
  buttonStyle,
  disabled,
  font,
  foregroundStyle,
  frame,
  keyboardType,
  lineLimit,
  listStyle,
  monospacedDigit,
  pickerStyle,
  refreshable,
  submitLabel,
  tag,
  textFieldStyle,
  textInputAutocapitalization,
} from '@expo/ui/swift-ui/modifiers';
import { router } from 'expo-router';

import { useUsersList, type UserSortOrder } from '@/src/features/users/use-users-list';
import { impactHaptic, selectionHaptic } from '@/src/ui/ios/haptics';
import {
  SwiftUIIconButton,
  SwiftUIPageTitle,
  SwiftUIStateView,
  SwiftUIStatus,
} from '@/src/ui/ios/swiftui-primitives';
import type { AdminUser, BatchUserUsageStats } from '@/src/types/admin';

const SORT_OPTIONS: ReadonlyArray<{ label: string; value: UserSortOrder }> = [
  { label: '最近使用', value: 'desc' },
  { label: '最早使用', value: 'asc' },
];

const SECONDARY = { type: 'hierarchical', style: 'secondary' } as const;
const TERTIARY = { type: 'hierarchical', style: 'tertiary' } as const;

function formatCost(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '$0.00';
  return `$${value.toFixed(2)}`;
}

function formatActivityTime(value?: string) {
  if (!value) return '暂无活动记录';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '暂无活动记录';

  const distance = Date.now() - date.getTime();
  const minutes = Math.floor(distance / 60_000);
  if (minutes < 1) return '刚刚使用';
  if (minutes < 60) return `${minutes} 分钟前使用`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前使用`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前使用`;
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日使用`;
}

function getDisplayName(user: AdminUser) {
  return user.username?.trim() || user.notes?.trim() || user.email.split('@')[0] || '未命名用户';
}

function NativeUserRow({ user, usage, onPress }: {
  user: AdminUser;
  usage?: BatchUserUsageStats;
  onPress: () => void;
}) {
  const isDisabled = user.status === 'inactive' || user.status === 'disabled';
  const isAdmin = user.role?.toLowerCase() === 'admin';
  const totalCost = Number(usage?.total_actual_cost ?? 0);
  const balance = Number(user.balance ?? 0);

  return (
    <Button
      onPress={onPress}
      modifiers={[
        buttonStyle('plain'),
        frame({ maxWidth: Infinity, alignment: 'leading' }),
        accessibilityLabel(`${user.email}，${isDisabled ? '已停用' : '正常'}，总消费 ${formatCost(totalCost)}`),
      ]}
    >
      <HStack spacing={11} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
        <Image
          color={isDisabled ? '#8E8E93' : '#007AFF'}
          size={34}
          systemName={isDisabled ? 'person.crop.circle.badge.xmark' : 'person.crop.circle.fill'}
        />
        <VStack alignment="leading" spacing={2} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
          <HStack spacing={6}>
            <Text modifiers={[font({ textStyle: 'body', weight: 'semibold' }), lineLimit(1)]}>{getDisplayName(user)}</Text>
            {isAdmin ? <Text modifiers={[font({ textStyle: 'caption2', weight: 'semibold' }), foregroundStyle('blue')]}>管理员</Text> : null}
          </HStack>
          <Text modifiers={[font({ textStyle: 'subheadline' }), foregroundStyle(SECONDARY), lineLimit(1)]}>{user.email}</Text>
          <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(TERTIARY), lineLimit(1)]}>
            {formatActivityTime(user.last_used_at || user.updated_at || user.created_at)}
          </Text>
        </VStack>
        <Spacer />
        <VStack alignment="trailing" spacing={2}>
          <Text modifiers={[font({ textStyle: 'body', weight: 'semibold' }), monospacedDigit()]}>{formatCost(totalCost)}</Text>
          <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(SECONDARY), monospacedDigit()]}>余额 {formatCost(balance)}</Text>
          <SwiftUIStatus label={isDisabled ? '已停用' : '正常'} tone={isDisabled ? 'neutral' : 'success'} />
        </VStack>
        <Image color="#C7C7CC" size={13} systemName="chevron.forward" />
      </HStack>
    </Button>
  );
}

export default function IOSUsersScreen() {
  const state = useUsersList();
  const {
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
    totalUsers,
    errorMessage,
    openUser,
  } = state;

  async function refresh(): Promise<void> {
    const requests: Promise<unknown>[] = [usersQuery.refetch()];
    if (userIds.length > 0) requests.push(usageQuery.refetch());
    await Promise.all(requests);
  }

  function openCreateUser() {
    impactHaptic();
    router.push('/users/create-user');
  }

  return (
    <Host seedColor="#007AFF" style={{ flex: 1 }} useViewportSizeMeasurement>
      <Form modifiers={[listStyle('insetGrouped'), refreshable(refresh)]}>
        <Section>
          <SwiftUIPageTitle
            action={<SwiftUIIconButton label="添加用户" systemImage="plus.circle.fill" onPress={openCreateUser} />}
            subtitle={`已加载 ${users.length} / ${totalUsers}`}
            title="用户"
          />
          <TextField
            onTextChange={setSearchText}
            placeholder="搜索邮箱、用户名或备注"
            modifiers={[
              textFieldStyle('roundedBorder'),
              keyboardType('web-search'),
              textInputAutocapitalization('never'),
              autocorrectionDisabled(),
              submitLabel('search'),
            ]}
          />
          <Picker
            label="排序"
            onSelectionChange={(value) => {
              selectionHaptic();
              setSortOrder(value);
            }}
            selection={sortOrder}
            modifiers={[pickerStyle('segmented')]}
          >
            {SORT_OPTIONS.map((option) => (
              <Text key={option.value} modifiers={[tag(option.value)]}>{option.label}</Text>
            ))}
          </Picker>
          {searchText ? <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(SECONDARY)]}>正在筛选“{searchText}”</Text> : null}
        </Section>

        {!hasAccount ? (
          <Section>
            <SwiftUIStateView
              action={<Button label="前往服务器设置" systemImage="server.rack" onPress={() => router.push('/settings')} modifiers={[buttonStyle('borderedProminent')]} />}
              message="连接服务器后即可浏览和管理用户。"
              systemImage="externaldrive.badge.questionmark"
              title="尚未连接服务器"
            />
          </Section>
        ) : usersQuery.isLoading ? (
          <Section>
            <SwiftUIStateView loading message="正在读取用户和用量数据。" title="载入中" />
          </Section>
        ) : usersQuery.error ? (
          <Section>
            <SwiftUIStateView
              action={<Button label="重试" systemImage="arrow.clockwise" onPress={() => void refresh()} modifiers={[buttonStyle('borderedProminent')]} />}
              message={errorMessage}
              systemImage="wifi.exclamationmark"
              title="无法载入用户"
              tone="error"
            />
          </Section>
        ) : users.length === 0 ? (
          <Section>
            <SwiftUIStateView message="尝试修改搜索关键词。" systemImage="person.crop.circle.badge.questionmark" title="没有匹配的用户" />
          </Section>
        ) : (
          <Section
            footer={usageQuery.error ? <Text>部分用量暂时无法载入，用户资料仍可正常管理。</Text> : undefined}
            title={`用户列表 (${users.length})`}
          >
            {users.map((user) => (
              <NativeUserRow
                key={user.id}
                onPress={() => {
                  impactHaptic();
                  openUser(user);
                }}
                usage={usageByUserId.get(user.id)}
                user={user}
              />
            ))}
            {usersQuery.hasNextPage ? (
              <Button
                label={usersQuery.isFetchingNextPage ? '正在载入' : '载入更多用户'}
                systemImage={usersQuery.isFetchingNextPage ? 'arrow.triangle.2.circlepath' : 'chevron.down'}
                onPress={() => void usersQuery.fetchNextPage()}
                modifiers={[buttonStyle('borderless'), disabled(usersQuery.isFetchingNextPage), frame({ maxWidth: Infinity, alignment: 'center' })]}
              />
            ) : null}
          </Section>
        )}
      </Form>
    </Host>
  );
}
