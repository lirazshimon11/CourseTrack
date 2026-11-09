import React, { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { recordDiagnostic } from '../lib/clientDiagnostics';

const LAST_ROUTE = 'coursetrack:last-route:v2';
const ROUTE_TTL_MS = 10 * 60 * 1000;

type SavedRoute = { path: string; savedAt: number };

function readSavedRoute(): string | null {
  try {
    const raw = window.localStorage.getItem(LAST_ROUTE);
    if (!raw) return null;
    const saved = JSON.parse(raw) as SavedRoute;
    if (typeof saved.path !== 'string' || !saved.path.startsWith('/') || Date.now() - saved.savedAt > ROUTE_TTL_MS) {
      window.localStorage.removeItem(LAST_ROUTE);
      return null;
    }
    return saved.path;
  } catch { return null; }
}

// Mobile browsers and desktop dev servers can recreate the web app after it
// returns from another window (including the system file picker). Preserve the
// active in-app route for that one return, rather than always opening '/'.
export function RouteRestorer() {
  const pathname = usePathname();
  const router = useRouter();
  const restored = useRef(false);
  const initialRoute = useRef<string | null>(null);

  if (initialRoute.current === null && typeof window !== 'undefined') initialRoute.current = readSavedRoute();

  useEffect(() => { recordDiagnostic('app-mounted', `path=${pathname}; saved=${initialRoute.current ?? 'none'}`); }, []);

  useEffect(() => {
    if (restored.current || pathname !== '/' || typeof window === 'undefined') return;
    try {
      const route = initialRoute.current;
      if (route && route !== '/') {
        recordDiagnostic('route-restore', `to=${route}`);
        restored.current = true;
        window.localStorage.removeItem(LAST_ROUTE);
        router.replace(route);
      }
    } catch { /* Route restoration is an optional browser enhancement. */ }
  }, [pathname, router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      recordDiagnostic('route-changed', pathname);
      window.localStorage.setItem(LAST_ROUTE, JSON.stringify({ path: pathname, savedAt: Date.now() } satisfies SavedRoute));
    } catch { /* Storage may be disabled in private browsing. */ }
  }, [pathname]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const visibility = () => recordDiagnostic('visibility', document.visibilityState);
    const pageHide = () => recordDiagnostic('pagehide');
    const pageShow = (event: PageTransitionEvent) => recordDiagnostic('pageshow', `persisted=${event.persisted}`);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', pageHide);
    window.addEventListener('pageshow', pageShow);
    return () => { document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pagehide', pageHide); window.removeEventListener('pageshow', pageShow); };
  }, []);

  return null;
}
