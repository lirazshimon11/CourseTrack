import React, { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'expo-router';

const LAST_ROUTE = 'coursetrack:last-route';
const RESTORE_ARMED = 'coursetrack:restore-route';

// Mobile browsers and desktop dev servers can recreate the web app after it
// returns from another window (including the system file picker). Preserve the
// active in-app route for that one return, rather than always opening '/'.
export function RouteRestorer() {
  const pathname = usePathname();
  const router = useRouter();
  const restored = useRef(false);

  useEffect(() => {
    if (restored.current || pathname !== '/' || typeof window === 'undefined') return;
    try {
      const armed = window.sessionStorage.getItem(RESTORE_ARMED) === '1';
      const route = window.sessionStorage.getItem(LAST_ROUTE);
      if (armed && route && route !== '/') {
        restored.current = true;
        window.sessionStorage.removeItem(RESTORE_ARMED);
        router.replace(route);
      }
    } catch { /* Route restoration is an optional browser enhancement. */ }
  }, [pathname, router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const preserve = () => {
      try {
        window.sessionStorage.setItem(LAST_ROUTE, pathname);
        window.sessionStorage.setItem(RESTORE_ARMED, '1');
      } catch { /* Storage may be disabled in private browsing. */ }
    };
    const onVisibilityChange = () => { if (document.visibilityState === 'hidden') preserve(); };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', preserve);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', preserve);
    };
  }, [pathname]);

  return null;
}
