import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractHtml, parseCalendar } from '../server/calendar-parser.mjs';

// Minimal fixture matching the public HIT HTML observed on 2026-11-06.
// Dates here exercise structure and semantics; no student documents are used.
const event=(title,dates,info='')=>`<div class="line"><div class="title"><span>${title}</span><div class="sub"></div></div><div class="dates">${dates}</div><div class="info">${info}</div></div>`;
const sem=(title,events)=>`<div class="sem"><h2>${title}</h2><div class="events">${events.join('')}</div></div>`;
const fixture=`<main><div class="top"><div class="year_cal">תשפ״ז 2027-2026</div><ul><li>תשפ״ו 2026-2025</li></ul><a href="/calendar.pdf">גרסה להדפסה</a></div><div class="lists">${[
  sem("סמסטר א'",[
    event('היום הראשון ללימודים','18/10/26'),
    event('הפנינג תחילת שנת הלימודים','18/10/26 עד 20/10/26','הפסקות לימודים בין השעות 13:00-14:00'),
    event('חנוכה','06/12/26','חופשה'),event('היום האחרון לסמסטר','17/01/27'),event("בחינות סמסטר א'",'18/01/27 עד 19/02/27'),
  ]),
  sem("סמסטר ב'",[
    event("היום הראשון לסמסטר ב'",'21/02/27'),event('היום האחרון ללימודים לפני חופשת פסח','20/04/27','הלימודים יתקיימו בזום'),
    event('חופשת פסח','21/04/27 עד 28/04/27','חופשה'),event('היום הראשון ללימודים אחרי חופשת פסח','29/04/27'),
    event('ערב יום הזיכרון','10/05/27','הלימודים מסתיימים בשעה 18:00'),event('יום הזיכרון','11/05/27','חופשה'),
    event("היום האחרון לסמסטר ב'",'04/06/27'),event('יום השלמה','06/06/27',"לימודי השלמות לשיעורים של ימי ג' או ד'"),
  ]),
  sem('סמסטר קיץ',[
    event('היום הראשון לסמסטר קיץ','11/07/27'),event('היום האחרון לסמסטר קיץ','17/09/27'),event('היום הראשון ללימודים בשנה"ל תשפ"ח','31/10/27'),
  ]),
].join('')}</div></main>`;

test('HIT selected year and exact boundaries ignore dropdown years, exams and holiday returns',()=>{
  const {calendar,warnings}=parseCalendar(extractHtml(fixture,'https://www.hit.ac.il/students/calender/').text);
  assert.equal(calendar.start_year,2026);
  assert.deepEqual([calendar.semester_a_start,calendar.semester_a_end,calendar.semester_b_start,calendar.semester_b_end,calendar.semester_c_start,calendar.semester_c_end],
    ['2026-10-18','2027-01-17','2027-02-21','2027-06-04','2027-07-11','2027-09-17']);
  for(const d of ['2026-12-06','2027-04-21','2027-04-28','2027-05-11']) assert.ok(calendar.excluded_dates.includes(d));
  for(const d of ['2026-10-18','2027-04-20','2027-04-29','2027-05-10','2027-06-06']) assert.ok(!calendar.excluded_dates.includes(d));
  assert.ok(warnings.some(w=>w.includes('השלמה')));assert.ok(warnings.some(w=>w.includes('18:00')));assert.ok(warnings.some(w=>w.includes('בזום')));
});
test('same HIT structure works for next year without hardcoding the current year',()=>{
  const next=fixture.replaceAll('תשפ״ז','תשפ״ח').replaceAll('תשפ"ח','תשפ"ט').replaceAll('2027','2028').replaceAll('2026','2027').replaceAll('/27','/28').replaceAll('/26','/27');
  assert.equal(parseCalendar(extractHtml(next,'https://www.hit.ac.il/').text).calendar.start_year,2027);
});
