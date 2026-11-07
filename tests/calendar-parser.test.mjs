import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractHtml, parseCalendar, parseDate, publicationDecision } from '../server/calendar-parser.mjs';
import { assertSourceUrl, fetchDocument } from '../server/calendar-fetch.mjs';
import { readSource } from '../server/calendar-sync.mjs';
import { matchesSecret } from '../api/calendar-sync.mjs';

// Synthetic fixture, NOT verified HIT dates. No personal documents are used.
const fixture = `לוח השנה האקדמית תשפ״ז 2026-2027
תחילת סמסטר א' 18.10.2026
סיום סמסטר א' 22.01.2027
תחילת סמסטר ב' 07.03.2027
סיום סמסטר ב' 18.06.2027
תחילת סמסטר קיץ 11.07.2027
סיום סמסטר קיץ 10.09.2027
חופשת חג 20.04.2027 - 22.04.2027`;

test('dynamic academic year, semester dates and inclusive closures',()=>{
  const {calendar,warnings}=parseCalendar(fixture);
  assert.equal(calendar.start_year,2026); assert.equal(calendar.semester_c_end,'2027-09-10');
  assert.deepEqual(calendar.excluded_dates,['2027-04-20','2027-04-21','2027-04-22']); assert.deepEqual(warnings,[]);
  const next=parseCalendar(fixture.replaceAll('תשפ״ז','תשפ״ח').replaceAll('2027','2028').replaceAll('2026','2027'));
  assert.equal(next.calendar.start_year,2027);
});
test('reject impossible dates, contradictory years and missing or ambiguous semester boundaries',()=>{
  assert.throws(()=>parseDate('31.02.2027'));
  assert.throws(()=>parseCalendar(fixture.replace('תשפ״ז','תשפ״ח')));
  assert.throws(()=>parseCalendar(fixture.replace("סיום סמסטר א' 22.01.2027",'')));
  assert.throws(()=>parseCalendar(fixture+"\nסיום סמסטר א' 23.01.2027"));
  assert.throws(()=>parseCalendar(fixture.replace('07.03.2027','01.01.2027')));
});
test('partial-day and schedule substitution notices are preserved as warnings',()=>{
  const parsed=parseCalendar(fixture+'\nלא יתקיימו לימודים החל מהשעה 16:00 01.05.2027\nהוראה של יום ראשון 02.05.2027');
  assert.equal(parsed.warnings.length,2); assert.ok(!parsed.calendar.excluded_dates.includes('2027-05-01'));
});
test('extract table rows and the current print link, not a hardcoded yearly PDF',()=>{
  const html='<main><h1>לוח השנה האקדמית תשפ״ז</h1><table>'+fixture.split('\n').slice(1).map(l=>`<tr><td>${l}</td></tr>`).join('')+'</table><a href="/files/year.pdf">גרסה להדפסה</a></main>';
  const extracted=extractHtml(html,'https://www.hit.ac.il/students/calender/');
  assert.equal(parseCalendar(extracted.text).calendar.start_year,2026);
  assert.deepEqual(extracted.pdfLinks,['https://www.hit.ac.il/files/year.pdf']);
});
test('publish without approval; invalid data fails and manual edits remain unchanged',()=>{
  const source={auto_publish_new_years:true};
  assert.equal(publicationDecision({origin:'sync'},source,[],true),'published');
  assert.equal(publicationDecision(null,source,['חריג דורש בדיקה: הפסקה בשעה 18:00'],false),'published');
  assert.equal(publicationDecision(null,{auto_publish_new_years:false},[],false),'published');
  assert.equal(publicationDecision(null,source,[],false),'published');
  assert.throws(()=>publicationDecision(null,source,['ambiguous'],true));
  assert.equal(publicationDecision({origin:'manual'},source,[],true),'unchanged');
  assert.equal(publicationDecision(null,source,[],true),'published');
});
test('SSRF protection including redirects and size limits',async()=>{
  for(const u of ['http://www.hit.ac.il/','https://localhost/','https://hit.ac.il.evil.test/','https://user@hit.ac.il/','https://hit.ac.il:8443/']) assert.throws(()=>assertSourceUrl(u));
  await assert.rejects(fetchDocument('https://www.hit.ac.il/',10,async()=>new Response('too big a response', {headers:{'content-length':'100'}})));
  let calls=0;
  await assert.rejects(fetchDocument('https://www.hit.ac.il/',100,async()=>{calls++;return new Response(null,{status:302,headers:{location:'https://127.0.0.1/'}});}));
  assert.equal(calls,1);
});
test('PDF fallback follows a unique discovered link and parses with same validation',async()=>{
  const urls=[];
  const result=await readSource({adapter:'hit-v1',page_url:'https://www.hit.ac.il/students/calender/'},async url=>{
    urls.push(url); return {url,contentType:urls.length===1?'text/html':'application/pdf',bytes:Buffer.from(urls.length===1?'<main><a href="/calendar-new.pdf">גרסה להדפסה</a><a href="/other.pdf">מסמך אחר</a></main>':'%PDF-test')};
  },async()=>fixture);
  assert.equal(result.calendar.start_year,2026); assert.equal(urls[1],'https://www.hit.ac.il/calendar-new.pdf');
});
test('cron secret rejects missing, malformed and wrong credentials',()=>{
  assert.equal(matchesSecret(undefined,undefined),false);
  assert.equal(matchesSecret('Bearer wrong','secret'),false);
  assert.equal(matchesSecret('Bearer secret','secret'),true);
});
