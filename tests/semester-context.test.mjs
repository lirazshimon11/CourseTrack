import {test} from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFile} from 'node:fs/promises';
const source=ts.transpileModule(await readFile(new URL('../lib/semesterContext.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};new Function('exports',source)(exports);
const {suggestTerm,availableTerms,institutionToday}=exports;
const year={id:'2026',label:'תשפ״ז',semester_a_start:'2026-10-18',semester_a_end:'2027-01-17',semester_b_start:'2027-02-21',semester_b_end:'2027-06-04',semester_c_start:'2027-07-11',semester_c_end:'2027-09-17'};
test('detect academic year across January, inclusive term dates and upcoming term in gaps',()=>{
 for(const date of ['2026-11-07','2027-01-01','2027-01-17'])assert.equal(suggestTerm([year],date).semester,'א');
 for(const date of ['2027-01-18','2027-02-21','2027-06-04'])assert.equal(suggestTerm([year],date).semester,'ב');
 assert.equal(suggestTerm([year],'2027-06-05').semester,'ג');
});
test('next published year, missing calendar, expired calendar and manual selection options',()=>{
 const next={...year,id:'2027',semester_a_start:'2027-10-20',semester_a_end:'2028-01-20',semester_b_start:null,semester_b_end:null,semester_c_start:null,semester_c_end:null};
 assert.equal(suggestTerm([next,year],'2027-10-01').year.id,'2027');
 assert.equal(suggestTerm([],'2026-11-07'),null);
 assert.equal(suggestTerm([year],'2027-10-01'),null);
 assert.equal(availableTerms([year]).find(t=>t.semester==='ב').year.id,'2026');
});
test('date is derived in institution timezone, independent of the computer timezone',()=>{
 assert.equal(institutionToday(new Date('2026-11-06T22:30:00Z')),'2026-11-07');
});
