import { useMutation, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ExternalLink, LogOut, RefreshCw, ShieldCheck } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { getAdminRequestErrorMessage } from '@/src/lib/admin-error-message';
import { queryClient } from '@/src/lib/query-client';
import { acceptAdminCompliance, getAdminComplianceStatus } from '@/src/services/admin';
import { clearAdminCompliance, adminComplianceState } from '@/src/store/admin-compliance';
import { adminConfigState, logoutAdminAccount } from '@/src/store/admin-config';

const { useSnapshot } = require('valtio/react');

const DEFAULT_ACK_PHRASE = '我已阅读、理解并同意 Sub2API 部署与运营合规承诺';

export function AdminComplianceGate() {
  const compliance = useSnapshot(adminComplianceState);
  const config = useSnapshot(adminConfigState);
  const [phrase, setPhrase] = useState('');
  const visible = compliance.required && compliance.serverKey === config.baseUrl && Boolean(config.adminApiKey);

  const statusQuery = useQuery({
    queryKey: ['admin-compliance', config.baseUrl],
    queryFn: getAdminComplianceStatus,
    enabled: visible,
    retry: 1,
  });

  const requiredPhrase = statusQuery.data?.ack_phrase_zh || DEFAULT_ACK_PHRASE;
  const documentUrl = statusQuery.data?.document_url_zh || compliance.metadata?.document_url_zh;
  const version = statusQuery.data?.version || compliance.metadata?.version || '当前版本';
  const phraseMatches = phrase.trim() === requiredPhrase;

  const mutation = useMutation({
    mutationFn: () => acceptAdminCompliance(phrase.trim(), 'zh'),
    onSuccess: async () => {
      clearAdminCompliance();
      setPhrase('');
      await queryClient.invalidateQueries();
      router.replace('/monitor');
    },
  });

  useEffect(() => {
    setPhrase('');
  }, [compliance.serverKey, version]);

  useEffect(() => {
    if (visible && statusQuery.data && !statusQuery.data.required) {
      clearAdminCompliance();
      void queryClient.invalidateQueries();
    }
  }, [statusQuery.data, visible]);

  const errorMessage = useMemo(() => {
    const error = mutation.error || statusQuery.error;
    return error ? getAdminRequestErrorMessage(error, '无法读取或提交合规确认，请检查服务器后重试。') : '';
  }, [mutation.error, statusQuery.error]);

  async function handleLogout() {
    clearAdminCompliance();
    queryClient.clear();
    await logoutAdminAccount();
    router.replace('/login');
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => undefined}>
      <View style={{ flex: 1, backgroundColor: 'rgba(22, 24, 26, 0.58)', justifyContent: 'center', padding: 18 }}>
        <View
          style={{
            alignSelf: 'center',
            width: '100%',
            maxWidth: 620,
            maxHeight: '90%',
            backgroundColor: '#fbf8f2',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          <ScrollView contentContainerStyle={{ padding: 22, gap: 16 }} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 42, height: 42, borderRadius: 8, backgroundColor: '#e6f4ee', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldCheck color="#1d5f55" size={23} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#16181a', fontSize: 20, fontWeight: '800' }}>管理员合规确认</Text>
                <Text style={{ color: '#746b60', fontSize: 12, marginTop: 4 }}>承诺版本 {version}</Text>
              </View>
            </View>

            <Text style={{ color: '#514a42', fontSize: 14, lineHeight: 22 }}>
              继续使用管理接口前，请阅读并确认部署与运营合规承诺。此确认由服务器强制要求，完成后才会恢复管理功能。
            </Text>

            {documentUrl ? (
              <Pressable
                accessibilityRole="link"
                onPress={() => void Linking.openURL(documentUrl)}
                style={{ minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#d8cfbf', borderRadius: 8 }}
              >
                <ExternalLink color="#1d5f55" size={17} />
                <Text style={{ color: '#1d5f55', fontSize: 14, fontWeight: '700' }}>查看完整合规承诺</Text>
              </Pressable>
            ) : null}

            {statusQuery.isLoading ? (
              <View style={{ minHeight: 96, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color="#1d5f55" />
              </View>
            ) : (
              <>
                <View style={{ backgroundColor: '#f1ece2', borderRadius: 8, padding: 14 }}>
                  <Text style={{ color: '#756c61', fontSize: 11, marginBottom: 8 }}>请完整输入以下确认语句</Text>
                  <Text selectable style={{ color: '#292622', fontSize: 14, lineHeight: 22, fontWeight: '700' }}>{requiredPhrase}</Text>
                </View>
                <TextInput
                  value={phrase}
                  onChangeText={setPhrase}
                  placeholder="在此输入确认语句"
                  placeholderTextColor="#9b9081"
                  multiline
                  autoCorrect={false}
                  style={{ minHeight: 86, borderWidth: 1, borderColor: phrase && !phraseMatches ? '#c25d35' : '#d8cfbf', borderRadius: 8, padding: 13, color: '#16181a', fontSize: 14, lineHeight: 21, textAlignVertical: 'top' }}
                />
              </>
            )}

            {errorMessage ? (
              <View style={{ backgroundColor: '#fbf1eb', borderRadius: 8, padding: 12, gap: 10 }}>
                <Text style={{ color: '#b54f2c', fontSize: 13, lineHeight: 19 }}>{errorMessage}</Text>
                <Pressable onPress={() => void statusQuery.refetch()} style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <RefreshCw color="#b54f2c" size={15} />
                  <Text style={{ color: '#b54f2c', fontWeight: '700', fontSize: 13 }}>重试</Text>
                </Pressable>
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={() => void handleLogout()}
                style={{ minHeight: 46, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 8, backgroundColor: '#e7dfcf' }}
              >
                <LogOut color="#514a42" size={17} />
                <Text style={{ color: '#514a42', fontWeight: '700' }}>退出</Text>
              </Pressable>
              <Pressable
                disabled={!phraseMatches || mutation.isPending || statusQuery.isLoading}
                onPress={() => mutation.mutate()}
                style={{ minHeight: 46, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: phraseMatches && !mutation.isPending ? '#1d5f55' : '#a9b6ae' }}
              >
                {mutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>确认并继续</Text>}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
