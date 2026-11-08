import {test} from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFile} from 'node:fs/promises';
const compiled=ts.transpileModule(await readFile(new URL('../lib/semesterImport.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};new Function('exports',compiled)(exports);const {parseSemesterText}=exports;
const header=`מסלול הנדסת חשמל ואלקטרוניקה שנה ג כיתה 3 רגל
התמחויות מערכות משובצות מחשב
סטטוס פעיל
מטרה תואר ראשון B.Sc רמת אנגלית פטור
מערכת שעות סמסטר א'`;
const samples=[
 ['א','08:00','11:00','50060-1','עיבוד אותות ספרתי',3.5],
 ['א','11:00','12:00','550060-1','עיבוד אותות ספרתי - תרגול',0],
 ['א','12:00','15:00','50018-1',"בקרה א '",3.5],
 ['א','15:00','16:00','550018-1',"בקרה א ' - תרגול",0],
 ['א','16:00','20:00','50226-2','אלגורתמים ומבנה נתונים',3.5],
 ['ב','15:00','18:00','50237-3','מעבדה מתקדמת בתכנות - מקוון',1.5],
 ['ד','12:00','13:00','550074-1','אותות אקראיים - תרגול',0],
 ['ד','13:00','16:00','50074-1','אותות אקראיים',3.5],
 ['ה','08:00','11:00','50238-1','מבוא למערכות תקשורת',3.5],
 ['ה','11:00','14:00','50046-1','גלים ומערכות מפולגות',3.5],
 ['ה','14:00','15:00','550046-1','גלים ומערכות מפולגות - תרגול',0],
 ['ה','15:00','16:00','550238-1','מבוא למערכות תקשורת ) תרגיל (',0],
 ['ה','16:00','19:00','50006-3','התקני מוליכים למחצה',3.5],
 ['ה','19:00','20:00','550006-3','התקני מוליכים למחצה - תרגול',0],
];
const formatted=samples.map(([day,start,end,code,name,credits])=>`${day} | ${start}-${end} | קוד: ${code} | ${name} | נ.ז: ${credits.toFixed(2)} | שעות: 4.00 | מרצה: מרצה לדוגמה | חדר: 218-5`).join('\n');
test('user sample: 14 slots grouped into 8 courses, profile and tutorial before lecture',()=>{
 const p=parseSemesterText(header+'\n'+formatted);assert.equal(p.courses.length,8);assert.equal(p.courses.flatMap(c=>c.slots_data).length,14);
 assert.equal(p.courses.reduce((n,c)=>n+c.credits,0),26);assert.equal(p.profile.study_year,'ג');assert.equal(p.profile.english_level,'פטור');assert.equal(p.profile.track,'הנדסת חשמל ואלקטרוניקה');
 assert.equal(p.courses.find(c=>c.name==='אותות אקראיים').course_code,'50074-1');assert.deepEqual(p.warnings,[]);
});
test('raw rows from supplied extraction algorithm, room and remote room',()=>{
 const raw=samples.map(([d,s,e,c,n,credit])=>`${d} ${s} ${e} ${c} ${n} ${credit.toFixed(2)} 4.00 מרצה לדוגמה למידה בזום 14`).join('\n');
 const p=parseSemesterText(header+'\n'+raw);assert.equal(p.courses.length,8);assert.equal(p.courses[0].slots_data[0].room,'למידה בזום 14');
});
test('reject invalid times, unknown rows warn, no semester guess or duplicate slots',()=>{
 const p=parseSemesterText(formatted+'\n'+formatted);assert.equal(p.semester,null);assert.equal(p.courses.flatMap(c=>c.slots_data).length,14);
 const bad=parseSemesterText(formatted.replace('08:00','28:00')+'\nunexpected 12:00');assert.ok(bad.warnings.length>=2);
 assert.equal(parseSemesterText('פרטים לא ידועים').courses.length,0);
});

test('warnings identify every unparsed source row and ignore explicit print metadata',()=>{
 const first='קורס שלא זוהה 12:00 13:00';
 const second='עוד קורס 15:00 16:00';
 const p=parseSemesterText('תאריך הדפסה: 09.11.2026 10:30\n'+formatted+'\n'+first+'\n'+second);
 assert.equal(p.courses.length,8);
 assert.equal(p.warnings.length,2);
 assert.ok(p.warnings[0].includes('שורה 16') && p.warnings[0].includes(first));
 assert.ok(p.warnings[1].includes('שורה 17') && p.warnings[1].includes(second));
 const invalid=parseSemesterText(formatted.replace('08:00','28:00'));
 assert.ok(invalid.warnings[0].includes('שורה 1') && invalid.warnings[0].includes('28:00'));
 const suspicious=parseSemesterText(formatted+'\nתאריך הדפסה 50060-1 12:00');
 assert.equal(suspicious.warnings.length,1,'a course code is never silently discarded as metadata');
});
