import { getSetting, setSetting } from './db';

export interface AppSettings {
  modelId: string;
  toneStrength: number;
  enabledClasses: ('crypto' | 'us' | 'kr')[];
}

const DEFAULT_SETTINGS: AppSettings = {
  modelId: 'claude-sonnet-4-6',
  toneStrength: 1,
  enabledClasses: ['crypto', 'us', 'kr'],
};

export async function loadSettings(): Promise<AppSettings> {
  const raw = await getSetting('app_settings');
  if (!raw) return DEFAULT_SETTINGS;
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await setSetting('app_settings', JSON.stringify(settings));
}
