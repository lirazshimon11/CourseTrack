import { fetchHit } from './hit-tls.mjs';
import { fetch as publicFetch } from 'undici';
import { publicAgent } from './public-network.mjs';

const fetchInstitution = (url, options) => ['hit.ac.il','www.hit.ac.il'].includes(new URL(url).hostname)
  ? fetchHit(url,options) : publicFetch(url,{...options,dispatcher:publicAgent});

// Only a supported public institutional host can be fetched. Redirects are checked too.
export function assertSourceUrl(value) {
  const u = new URL(value);
  if (u.protocol !== 'https:' || !/^(?:[a-z0-9-]+\.)+ac\.il$/.test(u.hostname) || u.port || u.username || u.password)
    throw new Error('יש להזין קישור HTTPS לאתר מוסד אקדמי בדומיין ac.il.');
  return u;
}

export async function fetchDocument(url, maxBytes = 6_000_000, fetcher = fetchInstitution) {
  for (let redirect = 0; redirect <= 3; redirect++) {
    assertSourceUrl(url);
    const response = await fetcher(url, { redirect: 'manual', signal: AbortSignal.timeout(12000), headers: { 'User-Agent': 'CourseTrackCalendar/1.0', Accept: 'text/html,application/pdf' } });
    if ([301,302,303,307,308].includes(response.status)) {
      await response.body?.cancel();
      if (!response.headers.get('location')) throw new Error('הפניה ללא כתובת');
      url = new URL(response.headers.get('location'), url).href; continue;
    }
    if (!response.ok) { await response.body?.cancel(); throw new Error(`מקור הלוח החזיר HTTP ${response.status}`); }
    if (Number(response.headers.get('content-length')) > maxBytes) { await response.body?.cancel(); throw new Error('קובץ המקור גדול מדי'); }
    const chunks = []; let size = 0;
    if (!response.body) throw new Error('תשובה ריקה מהמקור');
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > maxBytes) throw new Error('קובץ המקור גדול מדי');
      chunks.push(chunk);
    }
    return { bytes: Buffer.concat(chunks), contentType: response.headers.get('content-type') ?? '', url };
  }
  throw new Error('יותר מדי הפניות במקור');
}

export async function extractPdf(bytes) {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, useSystemFonts: true, disableFontFace: true });
  try {
    const doc = await task.promise;
    if (doc.numPages > 20) throw new Error('הלוח מכיל יותר מדי עמודים');
    const lines = [];
    for (let n=1;n<=doc.numPages;n++) {
      const page = await doc.getPage(n), content = await page.getTextContent();
      const items = content.items.filter(x => 'str' in x && x.str.trim()).sort((a,b) => b.transform[5]-a.transform[5]);
      const rows = [];
      for (const item of items) {
        const y = item.transform[5];
        const row = rows.at(-1);
        if (row && Math.abs(row.y-y)<5) row.items.push(item);
        else rows.push({ y, items:[item] });
      }
      for (const row of rows) lines.push(row.items.sort((a,b) => b.transform[4]-a.transform[4]).map(i=>i.str).join(' '));
      page.cleanup();
    }
    return lines.join('\n');
  } finally { await task.destroy(); }
}
