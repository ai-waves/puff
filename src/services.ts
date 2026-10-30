import { audio } from './audio/audio';
import { emptySave, type SaveData, type Settings } from './game/progress';
import { buzz, type Buzz } from './platform/haptics';
import { writeSave } from './platform/storage';

// App-wide state shared by the scenes: saved progress, settings, sound and haptics.
class Services {
  save: SaveData = emptySave();

  setSave(next: SaveData): void {
    this.save = next;
    void writeSave(next);
  }

  setSetting(key: keyof Settings, value: boolean): void {
    this.setSave({ ...this.save, settings: { ...this.save.settings, [key]: value } });
    this.applySettings();
  }

  applySettings(): void {
    audio.setMusic(this.save.settings.music);
    audio.setSound(this.save.settings.sound);
  }

  buzz(kind: Buzz): void {
    if (this.save.settings.haptics) buzz(kind);
  }
}

export const services = new Services();
