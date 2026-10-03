import { useCallback, useSyncExternalStore } from "react";

// เก็บค่าตัวกรองไว้นอก component (และใน sessionStorage) เพื่อให้ค่าไม่หายตอน AppShell remount หน้า
// เมื่อสลับแรงก์ (key={rank}) และตอนรีเฟรชหน้าในแท็บเดิม
// ใช้กับค่าเดี่ยวที่ serialize เป็น JSON ได้ (string / null) เท่านั้น
const cache = new Map<string, unknown>();
const listeners = new Set<() => void>();

function read<T>(key: string, initial: T): T {
  if (cache.has(key)) return cache.get(key) as T;
  let value = initial;
  try {
    const raw = sessionStorage.getItem(key);
    if (raw !== null) value = JSON.parse(raw) as T;
  } catch {
    // storage ใช้ไม่ได้หรือค่าเสีย — ใช้ค่าเริ่มต้น
  }
  cache.set(key, value);
  return value;
}

function write(key: string, value: unknown) {
  cache.set(key, value);
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // เก็บไม่ได้ก็ไม่เป็นไร ยังจำค่าไว้ในหน่วยความจำระหว่างใช้งาน
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePersistedState<T>(key: string, initial: T): [T, (value: T) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key, initial),
    () => initial
  );
  const set = useCallback((v: T) => write(key, v), [key]);
  return [value, set];
}
