type DiagnosticEntry = { at: string; event: string; details?: string };
const KEY = 'coursetrack:client-diagnostics:v1';
const MAX_ENTRIES = 80;

export function recordDiagnostic(event: string, details?: string) {
  if (typeof window === 'undefined') return;
  try {
    const previous = readDiagnostics();
    const entry: DiagnosticEntry = { at: new Date().toISOString(), event, ...(details ? { details } : {}) };
    window.localStorage.setItem(KEY, JSON.stringify([...previous, entry].slice(-MAX_ENTRIES)));
  } catch { /* Diagnostics must never affect the app. */ }
}

export function readDiagnostics(): DiagnosticEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = JSON.parse(window.localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

export function clearDiagnostics() {
  try { window.localStorage.removeItem(KEY); } catch { /* Storage may be unavailable. */ }
}

export function diagnosticsText() {
  return readDiagnostics().map(({ at, event, details }) => `${at} | ${event}${details ? ` | ${details}` : ''}`).join('\n');
}
