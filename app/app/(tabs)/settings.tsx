import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Alert } from 'react-native';
import { getAnthropicKey, setAnthropicKey, clearAnthropicKey } from '../../src/store/secrets';
import { loadSettings, saveSettings, type AppSettings } from '../../src/store/settings';

const MODELS = [
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6 (권장)' },
  { id: 'claude-opus-4-7', label: 'Opus 4.7 (최고 품질, 비쌈)' },
  { id: 'claude-haiku-4-5', label: 'Haiku 4.5 (저렴·빠름)' },
];

export default function Settings() {
  const [keyInput, setKeyInput] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    void getAnthropicKey().then((k) => setHasKey(!!k));
    void loadSettings().then(setSettings);
  }, []);

  async function saveKey() {
    if (!keyInput.startsWith('sk-')) {
      Alert.alert('형식 확인', 'Anthropic API 키는 보통 sk-ant-...로 시작해요.');
      return;
    }
    await setAnthropicKey(keyInput.trim());
    setKeyInput('');
    setHasKey(true);
    Alert.alert('저장됨', 'API 키가 안전하게 보관되었어요.');
  }

  async function removeKey() {
    await clearAnthropicKey();
    setHasKey(false);
  }

  async function pickModel(id: string) {
    if (!settings) return;
    const next = { ...settings, modelId: id };
    setSettings(next);
    await saveSettings(next);
  }

  async function setTone(strength: number) {
    if (!settings) return;
    const next = { ...settings, toneStrength: strength };
    setSettings(next);
    await saveSettings(next);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.section}>Anthropic API 키</Text>
      <Text style={styles.hint}>키는 폰의 SecureStore에만 저장돼요. 외부 서버로 절대 안 가요.</Text>
      {hasKey ? (
        <View style={styles.row}>
          <Text style={styles.statusOk}>✓ 등록됨</Text>
          <Pressable onPress={removeKey} style={styles.smallBtn}>
            <Text style={styles.smallBtnText}>삭제</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <TextInput
            style={styles.input}
            placeholder="sk-ant-..."
            value={keyInput}
            onChangeText={setKeyInput}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
          <Pressable onPress={saveKey} style={styles.btn}>
            <Text style={styles.btnText}>저장</Text>
          </Pressable>
        </>
      )}

      <Text style={styles.section}>모델</Text>
      {MODELS.map((m) => {
        const sel = settings?.modelId === m.id;
        return (
          <Pressable key={m.id} onPress={() => pickModel(m.id)} style={[styles.choice, sel && styles.choiceOn]}>
            <Text style={[styles.choiceText, sel && styles.choiceTextOn]}>{m.label}</Text>
          </Pressable>
        );
      })}

      <Text style={styles.section}>톤 강도</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[0, 1].map((s) => {
          const sel = settings?.toneStrength === s;
          return (
            <Pressable key={s} onPress={() => setTone(s)} style={[styles.choice, sel && styles.choiceOn, { flex: 1 }]}>
              <Text style={[styles.choiceText, sel && styles.choiceTextOn]}>
                {s === 0 ? '담백' : '초딩 비유'}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  section: { fontSize: 14, fontWeight: '700', color: '#111827', marginTop: 20, marginBottom: 8 },
  hint: { fontSize: 12, color: '#6b7280', marginBottom: 8 },
  input: { backgroundColor: '#fff', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 8 },
  btn: { backgroundColor: '#2563eb', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },
  smallBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#fee2e2' },
  smallBtnText: { color: '#dc2626', fontSize: 12, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', padding: 12, borderRadius: 10 },
  statusOk: { color: '#16a34a', fontWeight: '700' },
  choice: { backgroundColor: '#fff', padding: 12, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  choiceOn: { backgroundColor: '#dbeafe', borderColor: '#2563eb' },
  choiceText: { fontSize: 14, color: '#374151' },
  choiceTextOn: { color: '#1d4ed8', fontWeight: '700' },
});
