import {test} from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFile} from 'node:fs/promises';
async function module(path,require=()=>{throw Error('unexpected import');}){const out=ts.transpileModule(await readFile(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const exports={};new Function('exports','require',out)(exports,require);return exports;}
const context=await module('../lib/semesterContext.ts');
const {loadInstitutionYears}=await module('../lib/loadInstitutionYears.ts',()=>context);
function setup({shared=true,personal=false,manual=false,fail=false}={}){
 const year={id:'shared',institution_id:'hit',semester_a_start:'2020-01-01',semester_a_end:'2099-12-31'};
 let years=personal?[{...year,id:'personal',calendar_id:'shared',date_mode:manual?'manual':'calendar'}]:[];let calls=0;
 return {get calls(){return calls;},db:{from(table){const data=table==='student_profiles'?{institution_id:'hit'}:table==='institution_calendars'?(shared?[year]:[]):years;
 const q={select:()=>q,eq:()=>q,maybeSingle:()=>q,then:fn=>Promise.resolve({data,error:fail?{}:null}).then(fn)};return q;},rpc:async(name,args)=>{assert.equal(name,'adopt_institution_calendar');assert.equal(args.p_calendar_id,'shared');calls++;years=[{...year,id:'personal',calendar_id:'shared'}];return {error:null};}}};
}
test('a central calendar repairs a missing personal copy without fetching external sources',async()=>{
 const s=setup();const result=await loadInstitutionYears(s.db);assert.equal(result.years[0].id,'personal');assert.equal(s.calls,1);
});
test('never overwrite an existing manual copy or fabricate a missing central calendar',async()=>{
 const manual=setup({personal:true,manual:true});assert.equal((await loadInstitutionYears(manual.db)).years[0].date_mode,'manual');assert.equal(manual.calls,0);
 const missing=setup({shared:false});assert.equal((await loadInstitutionYears(missing.db)).years.length,0);assert.equal(missing.calls,0);
});
test('database read failure is not disguised as missing calendar data',async()=>{await assert.rejects(loadInstitutionYears(setup({fail:true}).db));});
