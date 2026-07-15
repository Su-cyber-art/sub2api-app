import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { iosColors } from '@/src/ui/ios/theme';
import { adminConfigState, hasAuthenticatedAdminSession } from '@/src/store/admin-config';

const { useSnapshot } = require('valtio/react');

export default function IOSTabsLayout() {
  const config = useSnapshot(adminConfigState);

  if (!hasAuthenticatedAdminSession(config)) {
    return <Redirect href="/login" />;
  }

  return (
    <NativeTabs
      blurEffect="systemChromeMaterial"
      disableTransparentOnScrollEdge={false}
      iconColor={{ default: iosColors.secondaryLabel, selected: iosColors.blue }}
      labelStyle={{ default: { color: iosColors.secondaryLabel }, selected: { color: iosColors.blue, fontWeight: '600' } }}
      minimizeBehavior="automatic"
      shadowColor={iosColors.separator}
      tintColor={iosColors.blue}
    >
      <NativeTabs.Trigger name="monitor">
        <NativeTabs.Trigger.Icon sf={{ default: 'chart.bar', selected: 'chart.bar.fill' }} />
        <NativeTabs.Trigger.Label>概览</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="users">
        <NativeTabs.Trigger.Icon sf={{ default: 'person.2', selected: 'person.2.fill' }} />
        <NativeTabs.Trigger.Label>用户</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon sf={{ default: 'externaldrive', selected: 'externaldrive.fill' }} />
        <NativeTabs.Trigger.Label>服务器</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="ops">
        <NativeTabs.Trigger.Icon sf={{ default: 'wrench.and.screwdriver', selected: 'wrench.and.screwdriver.fill' }} />
        <NativeTabs.Trigger.Label>运维</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger hidden name="index" />
      <NativeTabs.Trigger hidden name="groups" />
      <NativeTabs.Trigger hidden name="accounts" />
    </NativeTabs>
  );
}
