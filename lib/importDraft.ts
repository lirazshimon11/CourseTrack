import { ImportPreview } from './semesterImport';

const DRAFT_KEY = 'coursetrack:import-preview';

function storage() {
  return typeof window === 'undefined' ? null : window.sessionStorage;
}

export function saveImportDraft(preview: ImportPreview) {
  try { storage()?.setItem(DRAFT_KEY, JSON.stringify(preview)); } catch { /* A preview is optional; never block import. */ }
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
  try { storage()?.removeItem(DRAFT_KEY); } catch { /* Storage may be unavailable in private browsing. */ }
}
