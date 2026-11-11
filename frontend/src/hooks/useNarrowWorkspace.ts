import { useSyncExternalStore } from 'react';

const query = '(max-width: 900px)';
const snapshot = () => typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
function subscribe(notify: () => void) {
  if (typeof window.matchMedia !== 'function') return () => {};
  const media = window.matchMedia(query);
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
}
/** Keep visual, DOM and keyboard order aligned when urgent work moves above results. */
export function useNarrowWorkspace() {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
