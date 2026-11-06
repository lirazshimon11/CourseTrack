import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

test('new sessions respect personal exclusions and leave the source calendar unchanged',async()=>{
  const source=await readFile(new URL('../lib/dateUtils.ts',import.meta.url),'utf8');
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports={}; new Function('exports',compiled)(exports);
  const year={semester_a_start:'2026-11-01',semester_a_end:'2026-11-22',excluded_dates:['2026-11-08']};
  const before=JSON.stringify(year);
  const sessions=exports.generateSessions('course',[{type:'lecture',day_of_week:0,start_time:'08:00',end_time:'10:00'}],year,'א');
  assert.deepEqual(sessions.map(s=>s.date),['2026-11-01','2026-11-15','2026-11-22']);
  assert.deepEqual(sessions.map(s=>s.session_number),[1,2,3]);
  assert.equal(JSON.stringify(year),before);
  assert.equal(exports.generateSessions('course',[{type:'lecture',day_of_week:0,start_time:'08:00',end_time:'10:00'}],{...year,excluded_dates:[]},'א').length,4);
});
