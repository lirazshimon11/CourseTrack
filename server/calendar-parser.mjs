import { load } from 'cheerio';
import { createHash } from 'node:crypto';

const normalize = s => s.normalize('NFKC').replace(/[\u200e\u200f\u202a-\u202e]/g, '').replace(/[״“”]/g, '"').replace(/[׳‘’]/g, "'").replace(/\s+/g, ' ').trim();
const letters = { א:1,ב:2,ג:3,ד:4,ה:5,ו:6,ז:7,ח:8,ט:9,י:10,כ:20,ל:30,מ:40,נ:50,ס:60,ע:70,פ:80,צ:90,ק:100,ר:200,ש:300,ת:400 };
const keys = ['semester_a_start','semester_a_end','semester_b_start','semester_b_end','semester_c_start','semester_c_end'];

export function parseDate(value) {
  const m = value.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/);
  if (!m) throw new Error(`Unsupported date: ${value}`);
  let [, d, month, y] = m.map(Number); if (y < 100) y += 2000;
  const date = new Date(Date.UTC(y, month - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== d) throw new Error('Invalid calendar date');
  return date.toISOString().slice(0,10);
}

export function extractHtml(html, baseUrl) {
  const $ = load(html);
  const pdfLinks = [];
  const printLinks = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    const isPrint = /גרסה להדפסה/.test([$(el).text(),$(el).attr('title'),$(el).attr('aria-label')].join(' '));
    if (/\.pdf(?:[?#]|$)/i.test(href ?? '') || isPrint) {
      try { const url=new URL(href, baseUrl).href; pdfLinks.push(url); if(isPrint) printLinks.push(url); } catch { /* Ignore invalid links. */ }
    }
  });
  $('script, style, nav, header, footer, noscript').remove();
  // HIT keeps previous years in a dropdown and next year's first day among the
  // events. Only the selected heading identifies the calendar being published.
  const selectedYear = normalize($('main .top .year_cal').first().text());
  const sections = $('main .lists .sem');
  if (selectedYear && sections.length) {
    const lines = [`לוח השנה האקדמית ${selectedYear}`];
    sections.each((_, section) => {
      const semester = normalize($(section).children('h2').first().text());
      lines.push(semester);
      $(section).find('.events > .line').each((_, row) => {
        const title = normalize($(row).children('.title').find('span').first().text());
        const dates = normalize($(row).children('.dates').text());
        const info = normalize($(row).children('.info').text());
        const boundary = title.match(/^היום (הראשון|האחרון) (?:ללימודים|לסמסטר(?:\s+(?:[אבג]['"]?|קיץ))?)$/);
        lines.push(boundary
          ? `${boundary[1] === 'הראשון' ? 'תחילת' : 'סיום'} ${semester} ${dates}`
          : `${title} ${dates} ${info}`);
      });
    });
    return { text: lines.join('\n'), pdfLinks: [...new Set(pdfLinks)], printLinks: [...new Set(printLinks)] };
  }
  const root = $('main').length ? $('main').first() : $('body');
  root.find('br').replaceWith('\n');
  // Preserve row boundaries; concatenate individual table cells on the same line.
  root.find('tr, h1, h2, h3, h4, p, li').each((_, el) => { $(el).prepend('\n'); $(el).append('\n'); });
  root.find('td, th').each((_, el) => $(el).append(' '));
  return { text: root.text(), pdfLinks: [...new Set(pdfLinks)], printLinks: [...new Set(printLinks)] };
}

export function parseCalendar(text) {
  const lines = text.split(/\r?\n/).map(normalize).filter(Boolean);
  const headingLines = lines.filter(l => /^(?:שנת הלימודים|שנה אקדמית|השנה האקדמית|לוח אקדמי|לוח השנה|לוח שנה|שנה"ל)/.test(l));
  const years = new Set();
  for (const heading of headingLines) {
    const hebrew = heading.match(/תש[א-ת"']{1,5}/g) ?? [];
    for (const token of hebrew) {
      const year = 5000 + [...token].reduce((n,c) => n + (letters[c] ?? 0), 0) - 3761;
      if (year >= 2000 && year <= 2200) years.add(year);
    }
    for (const m of heading.matchAll(/\b(20\d{2})\s*[-–/]\s*(20\d{2})\b/g)) {
      if (Math.abs(Number(m[1]) - Number(m[2])) === 1) years.add(Math.min(Number(m[1]), Number(m[2])));
    }
  }
  if (years.size !== 1) throw new Error('לא זוהתה שנה אקדמית יחידה בכותרת. נדרשת בדיקת מקור.');
  const start_year = [...years][0];
  const result = { start_year, label: `${start_year}-${start_year + 1}`, ...Object.fromEntries(keys.map(k => [k,null])), excluded_dates: [], notes: '' };
  const warnings = [];
  const datesIn = line => [...line.matchAll(/(?<!\d)\d{1,2}[./-]\d{1,2}[./-](?:20\d{2}|\d{2})(?!\d)/g)].map(m => parseDate(m[0]));
  let context = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const semester = line.match(/סמסטר\s*(?:ה)?(קיץ|[אבג])(?:['"]|\s|$)/);
    if (semester) context = ({ א:'a', ב:'b', ג:'c', קיץ:'c' })[semester[1]];
    const dates = datesIn(line);
    const start = /^(?:(?:תחילת|פתיחת)\s+(?:סמסטר|הלימודים)|יום ראשון ללימודים)/.test(line);
    const end = /^(?:(?:סיום|תום)\s+(?:סמסטר|הלימודים)|יום אחרון ללימודים)/.test(line);
    const exams = /בחינ/.test(line);
    if ((start || end) && !exams && context && /סמסטר|לימודים/.test(line)) {
      const adjacent = dates.length ? dates : datesIn(lines[i+1] ?? '');
      if (adjacent.length !== 1 || (start && end)) throw new Error('תאריך תחילת/סיום סמסטר אינו חד משמעי');
      const key = `semester_${context}_${start ? 'start' : 'end'}`;
      if (result[key] && result[key] !== adjacent[0]) throw new Error('נמצאו תאריכים סותרים לאותו סמסטר');
      result[key] = adjacent[0];
    }
    if (/^חופשת\s|(?:^|\s)חופשה(?:\s|$)|לא יתקיימו לימודים|אין לימודים|הפסק[הת] לימודים|הפסקות לימודים|יום שבתון|לימודים מסתיימים|הלימודים מסתיימים/.test(line)) {
      if (/שעה|\d{1,2}:\d{2}|מתכונת|השלמ|למעט|בחלק/.test(line) || dates.length < 1 || dates.length > 2) {
        warnings.push(`חריג דורש בדיקה: ${line}`); continue;
      }
      const from = new Date(dates[0]+'T12:00:00Z'), to = new Date((dates[1] ?? dates[0])+'T12:00:00Z');
      const days = (to-from)/86400000;
      if (days < 0 || days > 35) { warnings.push(`טווח חופשה דורש בדיקה: ${line}`); continue; }
      for (let day = 0; day <= days; day++) result.excluded_dates.push(new Date(+from + day*86400000).toISOString().slice(0,10));
    }
    if (/מתכונת|השלמ[הת]|הוראה של יום|הלימודים יתקיימו בזום/.test(line)) warnings.push(`שינוי מערכת דורש בדיקה: ${line}`);
  }
  for (const semester of ['a','b','c']) {
    const start = result[`semester_${semester}_start`], end = result[`semester_${semester}_end`];
    if (!start && !end && semester === 'c') { warnings.push('לא נמצאו תאריכי סמסטר קיץ'); continue; }
    if (!start || !end || start > end) throw new Error('חסרים תאריכי סמסטר מלאים ותקינים');
    const duration = (new Date(end) - new Date(start))/86400000;
    if (duration < 28 || duration > 190 || start < `${start_year}-08-01` || end > `${start_year+1}-12-31`) throw new Error('תאריכי הסמסטר מחוץ לטווח הצפוי');
  }
  if (result.semester_b_start <= result.semester_a_end || (result.semester_c_start && result.semester_c_start <= result.semester_b_end)) throw new Error('סמסטרים חופפים');
  result.excluded_dates = [...new Set(result.excluded_dates)].sort();
  if (result.excluded_dates.some(d => d < `${start_year}-08-01` || d > `${start_year+1}-12-31`)) throw new Error('חופשה מחוץ לשנת הלימודים');
  result.notes = lines.filter(l => /חופש|לימודים|בחינ|סמסטר|מתכונת|שבתון|השלמ|זום/.test(l)).join('\n').slice(0,16000);
  return { calendar: result, warnings: [...new Set(warnings)] };
}

export function sourceHash(text) { return createHash('sha256').update(normalize(text)).digest('hex'); }

export function publicationDecision(existing, source, warnings) {
  if (existing?.origin === 'manual') return 'unchanged';
  if(warnings.some(w=>!/^(חריג דורש בדיקה:|שינוי מערכת דורש בדיקה:)/.test(w)))
    throw new Error('החילוץ לא הושלם בצורה תקינה. הלוח הקודם נשמר.');
  return 'published';
}
