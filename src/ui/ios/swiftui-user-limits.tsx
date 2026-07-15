import {
  Button,
  ConfirmationDialog,
  DisclosureGroup,
  HStack,
  Image,
  LabeledContent,
  ProgressView,
  Section,
  Spacer,
  Text,
  Toggle,
  VStack,
} from '@expo/ui/swift-ui';
import {
  buttonStyle,
  disabled,
  font,
  foregroundStyle,
  frame,
  monospacedDigit,
} from '@expo/ui/swift-ui/modifiers';

import {
  USER_QUOTA_WINDOW_LABELS,
  useUserLimits,
  type UserQuotaDraft,
} from '@/src/features/users/use-user-limits';
import { getAdminRequestErrorMessage } from '@/src/lib/admin-error-message';
import { impactHaptic, warningHaptic } from '@/src/ui/ios/haptics';
import { SwiftUIBoundTextField } from '@/src/ui/ios/swiftui-primitives';
import type { AdminUser, UserPlatformQuotaPlatform, UserPlatformQuotaWindow } from '@/src/types/admin';

const SECONDARY = { type: 'hierarchical', style: 'secondary' } as const;

const PLATFORM_LABELS: Record<UserPlatformQuotaPlatform, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  gemini: 'Gemini',
  antigravity: 'Antigravity',
  grok: 'Grok',
};

function FeedbackText({ feedback }: { feedback: { message: string; tone: 'success' | 'error' } }) {
  return (
    <Text modifiers={[font({ textStyle: 'footnote' }), foregroundStyle(feedback.tone === 'success' ? 'green' : 'red')]}>
      {feedback.message}
    </Text>
  );
}

function QuotaDisclosure({
  row,
  updateQuotaRow,
  resetQuota,
  resetPending,
}: {
  row: UserQuotaDraft;
  updateQuotaRow: (platform: UserPlatformQuotaPlatform, window: UserPlatformQuotaWindow, value: string) => void;
  resetQuota: (platform: UserPlatformQuotaPlatform, window: UserPlatformQuotaWindow) => void;
  resetPending: boolean;
}) {
  const usage = `$${row.dailyUsage.toFixed(2)} / $${row.weeklyUsage.toFixed(2)} / $${row.monthlyUsage.toFixed(2)}`;

  return (
    <DisclosureGroup>
      <DisclosureGroup.Label>
        <VStack alignment="leading" spacing={2} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
          <Text modifiers={[font({ textStyle: 'body', weight: 'semibold' })]}>{PLATFORM_LABELS[row.platform]}</Text>
          <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(SECONDARY), monospacedDigit()]}>{usage}</Text>
        </VStack>
      </DisclosureGroup.Label>

      <LabeledContent label="每日额度">
        <SwiftUIBoundTextField
          keyboard="decimal-pad"
          onTextChange={(value) => updateQuotaRow(row.platform, 'daily', value)}
          placeholder="不限"
          value={row.daily}
        />
      </LabeledContent>
      <LabeledContent label="每周额度">
        <SwiftUIBoundTextField
          keyboard="decimal-pad"
          onTextChange={(value) => updateQuotaRow(row.platform, 'weekly', value)}
          placeholder="不限"
          value={row.weekly}
        />
      </LabeledContent>
      <LabeledContent label="每月额度">
        <SwiftUIBoundTextField
          keyboard="decimal-pad"
          onTextChange={(value) => updateQuotaRow(row.platform, 'monthly', value)}
          placeholder="不限"
          value={row.monthly}
        />
      </LabeledContent>

      <ConfirmationDialog title={`重置 ${PLATFORM_LABELS[row.platform]} 用量`}>
        <ConfirmationDialog.Trigger>
          <Button
            label="重置用量"
            role="destructive"
            systemImage="arrow.counterclockwise"
            modifiers={[buttonStyle('bordered'), disabled(resetPending)]}
          />
        </ConfirmationDialog.Trigger>
        <ConfirmationDialog.Message>
          <Text>只清零所选周期的已用金额，不会改变额度限制。</Text>
        </ConfirmationDialog.Message>
        <ConfirmationDialog.Actions>
          {(['daily', 'weekly', 'monthly'] as const).map((window) => (
            <Button
              key={window}
              label={`重置${USER_QUOTA_WINDOW_LABELS[window]}用量`}
              role="destructive"
              onPress={() => {
                warningHaptic();
                resetQuota(row.platform, window);
              }}
            />
          ))}
          <Button label="取消" role="cancel" />
        </ConfirmationDialog.Actions>
      </ConfirmationDialog>
    </DisclosureGroup>
  );
}

export function SwiftUIUserLimitsSections({ user }: { user: AdminUser }) {
  const state = useUserLimits(user);
  const {
    concurrency,
    setConcurrency,
    rpmLimit,
    setRpmLimit,
    restrictGroups,
    setRestrictGroups,
    allowedGroupIds,
    limitsFeedback,
    quotaRows,
    quotaFeedback,
    groupsQuery,
    quotasQuery,
    limitsMutation,
    quotasMutation,
    resetMutation,
    toggleAllowedGroup,
    updateQuotaRow,
    saveLimits,
    saveQuotas,
    resetQuota,
  } = state;

  return (
    <>
      <Section
        footer={<Text>0 RPM 表示不限；关闭分组限制时可访问所有非独占分组。</Text>}
        title="访问与并发"
      >
        <LabeledContent label="并发数">
          <SwiftUIBoundTextField keyboard="numeric" onTextChange={setConcurrency} placeholder="1" value={concurrency} />
        </LabeledContent>
        <LabeledContent label="RPM">
          <SwiftUIBoundTextField keyboard="numeric" onTextChange={setRpmLimit} placeholder="0" value={rpmLimit} />
        </LabeledContent>
        <Toggle
          isOn={restrictGroups}
          label="限制允许分组"
          onIsOnChange={setRestrictGroups}
          systemImage="person.2.badge.gearshape"
        />

        {restrictGroups && groupsQuery.isLoading ? <ProgressView><Text>正在载入分组</Text></ProgressView> : null}
        {restrictGroups && groupsQuery.error ? (
          <Text modifiers={[foregroundStyle('red')]}>
            {getAdminRequestErrorMessage(groupsQuery.error, '分组列表加载失败。')}
          </Text>
        ) : null}
        {restrictGroups ? (groupsQuery.data?.items ?? []).map((group) => {
          const selected = allowedGroupIds.includes(group.id);
          return (
            <Button
              key={group.id}
              onPress={() => toggleAllowedGroup(group.id)}
              modifiers={[buttonStyle('plain'), frame({ maxWidth: Infinity, alignment: 'leading' })]}
            >
              <HStack modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
                <Text>{group.name}</Text>
                <Spacer />
                {selected ? <Image color="#007AFF" size={16} systemName="checkmark.circle.fill" /> : <Image color="#C7C7CC" size={16} systemName="circle" />}
              </HStack>
            </Button>
          );
        }) : null}
        {limitsFeedback ? <FeedbackText feedback={limitsFeedback} /> : null}
        <Button
          label={limitsMutation.isPending ? '正在保存' : '保存访问限制'}
          systemImage="checkmark.circle"
          onPress={() => {
            impactHaptic();
            saveLimits();
          }}
          modifiers={[
            buttonStyle('borderedProminent'),
            disabled(limitsMutation.isPending || (restrictGroups && groupsQuery.isLoading)),
            frame({ maxWidth: Infinity, alignment: 'center' }),
          ]}
        />
      </Section>

      <Section
        footer={<Text>分别控制各平台的日、周、月美元额度；留空表示不限。展开平台可编辑或重置用量。</Text>}
        title="平台额度"
      >
        {quotasQuery.isLoading ? <ProgressView><Text>正在载入平台额度</Text></ProgressView> : null}
        {quotasQuery.error ? (
          <VStack alignment="leading" spacing={8} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
            <Text modifiers={[foregroundStyle('red')]}>
              {getAdminRequestErrorMessage(quotasQuery.error, '平台额度加载失败。')}
            </Text>
            <Button label="重试" systemImage="arrow.clockwise" onPress={() => void quotasQuery.refetch()} modifiers={[buttonStyle('bordered')]} />
          </VStack>
        ) : null}
        {!quotasQuery.isLoading && !quotasQuery.error ? quotaRows.map((row) => (
          <QuotaDisclosure
            key={row.platform}
            resetPending={resetMutation.isPending}
            resetQuota={resetQuota}
            row={row}
            updateQuotaRow={updateQuotaRow}
          />
        )) : null}
        {quotaFeedback ? <FeedbackText feedback={quotaFeedback} /> : null}
        {!quotasQuery.isLoading && !quotasQuery.error ? (
          <Button
            label={quotasMutation.isPending ? '正在保存' : '保存平台额度'}
            systemImage="checkmark.circle"
            onPress={() => {
              impactHaptic();
              saveQuotas();
            }}
            modifiers={[
              buttonStyle('borderedProminent'),
              disabled(quotasMutation.isPending || resetMutation.isPending),
              frame({ maxWidth: Infinity, alignment: 'center' }),
            ]}
          />
        ) : null}
      </Section>
    </>
  );
}
