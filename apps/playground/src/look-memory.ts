import {
  LookEngine,
  refreshCards,
  setCardDefaults,
  setChartDefaults,
  setLanguageOverride,
  setSliderDefaults,
  SettingsStore,
  type EffectiveSettings,
  type LookHandle,
  type SettingsHass,
} from '@fluvy/core';
import { setMotionPreference } from '@fluvy/ui';

/**
 * Fluvy's settings and look outside Home Assistant: the settings live in memory behind the same websocket messages
 * Home Assistant answers (`frontend/*_system_data`, `frontend/*_user_data`), and the live look engine applies them to
 * this page — what the panel does here is what it does at home. The playground mounts its panel on one; the demo
 * runs its whole page on one.
 */
export interface MemoryLook {
  readonly handle: LookHandle;
  /** The in-memory system and user data, as the settings store reads and writes them. */
  readonly storage: SettingsHass;
  /** Re-applies the look in the other mode (Home Assistant's dark mode flipped). */
  setDark(dark: boolean): void;
}

export function createMemoryLook(doc: Document, dark: boolean): MemoryLook {
  const data: Record<'system' | 'user', unknown> = { system: null, user: null };
  const subscribers: Record<'system' | 'user', Set<(message: { value: unknown }) => void>> = {
    system: new Set(),
    user: new Set(),
  };
  const layer = (type: string): 'system' | 'user' => (type.includes('system') ? 'system' : 'user');
  const storage: SettingsHass = {
    connection: {
      subscribeMessage: async <T>(callback: (message: T) => void, message: { type: string }) => {
        const key = layer(message.type);
        const listener = callback as (message: { value: unknown }) => void;
        subscribers[key].add(listener);
        setTimeout(() => listener({ value: data[key] }), 0);
        return () => subscribers[key].delete(listener);
      },
    },
    callWS: async <T>(message: { type: string; [key: string]: unknown }): Promise<T> => {
      const key = layer(message.type);
      data[key] = message['value'];
      for (const listener of subscribers[key]) listener({ value: data[key] });
      return undefined as T;
    },
  } as unknown as SettingsHass;

  const engine = new LookEngine(doc, () => new CSSStyleSheet(), undefined);
  const store = new SettingsStore(() => storage, undefined);
  const listeners = new Set<(settings: EffectiveSettings) => void>();
  let previewed: Parameters<LookHandle['preview']>[0] = null;
  let mode = dark;
  let wallDark: boolean | undefined;
  // as at home: the look on the page, and the language, motion, charts, surface and sliders the cards use
  const apply = (): void => {
    const now = previewed ? { ...store.effective, ...previewed } : store.effective;
    engine.apply(now, wallDark ?? mode);
    setLanguageOverride(now.language === 'auto' ? undefined : now.language);
    setMotionPreference(now.motion);
    setChartDefaults({ settings: now.charts, sets: now.chartSets });
    setCardDefaults(now.cards);
    setSliderDefaults(now.sliders);
    refreshCards();
  };
  const handle: LookHandle = {
    store,
    settings: () => store.effective,
    preview: (look) => {
      previewed = look;
      apply();
    },
    onChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setWall: (state) => {
      wallDark = state.dark;
      apply();
    },
    stop: () => store.stop(),
  };
  store.start((settings) => {
    apply();
    for (const listener of listeners) listener(settings);
  });
  return {
    handle,
    storage,
    setDark: (next) => {
      mode = next;
      apply();
    },
  };
}
