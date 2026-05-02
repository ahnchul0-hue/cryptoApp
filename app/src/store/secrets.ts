import * as SecureStore from 'expo-secure-store';

const KEY_ANTHROPIC = 'anthropic_api_key';

export async function getAnthropicKey(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY_ANTHROPIC);
}

export async function setAnthropicKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(KEY_ANTHROPIC, key);
}

export async function clearAnthropicKey(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_ANTHROPIC);
}
