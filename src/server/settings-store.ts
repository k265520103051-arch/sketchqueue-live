import { readFileSync, writeFileSync } from 'node:fs';
import { DEFAULT_SETTINGS, sanitizeSettings, type Settings } from '../core/settings';

/** File không có, không đọc được, không phải JSON → DEFAULT_SETTINGS; còn lại qua sanitizeSettings. */
export function loadSettings(path: string): Settings {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
  try {
    return sanitizeSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Ghi JSON thụt 2 khoảng; lỗi ghi thì nuốt và console.warn. */
export function saveSettings(path: string, s: Settings): void {
  try {
    writeFileSync(path, JSON.stringify(s, null, 2) + '\n', 'utf8');
  } catch (err) {
    console.warn(`Không lưu được cài đặt vào ${path}:`, err instanceof Error ? err.message : err);
  }
}
