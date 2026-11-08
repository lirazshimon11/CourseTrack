import { Course, SlotData } from '../types';

export const WEEKDAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];
export const TIMETABLE_FIELDS = {
  type: 'סוג המפגש', times: 'שעות המפגש', lecturer: 'שם המרצה',
  room: 'חדר', code: 'מספר הקורס', credits: 'נקודות זכות',
};
export type TimetableOptions = Record<keyof typeof TIMETABLE_FIELDS, boolean>;
export const DEFAULT_TIMETABLE_OPTIONS: TimetableOptions = { type: true, times: true, lecturer: true, room: true, code: true, credits: true };
export const TIMETABLE_RATIO = 1.15;
export const MIN_TIMETABLE_TEXT_SIZE = 16;
export const MAX_TIMETABLE_TEXT_SIZE = 72;
export const DEFAULT_TIMETABLE_TEXT_SIZE = 32;
export const TIMETABLE_DETAIL_RATIO = 0.85;
export const TIMETABLE_HEADINGS = { title: 'כותרת ראשית — מערכת השעות שלי', subtitle: 'כותרת משנה — שנת הלימודים והסמסטר' };
export type TimetableHeadings = Record<keyof typeof TIMETABLE_HEADINGS, boolean>;
export const DEFAULT_TIMETABLE_HEADINGS: TimetableHeadings = { title: true, subtitle: true };
export function entryDetails(e: TimetableEntry, options: TimetableOptions): string[] {
  const details = [];
  const meeting = [options.type ? (e.slot.type === 'exercise' ? 'תרגול' : 'הרצאה') : '', options.times ? `\u2066${e.slot.start_time.slice(0,5)}–${e.slot.end_time.slice(0,5)}\u2069` : ''].filter(Boolean);
  if (meeting.length) details.push(meeting.join(' · '));
  if (options.lecturer && e.slot.lecturer) details.push(e.slot.lecturer);
  if (options.room && e.slot.room) details.push(`חדר ${e.slot.room}`);
  const identifiers = [options.code ? (e.slot.code || e.course.course_code || '') : '', options.credits && e.course.credits != null ? `${e.course.credits} נ״ז` : ''].filter(Boolean);
  if (identifiers.length) details.push(identifiers.join(' · '));
  return details;
}
export const normalizeSemester = (semester: string) => semester === 'קיץ' ? 'ג' : semester;
export function minutes(value: string): number {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value);
  if (!match) return NaN;
  const h = Number(match[1]), m = Number(match[2]);
  return h <= 23 && m <= 59 ? h * 60 + m : NaN;
}
export type TimetableEntry = { course: Course; slot: SlotData; start: number; end: number; lane: number; lanes: number };
export function buildTimetable(courses: Course[]) {
  const entries: TimetableEntry[] = [];
  let omitted = 0;
  for (const course of courses) {
    if (!course.slots_data?.length) omitted++;
    for (const slot of course.slots_data ?? []) {
      const start = minutes(slot.start_time), end = minutes(slot.end_time);
      if (!['lecture', 'exercise'].includes(slot.type) || !Number.isInteger(slot.day_of_week) || slot.day_of_week < 0 || slot.day_of_week > 5 || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) { omitted++; continue; }
      entries.push({ course, slot, start, end, lane: 0, lanes: 1 });
    }
  }
  for (let day = 0; day < 6; day++) {
    const sorted = entries.filter(e => e.slot.day_of_week === day).sort((a,b) => a.start - b.start || b.end - a.end);
    let group: TimetableEntry[] = [], ends: number[] = [], groupEnd = -1;
    const finish = () => group.forEach(e => { e.lanes = ends.length; });
    for (const entry of sorted) {
      if (entry.start >= groupEnd) { finish(); group = []; ends = []; }
      let lane = ends.findIndex(end => end <= entry.start);
      if (lane < 0) lane = ends.length;
      ends[lane] = entry.end; entry.lane = lane; group.push(entry);
      groupEnd = Math.max(...ends);
    }
    finish();
  }
  return { entries, omitted, start: entries.length ? Math.floor(Math.min(...entries.map(e => e.start)) / 60) * 60 : 480, end: entries.length ? Math.ceil(Math.max(...entries.map(e => e.end)) / 60) * 60 : 1200 };
}
export function tint(color: string, exercise: boolean) {
  const hex = /^#[0-9a-f]{6}$/i.test(color) ? color : '#3B82F6';
  const white = exercise ? 0.79 : 0.52;
  return '#' + [1,3,5].map(i => Math.round(parseInt(hex.slice(i,i+2),16) * (1-white) + 255*white).toString(16).padStart(2,'0')).join('');
}

export async function renderTimetable(courses: Course[], subtitle: string, options = DEFAULT_TIMETABLE_OPTIONS, textSize = DEFAULT_TIMETABLE_TEXT_SIZE, headings = DEFAULT_TIMETABLE_HEADINGS): Promise<Blob> {
  const requestedSize = Number.isFinite(textSize) ? Math.max(MIN_TIMETABLE_TEXT_SIZE, Math.min(MAX_TIMETABLE_TEXT_SIZE, Math.round(textSize))) : DEFAULT_TIMETABLE_TEXT_SIZE;
  const minimumSize = Math.min(26, requestedSize);
  await document.fonts.ready;
  const model = buildTimetable(courses);
  if (!model.entries.length) throw new Error('אין מפגשים עם שעות תקינות בימים ראשון עד שישי.');
  const margin = 32, timeWidth = 100, top = 80 + (headings.title ? 50 : 0) + (headings.subtitle ? 40 : 0);
  let width = 1844, height = Math.round(width / TIMETABLE_RATIO);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('לא ניתן ליצור תמונה בדפדפן הזה.');
  const wrap = (value: string, available: number, size: number, bold: boolean) => {
    ctx.font = `${bold ? 'bold ' : ''}${size}px Heebo_400Regular, Arial, sans-serif`;
    const lines: string[] = []; let line = '';
    for (const word of value.split(/\s+/)) {
      if (line && ctx.measureText(line + ' ' + word).width > available) { lines.push(line); line = ''; }
      for (const char of (line ? ' ' : '') + word) {
        if (line && ctx.measureText(line + char).width > available) { lines.push(line); line = ''; }
        line += char;
      }
    }
    if (line) lines.push(line);
    return lines.map(line => line.replace(/^\s*·\s*|\s*·\s*$/g, '')).filter(Boolean);
  };
  const linesFor = (e: TimetableEntry, column: number, titleSize = minimumSize) => {
    const available = column / e.lanes - 28;
    const size = titleSize * TIMETABLE_DETAIL_RATIO;
    const details = entryDetails(e, options);
    const wordsFit = (value: string, fontSize: number, bold: boolean) => {
      ctx.font = `${bold ? 'bold ' : ''}${fontSize}px Heebo_400Regular, Arial, sans-serif`;
      return value.split(/\s+/).every(word => ctx.measureText(word).width <= available);
    };
    const wholeWordsFit = wordsFit(e.course.name,titleSize,true) && details.every(value => wordsFit(value,size,false));
    const lines = [
      ...wrap(e.course.name, available, titleSize, true).map(value => ({ value, size: titleSize, bold: true })),
      ...details.flatMap(value => wrap(value, available, size, false).map(value => ({ value, size, bold: false }))),
    ];
    return { lines, wholeWordsFit, height: lines.reduce((sum, line) => sum + line.size * 1.28, 0) };
  };
  // Expand both dimensions together when cells are dense. Never shrink text to fit.
  // Re-measure at the wider column size, which also reduces unnecessary wrapping.
  for (let attempt = 0; attempt < 12; attempt++) {
    const col = (width-margin*2-timeWidth)/6;
    const required = Math.max(...model.entries.map(e => (linesFor(e,col).height+28)*(model.end-model.start)/(e.end-e.start)));
    if (required <= height-top-70) break;
    height = Math.ceil(required+top+70); width = Math.ceil(height*TIMETABLE_RATIO);
    if (width > 8192 || height > 8192) throw new Error('המערכת צפופה מדי לתמונה אחת קריאה. בטלו חלק מהפרטים או בדקו מפגשים קצרים וחופפים.');
  }
  const column = (width-margin*2-timeWidth)/6, hourHeight = (height-top-70)*60/(model.end-model.start);
  canvas.width = width; canvas.height = height;
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,width,height);
  const text = (value: string, x: number, y: number, size=22, bold=false, maxWidth?: number) => {
    ctx.fillStyle = '#172c40'; ctx.font = `${bold ? 'bold ' : ''}${size}px Heebo_400Regular, Arial, sans-serif`;
    ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(value,x,y,maxWidth);
  };
  if (headings.title) text('מערכת השעות שלי',width/2,48,38,true);
  if (headings.subtitle) text(subtitle,width/2,headings.title ? 94 : 44,23);
  ctx.fillStyle = '#e5f2f8'; ctx.fillRect(margin,top-48,width-margin*2,48);
  ctx.fillRect(margin+column*6,top,timeWidth,height-top-50);
  WEEKDAYS.forEach((day,i) => text(day,margin+(5-i)*column+column/2,top-24,25,true));
  text('שעה',width-margin-timeWidth/2,top-24,23,true);
  const yFor = (minute: number) => top+(minute-model.start)/60*hourHeight;
  ctx.strokeStyle = '#cbd9e1'; ctx.lineWidth = 1;
  for (let minute=model.start; minute<=model.end; minute+=30) {
    const y=yFor(minute); ctx.beginPath(); ctx.moveTo(margin,y); ctx.lineTo(width-margin-timeWidth,y); ctx.stroke();
    if (minute%60===0) text(`${String(minute/60).padStart(2,'0')}:00`,width-margin-timeWidth/2,y+12,21);
  }
  for (let i=0;i<=6;i++) { ctx.beginPath(); ctx.moveTo(margin+i*column,top-48); ctx.lineTo(margin+i*column,yFor(model.end)); ctx.stroke(); }
  for (const e of model.entries) {
    const w=column/e.lanes-8, x=margin+(5-e.slot.day_of_week)*column+e.lane*column/e.lanes+4;
    const y=yFor(e.start)+4, h=yFor(e.end)-yFor(e.start)-8;
    ctx.save(); ctx.beginPath(); ctx.roundRect(x,y,w,Math.max(2,h),10); ctx.fillStyle=tint(e.course.color,e.slot.type==='exercise'); ctx.fill();
    ctx.strokeStyle=tint(e.course.color,false); ctx.stroke(); ctx.clip();
    // Respect the user's chosen size; reduce only in cells that cannot fit it.
    let layout = linesFor(e,column);
    for (let size = minimumSize + 1; size <= requestedSize; size++) {
      const candidate = linesFor(e,column,size);
      if (candidate.height > h-20 || !candidate.wholeWordsFit) break;
      layout = candidate;
    }
    let cursor = y+(h-layout.height)/2;
    for (const line of layout.lines) {
      const lineHeight = line.size*1.28;
      text(line.value,x+w/2,cursor+lineHeight/2,line.size,line.bold);
      cursor += lineHeight;
    }
    ctx.restore();
  }
  text('מערכת שבועית קבועה · הרצאות ותרגולים בלבד · CourseTrack',width/2,height-26,18);
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('יצירת התמונה נכשלה. נסו שוב.')),'image/png'));
}
