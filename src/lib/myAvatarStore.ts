import { useSyncExternalStore } from "react";

// The signed-in user's avatar URL, shared between the header and the profile page.
// null = no avatar (show the default icon). Kept in a tiny store so uploading/removing a photo
// on /profile updates the header immediately without a reload.
let current: string | null = null;
const listeners = new Set<() => void>();

export function setMyAvatar(url: string | null) {
  if (url === current) return;
  current = url;
  listeners.forEach((l) => l());
}

export function resetMyAvatar() {
  setMyAvatar(null);
}

function getSnapshot(): string | null {
  return current;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useMyAvatarState(): string | null {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
