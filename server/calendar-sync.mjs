import { extractHtml, parseCalendar, publicationDecision, sourceHash } from './calendar-parser.mjs';
import { extractPdf, fetchDocument } from './calendar-fetch.mjs';

function check(result) { if (result.error) throw new Error(result.error.message); return result.data; }

export async function readSource(source, fetcher = fetchDocument, pdfExtractor = extractPdf) {
  if (source.adapter !== 'hit-v1') throw new Error('מתאם המקור אינו נתמך');
  const document = await fetcher(source.page_url);
  if (document.contentType.includes('application/pdf')) throw new Error('יש להגדיר עמוד לוח קבוע, לא כתובת PDF שנתית');
  const html = extractHtml(document.bytes.toString('utf8'), document.url);
  try { return { ...parseCalendar(html.text), source_url: document.url, source_hash: sourceHash(html.text) }; }
  catch (htmlError) {
    // Only follow links actually present in the source. Ambiguous years need review.
    const pdfs = html.printLinks.length ? html.printLinks : html.pdfLinks.filter(x => /\.pdf(?:[?#]|$)/i.test(x));
    if (pdfs.length !== 1) throw new Error(`${htmlError.message}; לא נמצא קישור PDF יחיד לגיבוי`);
    const pdf = await fetcher(pdfs[0]);
    if (pdf.bytes.subarray(0,5).toString() !== '%PDF-') throw new Error('קישור ההדפסה לא החזיר PDF');
    const text = await pdfExtractor(pdf.bytes);
    return { ...parseCalendar(text), source_url: pdf.url, source_hash: sourceHash(text) };
  }
}

export async function syncSource(db, source, reader = readSource) {
  const claimed = check(await db.rpc('claim_calendar_source', { p_source_id: source.id }));
  if (!claimed) return { status: 'skipped', message: 'המקור מושבת או מתעדכן כרגע' };
  let success = false;
  try {
    const institution = check(await db.from('institutions').select('slug').eq('id',source.institution_id).single());
    if (institution.slug !== 'hit') throw new Error('מתאם HIT אינו מתאים למוסד שבמקור הזה');
    const parsed = await reader(source);
    const candidate = { ...parsed.calendar, institution_id: source.institution_id, source_url: parsed.source_url, source_hash: parsed.source_hash, origin: 'sync' };
    const existing = check(await db.from('institution_calendars').select('*').eq('institution_id', source.institution_id).eq('start_year', candidate.start_year).maybeSingle());
    const decision=publicationDecision(existing,source,parsed.warnings);
    const alreadySeen = existing?.source_hash === candidate.source_hash;
    let status = alreadySeen ? 'unchanged' : decision;
    if (status === 'published') {
      if(existing){
        // Compare-and-swap prevents overwriting an administrator edit made during fetch.
        const updated=check(await db.from('institution_calendars').update(candidate).eq('id',existing.id).eq('revision',existing.revision).eq('origin','sync').select('id'));
        if(!updated.length)throw new Error('הלוח נערך במקביל. השינויים נשמרו; נסו לסנכרן שוב.');
      }else check(await db.from('institution_calendars').insert(candidate));
    }
    if(status==='published'||(alreadySeen&&existing?.origin==='sync')){
      check(await db.from('calendar_sync_runs').update({status:'dismissed',message:'הצעה ישנה שהוחלפה בשליפה אוטומטית עדכנית.'}).eq('source_id',source.id).eq('status','review').eq('candidate->>start_year',String(candidate.start_year)));
    }
    const message = existing?.origin==='manual' ? 'הלוח נערך ידנית בידי מנהל ולכן נשמר ללא החלפה.' : status==='unchanged' ? 'לא נמצא שינוי חדש' : 'הלוח נשמר והופץ אוטומטית.' + (parsed.warnings.length?'\nהערות המקור נשמרו בלוח:\n'+parsed.warnings.join('\n').slice(0,6000):'');
    check(await db.from('calendar_sync_runs').insert({ source_id:source.id, status, message, candidate: status === 'unchanged' ? null : candidate }));
    success = true;
    return { status, message };
  } catch (error) {
    const message = error.cause?.code ? `לא ניתן לגשת למקור (${error.cause.code}). הלוח הקודם נשמר.` : String(error.message ?? error).slice(0,2000);
    check(await db.from('calendar_sync_runs').insert({ source_id:source.id, status:'failed', message }));
    return { status:'failed', message };
  } finally {
    check(await db.from('calendar_sources').update({ lease_until:null, last_checked_at:new Date().toISOString(), ...(success ? {last_success_at:new Date().toISOString()} : {}) }).eq('id',source.id));
    // Retain pending reviews, discard old routine logs to keep storage bounded.
    const cutoff = new Date(Date.now()-90*86400000).toISOString();
    check(await db.from('calendar_sync_runs').delete().eq('source_id',source.id).in('status',['failed','unchanged']).lt('created_at',cutoff));
  }
}
