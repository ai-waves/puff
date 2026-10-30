import { Preferences } from '@capacitor/preferences';
import { emptySave, type SaveData } from '../game/progress';

// Progress lives in Capacitor Preferences (UserDefaults on iOS), which iOS won't evict like web storage.
const KEY = 'hollowdrift.save';

export async function loadSave(): Promise<SaveData> {
  try {
    const { value } = await Preferences.get({ key: KEY });
    if (!value) return emptySave();
    const data = JSON.parse(value) as SaveData;
    if (data.version !== 1) return emptySave();
    return { ...emptySave(), ...data, settings: { ...emptySave().settings, ...data.settings } };
  } catch {
    return emptySave();
  }
}

export async function writeSave(save: SaveData): Promise<void> {
  try {
    await Preferences.set({ key: KEY, value: JSON.stringify(save) });
  } catch {
    // Progress is best effort; the game keeps running without it.
  }
}
