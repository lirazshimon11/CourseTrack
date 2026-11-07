import {test} from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFile} from 'node:fs/promises';
const source=ts.transpileModule(await readFile(new URL('../constants/courseColors.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};new Function('exports',source)(exports);
test('all 60 supported import courses receive distinct persistent hex colors',()=>{
 const colors=Array.from({length:60},(_,i)=>exports.courseColor(i));
 assert.equal(new Set(colors).size,60);assert.ok(colors.every(c=>/^#[0-9A-F]{6}$/.test(c)));
 assert.equal(exports.courseColor(0),colors[0]);
});
