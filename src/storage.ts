import { STORAGE_KEYS } from './config';

/** localStorage が使えない環境（プライベートモード等）でも落ちないようにする */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStore(): KeyValueStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadHighScore(store: KeyValueStore | null = defaultStore()): number {
  try {
    const n = Number(store?.getItem(STORAGE_KEYS.highScore) ?? 0);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

/** ハイスコアを更新したら保存して true を返す */
export function saveHighScore(score: number, store: KeyValueStore | null = defaultStore()): boolean {
  if (score <= loadHighScore(store)) return false;
  try {
    store?.setItem(STORAGE_KEYS.highScore, String(Math.floor(score)));
  } catch {
    // 保存できなくても表示上は更新扱いにする
  }
  return true;
}

export function loadMuted(store: KeyValueStore | null = defaultStore()): boolean {
  try {
    return store?.getItem(STORAGE_KEYS.muted) === '1';
  } catch {
    return false;
  }
}

export function saveMuted(muted: boolean, store: KeyValueStore | null = defaultStore()): void {
  try {
    store?.setItem(STORAGE_KEYS.muted, muted ? '1' : '0');
  } catch {
    // 無視
  }
}
