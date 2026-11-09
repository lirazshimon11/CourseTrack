import { ImportPreview } from './semesterImport';

const DRAFT_KEY = 'coursetrack:import-preview';
export const IMPORT_RECOVERY_KEY = 'coursetrack:import-recovery';

function storage() {
  // A mobile PWA may be restarted after its system file picker closes. Unlike
  // sessionStorage, localStorage survives that restart long enough to restore
  // the preview, and is cleared as soon as import completes or is discarded.
  return typeof window === 'undefined' ? null : window.localStorage;
}

export function saveImportDraft(preview: ImportPreview) {
  try {
    storage()?.setItem(DRAFT_KEY, JSON.stringify(preview));
    storage()?.setItem(IMPORT_RECOVERY_KEY, '1');
  } catch { /* A preview is optional; never block import. */ }
}

export function loadImportDraft(): ImportPreview | null {
  try {
    const raw = storage()?.getItem(DRAFT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return Array.isArray(data?.courses) && Array.isArray(data?.warnings) ? data as ImportPreview : null;
  } catch { return null; }
}

export function clearImportDraft() {
  try {
    storage()?.removeItem(DRAFT_KEY);
    storage()?.removeItem(IMPORT_RECOVERY_KEY);
  } catch { /* Storage may be unavailable in private browsing. */ }
}

export function clearImportRecovery() {
  try { storage()?.removeItem(IMPORT_RECOVERY_KEY); } catch { /* Storage may be unavailable in private browsing. */ }
}
