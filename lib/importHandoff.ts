import { ImportPreview } from './semesterImport';

const FLOW_KEY = 'coursetrack:import-flow:v1';
const DRAFT_KEY = 'coursetrack:import-flow-draft:v1';
export const IMPORT_FLOW_EVENT = 'coursetrack:import-flow-ready';

function storage() { return typeof window === 'undefined' ? null : window.localStorage; }

// This is intentionally a one-time handoff, not a saved import draft. It only
// exists while Android's file chooser forces the route away from /import.
export function beginImportHandoff() {
  try { storage()?.setItem(FLOW_KEY, String(Date.now())); } catch { /* Optional recovery only. */ }
}
export function importHandoffActive() {
  try {
    const startedAt = Number(storage()?.getItem(FLOW_KEY));
    if (!Number.isFinite(startedAt) || Date.now() - startedAt > 30_000) {
      cancelImportHandoff();
      return false;
    }
    return true;
  } catch { return false; }
}
export function completeImportHandoff(preview: ImportPreview) {
  try {
    storage()?.setItem(DRAFT_KEY, JSON.stringify(preview));
    window.dispatchEvent(new Event(IMPORT_FLOW_EVENT));
  } catch { /* The screen remains usable when storage is unavailable. */ }
}
export function takeImportHandoff(): ImportPreview | null {
  try {
    const raw = storage()?.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.courses) || !Array.isArray(parsed?.warnings)) return null;
    storage()?.removeItem(DRAFT_KEY);
    storage()?.removeItem(FLOW_KEY);
    return parsed as ImportPreview;
  } catch { return null; }
}
export function cancelImportHandoff() {
  try { storage()?.removeItem(FLOW_KEY); storage()?.removeItem(DRAFT_KEY); } catch { /* Optional recovery only. */ }
}
