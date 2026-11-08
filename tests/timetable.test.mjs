import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFile } from 'node:fs/promises';
const source = ts.transpileModule(await readFile(new URL('../lib/timetable.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const api = {}; new Function('exports', source)(api);
const slot = (start, end, day=0, type='lecture') => ({ start_time:start, end_time:end, day_of_week:day, type });
const course = slots => ({ id:'c', name:'קורס', color:'#3B82F6', slots_data:slots });
test('only valid Sunday-Friday course slots enter the weekly image', () => {
  const model = api.buildTimetable([course([slot('08:00:00','10:30:00'),slot('10:30','11:30',5,'exercise'),slot('12:00','13:00',6),slot('25:00','26:00'),slot('12:00','11:00'),slot('12:00','13:00',2,'holiday')]),course([])]);
  assert.equal(model.entries.length,2); assert.equal(model.omitted,5);
  assert.equal(api.WEEKDAYS.length,6); assert.equal(api.WEEKDAYS[0],'ראשון'); assert.equal(api.WEEKDAYS[5],'שישי');
});
test('connected overlaps use separate lanes, touching meetings do not overlap', () => {
  const {entries} = api.buildTimetable([course([slot('08:00','10:00'),slot('09:00','11:00'),slot('10:00','12:00'),slot('12:00','13:00')])]);
  assert.deepEqual(entries.map(e=>[e.lane,e.lanes]),[[0,2],[1,2],[0,2],[0,1]]);
});
test('time range expands to include early and late meetings', () => {
  const model=api.buildTimetable([course([slot('06:30','07:30'),slot('21:00','23:30')])]);
  assert.equal(model.start,360); assert.equal(model.end,1440);
});
test('exercise retains course hue but is lighter; summer aliases match', () => {
  const lecture=api.tint('#3B82F6',false), exercise=api.tint('#3B82F6',true);
  for(const i of [1,3,5]) assert.ok(parseInt(exercise.slice(i,i+2),16)>parseInt(lecture.slice(i,i+2),16));
  assert.equal(api.normalizeSemester('קיץ'),api.normalizeSemester('ג'));
  assert.match(api.tint('invalid',false),/^#[0-9a-f]{6}$/);
});
test('each optional detail can be independently omitted, including zero credits', () => {
  const entry = {course:{ ...course([]), credits:0, course_code:'123'}, slot:{...slot('08:00','09:00'),lecturer:'מרצה לדוגמה', room:'201'}};
  const off=Object.fromEntries(Object.keys(api.DEFAULT_TIMETABLE_OPTIONS).map(k=>[k,false]));
  assert.deepEqual(api.entryDetails(entry,off),[]);
  for(const field of Object.keys(off)) assert.equal(api.entryDetails(entry,{...off,[field]:true}).length,1);
  assert.match(api.entryDetails(entry,{...off,credits:true})[0],/0 נ״ז/);
});
test('compact rendering keeps its ratio and readable text with all or no details', async () => {
  let block=null;
  const written=[];
  const sizes=[];
  const ctx={
    font:'', measureText(value){return {width:value.replace(/[\u2066\u2069]/g,'').length*Number(/([\d.]+)px/.exec(this.font)?.[1] || 22)*0.54};},
    fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fill(){},clip(){},save(){},restore(){block=null;},
    roundRect(x,y,w,h){block={x,y,w,h,titleSize:null};},
    fillText(value,x,y){
      if(block){const size=Number(/([\d.]+)px/.exec(this.font)[1]);assert.ok(y-size/2>=block.y && y+size/2<=block.y+block.h,`vertical fit: ${value}`);assert.ok(this.measureText(value).width<=block.w-14,`horizontal fit: ${value}`);assert.ok(size>=16*0.85);sizes.push(size);
        if(this.font.startsWith('bold ')) {block.titleSize ??= size; assert.equal(size,block.titleSize);}
        else {assert.ok(block.titleSize);assert.ok(Math.abs(size/block.titleSize-0.85)<1e-10,'details always use exactly 85% of title size and normal weight');}
      }
      written.push(value);
    },
  };
  const canvas={width:0,height:0,getContext:()=>ctx,toBlob:callback=>callback(new Blob(['png']))};
  globalThis.document={fonts:{ready:Promise.resolve()},createElement:()=>canvas};
  const courses=[{...course([ {...slot('08:00','09:00'),lecturer:'מרצה לדוגמה',room:'בניין א 201'},slot('08:30','10:00',0,'exercise'),slot('19:00','20:00',5)]),name:'קורס בדיקה עם שם ארוך במיוחד',credits:3.5,course_code:'12345'}];
  try {
    for(const options of [api.DEFAULT_TIMETABLE_OPTIONS,Object.fromEntries(Object.keys(api.DEFAULT_TIMETABLE_OPTIONS).map(k=>[k,false]))]) {
      written.length=0;
      await api.renderTimetable(courses,'שנת בדיקה',options);
      assert.ok(Math.abs(canvas.width/canvas.height-api.TIMETABLE_RATIO)<0.002);
      assert.ok(written.some(v=>v.includes('קורס')));
      assert.equal(written.some(v=>v.includes('מרצה')),options.lecturer);
    }
    const longCourse={...course([slot('08:00','11:00'),slot('11:00','12:00',0,'exercise'),slot('19:00','20:00',5)]),name:'אותות אקראיים'};
    const maxima=[];
    for(const requested of [16,32,37,44]) {
      sizes.length=0;
      await api.renderTimetable([longCourse],'בדיקת גודל',api.DEFAULT_TIMETABLE_OPTIONS,requested);
      const maximum=Math.max(...sizes);
      assert.equal(maximum,requested,'chosen number is the actual title size in spacious cells');
      maxima.push(maximum);
    }
    assert.ok(maxima[0]<maxima[1] && maxima[1]<maxima[2] && maxima[2]<maxima[3],'each user size changes output');
    sizes.length=0;
    await api.renderTimetable([longCourse],'ברירת מחדל');
    assert.equal(Math.max(...sizes),maxima[1],'default is the moderate normal size');
    for (const title of [true,false]) for (const subtitle of [true,false]) {
      written.length=0;
      await api.renderTimetable([longCourse],'כותרת משנה לבדיקה',api.DEFAULT_TIMETABLE_OPTIONS,32,{title,subtitle});
      assert.equal(written.includes('מערכת השעות שלי'),title);
      assert.equal(written.includes('כותרת משנה לבדיקה'),subtitle);
      assert.ok(written.includes('ראשון') && written.includes('שישי'),'day headers stay visible');
    }
  } finally { delete globalThis.document; }
});

