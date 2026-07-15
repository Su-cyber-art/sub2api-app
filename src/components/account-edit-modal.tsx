import { Check, Save, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { AdminAccount, AdminGroup, UpdateAccountRequest } from '@/src/types/admin';

type AccountEditModalProps = {
  visible: boolean;
  account: AdminAccount | null;
  groups: AdminGroup[];
  groupsLoading?: boolean;
  saving?: boolean;
  serverError?: string;
  onClose: () => void;
  onSave: (body: UpdateAccountRequest) => void;
};

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
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad';
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
        style={{
          minHeight: multiline ? 74 : 44,
          borderRadius: 8,
          backgroundColor: '#f1ece2',
          paddingHorizontal: 12,
          paddingVertical: multiline ? 10 : 8,
          color: '#16181a',
          fontSize: 14,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
    </View>
  );
}

export function AccountEditModal({
  visible,
  account,
  groups,
  groupsLoading = false,
  saving = false,
  serverError = '',
  onClose,
  onSave,
}: AccountEditModalProps) {
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [concurrency, setConcurrency] = useState('1');
  const [priority, setPriority] = useState('1');
  const [rateMultiplier, setRateMultiplier] = useState('1');
  const [schedulable, setSchedulable] = useState(true);
  const [groupIds, setGroupIds] = useState<number[]>([]);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!visible || !account) return;
    setName(account.name || '');
    setNotes(account.notes || '');
    setConcurrency(String(account.concurrency ?? 1));
    setPriority(String(account.priority ?? 1));
    setRateMultiplier(String(account.rate_multiplier ?? 1));
    setSchedulable(account.schedulable !== false);
    setGroupIds(account.group_ids ?? account.groups?.map((group) => group.id) ?? []);
    setFormError('');
  }, [account, visible]);

  const availableGroups = useMemo(() => {
    if (!account) return [];
    return groups.filter((group) => group.platform === account.platform || groupIds.includes(group.id));
  }, [account, groupIds, groups]);

  function toggleGroup(groupId: number) {
    setGroupIds((current) => current.includes(groupId)
      ? current.filter((id) => id !== groupId)
      : [...current, groupId]);
  }

  function submit() {
    if (!account) return;
    const normalizedName = name.trim();
    const normalizedConcurrency = Number(concurrency);
    const normalizedPriority = Number(priority);
    const normalizedRateMultiplier = Number(rateMultiplier);

    if (!normalizedName) {
      setFormError('请输入账号名称。');
      return;
    }
    if (!Number.isInteger(normalizedConcurrency) || normalizedConcurrency < 1) {
      setFormError('并发数必须是大于或等于 1 的整数。');
      return;
    }
    if (!Number.isInteger(normalizedPriority) || normalizedPriority < 1) {
      setFormError('优先级必须是大于或等于 1 的整数。');
      return;
    }
    if (!Number.isFinite(normalizedRateMultiplier) || normalizedRateMultiplier < 0) {
      setFormError('计费倍率必须是大于或等于 0 的数字。');
      return;
    }

    setFormError('');
    onSave({
      name: normalizedName,
      notes: notes.trim() || null,
      concurrency: normalizedConcurrency,
      priority: normalizedPriority,
      rate_multiplier: normalizedRateMultiplier,
      schedulable,
      group_ids: groupIds,
    });
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(22,24,26,0.42)', padding: 14 }}
      >
        <View style={{ width: '100%', maxWidth: 580, maxHeight: '94%', alignSelf: 'center', overflow: 'hidden', borderRadius: 8, backgroundColor: '#fbf8f2' }}>
          <View style={{ minHeight: 58, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#e3dacb', paddingHorizontal: 15 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#16181a', fontSize: 17, fontWeight: '800' }}>编辑账号</Text>
              <Text style={{ color: '#71685d', fontSize: 10, marginTop: 3 }}>{account ? `${account.platform} · ${account.type}` : '基础调度与分组配置'}</Text>
            </View>
            <Pressable disabled={saving} onPress={onClose} accessibilityLabel="关闭账号编辑" style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}>
              <X color="#71685d" size={20} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 15, gap: 14 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Field label="账号名称" value={name} onChangeText={setName} placeholder="账号名称" />
            <Field label="备注（可选）" value={notes} onChangeText={setNotes} placeholder="记录用途或来源" multiline />

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}><Field label="并发数" value={concurrency} onChangeText={setConcurrency} keyboardType="number-pad" /></View>
              <View style={{ flex: 1 }}><Field label="优先级" value={priority} onChangeText={setPriority} keyboardType="number-pad" /></View>
              <View style={{ flex: 1 }}><Field label="计费倍率" value={rateMultiplier} onChangeText={setRateMultiplier} keyboardType="decimal-pad" /></View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 8, backgroundColor: '#f1ece2', padding: 12, gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#16181a', fontSize: 13, fontWeight: '800' }}>允许调度</Text>
                <Text style={{ color: '#71685d', fontSize: 10, marginTop: 3 }}>关闭后账号不会接收新的请求</Text>
              </View>
              <Switch value={schedulable} onValueChange={setSchedulable} trackColor={{ false: '#d2c8b8', true: '#8db9ae' }} thumbColor={schedulable ? '#1d5f55' : '#fbf8f2'} />
            </View>

            <View style={{ gap: 8 }}>
              <View>
                <Text style={{ color: '#71685d', fontSize: 11, fontWeight: '700' }}>所属分组</Text>
                <Text style={{ color: '#8b8174', fontSize: 10, marginTop: 3 }}>仅列出同平台分组；不会触碰账号凭据。</Text>
              </View>
              {groupsLoading ? <ActivityIndicator color="#1d5f55" size="small" /> : null}
              {!groupsLoading && availableGroups.length === 0 ? (
                <Text style={{ color: '#71685d', fontSize: 12 }}>当前没有可选的同平台分组。</Text>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                  {availableGroups.map((group) => {
                    const selected = groupIds.includes(group.id);
                    return (
                      <Pressable
                        key={group.id}
                        onPress={() => toggleGroup(group.id)}
                        style={{ minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 8, backgroundColor: selected ? '#1d5f55' : '#f1ece2', paddingHorizontal: 11 }}
                      >
                        {selected ? <Check color="#fff" size={14} /> : null}
                        <Text style={{ color: selected ? '#fff' : '#71685d', fontSize: 12, fontWeight: '800' }}>{group.name}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>

            {formError || serverError ? (
              <Text style={{ borderRadius: 8, backgroundColor: '#fbebe4', padding: 11, color: '#b45131', fontSize: 12, lineHeight: 18 }}>
                {formError || serverError}
              </Text>
            ) : null}
          </ScrollView>

          <View style={{ flexDirection: 'row', gap: 9, borderTopWidth: 1, borderTopColor: '#e3dacb', padding: 12 }}>
            <Pressable disabled={saving} onPress={onClose} style={{ minHeight: 44, width: 92, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#e3dacb' }}>
              <Text style={{ color: '#514a42', fontSize: 13, fontWeight: '800' }}>取消</Text>
            </Pressable>
            <Pressable disabled={saving} onPress={submit} style={{ minHeight: 44, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 8, backgroundColor: saving ? '#8bada6' : '#1d5f55' }}>
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Save color="#fff" size={16} />}
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>{saving ? '保存中' : '保存修改'}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
