import React, { useEffect, useState } from 'react';
import { Image, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Course } from '../types';
import { buildTimetable, normalizeSemester, renderTimetable, DEFAULT_TIMETABLE_OPTIONS, TIMETABLE_FIELDS, TIMETABLE_RATIO, TimetableOptions, MIN_TIMETABLE_TEXT_SIZE, MAX_TIMETABLE_TEXT_SIZE, DEFAULT_TIMETABLE_TEXT_SIZE } from '../lib/timetable';
import { Action, ui } from './SettingsUI';
import { DEFAULT_TIMETABLE_HEADINGS, TIMETABLE_HEADINGS, TimetableHeadings } from '../lib/timetable';

export function TimetableExport({ courses, yearLabel }: { courses: Course[]; yearLabel: string }) {
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [options, setOptions] = useState<TimetableOptions>({ ...DEFAULT_TIMETABLE_OPTIONS });
  const [headings, setHeadings] = useState<TimetableHeadings>({ ...DEFAULT_TIMETABLE_HEADINGS });
  const [sizeInput, setSizeInput] = useState(String(DEFAULT_TIMETABLE_TEXT_SIZE));
  const textSize = Number(sizeInput);
  const validSize = /^\d+$/.test(sizeInput) && textSize >= MIN_TIMETABLE_TEXT_SIZE && textSize <= MAX_TIMETABLE_TEXT_SIZE;
  const [preview, setPreview] = useState<{ url: string; key: string; ratio: number } | null>(null);
  const semesters = ['א','ב','ג'].filter(s => courses.some(c => normalizeSemester(c.semester) === s));
  const semester = semesters.includes(selected) ? selected : semesters[0];
  const filtered = courses.filter(c => normalizeSemester(c.semester) === semester);
  const model = buildTimetable(filtered);
  const key = JSON.stringify([yearLabel, semester, filtered, options, textSize, headings]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);
  if (!courses.length) return null;
  const generate = async () => {
    if (!validSize) return;
    setBusy(true); setError('');
    try {
      const blob = await renderTimetable(filtered, `${yearLabel} · ${semester === 'ג' ? 'סמסטר קיץ' : `סמסטר ${semester}׳`}`, options, textSize, headings);
      setPreview({ url: URL.createObjectURL(blob), key, ratio: TIMETABLE_RATIO });
    } catch (e) { setError(e instanceof Error ? e.message : 'יצירת התמונה נכשלה. נסו שוב.'); }
    finally { setBusy(false); }
  };
  return <View style={ui.card}>
    <Text style={ui.subtitle}>מערכת השעות שלי · תמונה להורדה</Text>
    <Text style={ui.text}>{yearLabel} · ראשון עד שישי. כל קורס בצבע שלו, והתרגולים בגוון בהיר יותר. כולל שעות, מרצים וחדרים כשנשמרו בקורס.</Text>
    <View style={[ui.row, { flexWrap: 'wrap' }]}>
      {semesters.map(s => <TouchableOpacity key={s} accessibilityRole="button" accessibilityState={{ selected: s === semester }} disabled={busy} onPress={() => { setSelected(s); setError(''); }} style={[ui.button, { backgroundColor: s === semester ? '#7C3AED' : '#263145' }]}>
        <Text style={ui.buttonText}>{s === 'ג' ? 'קיץ' : `סמסטר ${s}׳`}</Text>
      </TouchableOpacity>)}
    </View>
    <Text style={ui.subtitle}>מה להציג בתמונה?</Text>
    {(Object.keys(TIMETABLE_HEADINGS) as (keyof TimetableHeadings)[]).map(field => <TouchableOpacity
      key={field} accessibilityRole="checkbox" accessibilityLabel={TIMETABLE_HEADINGS[field]}
      aria-checked={headings[field]} accessibilityState={{ checked: headings[field], disabled: busy }} disabled={busy}
      onPress={() => { setHeadings(previous => ({ ...previous, [field]: !previous[field] })); setError(''); }}
      style={[ui.row,{padding:10,borderRadius:10,backgroundColor:'#263145'}]}
    >
      <View style={{width:23,height:23,borderRadius:5,borderWidth:1,borderColor:headings[field]?'#A78BFA':'#94A3B8',backgroundColor:headings[field]?'#7C3AED':'transparent',alignItems:'center',justifyContent:'center'}}><Text style={{color:'#fff',fontSize:16}}>{headings[field]?'✓':''}</Text></View>
      <Text style={[ui.text,{flex:1}]}>{TIMETABLE_HEADINGS[field]}</Text>
    </TouchableOpacity>)}
    <Text style={ui.text}>✓ שם הקורס — תמיד מוצג</Text>
    <View style={[ui.row, { flexWrap: 'wrap' }]}>
      {(Object.keys(TIMETABLE_FIELDS) as (keyof TimetableOptions)[]).map(field => <TouchableOpacity
        key={field} accessibilityRole="checkbox" accessibilityLabel={TIMETABLE_FIELDS[field]}
        aria-checked={options[field]}
        accessibilityState={{ checked: options[field], disabled: busy }} disabled={busy}
        onPress={() => { setOptions(previous => ({ ...previous, [field]: !previous[field] })); setError(''); }}
        style={[ui.row, { padding: 10, borderRadius: 10, backgroundColor: '#263145', minWidth: 140 }]}
      >
        <View style={{ width: 23, height: 23, borderRadius: 5, borderWidth: 1, borderColor: options[field] ? '#A78BFA' : '#94A3B8', backgroundColor: options[field] ? '#7C3AED' : 'transparent', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: 16 }}>{options[field] ? '✓' : ''}</Text></View>
        <Text style={ui.text}>{TIMETABLE_FIELDS[field]}</Text>
      </TouchableOpacity>)}
    </View>
    <Text style={ui.subtitle}>גודל שם הקורס בתמונה</Text>
    <View style={[ui.row, { flexWrap: 'wrap' }]}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="הקטנת גודל שם הקורס" disabled={busy || !validSize || textSize <= MIN_TIMETABLE_TEXT_SIZE} onPress={() => setSizeInput(String(textSize-1))} style={ui.button}><Text style={ui.buttonText}>−</Text></TouchableOpacity>
      <TextInput accessibilityLabel="גודל שם הקורס" keyboardType="number-pad" inputMode="numeric" editable={!busy} value={sizeInput} onChangeText={value => {setSizeInput(value);setError('');}} style={[ui.input,{width:90,textAlign:'center'}]} />
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="הגדלת גודל שם הקורס" disabled={busy || !validSize || textSize >= MAX_TIMETABLE_TEXT_SIZE} onPress={() => setSizeInput(String(textSize+1))} style={ui.button}><Text style={ui.buttonText}>+</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => setSizeInput(String(DEFAULT_TIMETABLE_TEXT_SIZE))}><Text style={ui.text}>איפוס ל־{DEFAULT_TIMETABLE_TEXT_SIZE}</Text></TouchableOpacity>
    </View>
    {!validSize && <Text accessibilityRole="alert" style={ui.text}>בחרו מספר שלם בין {MIN_TIMETABLE_TEXT_SIZE} ל־{MAX_TIMETABLE_TEXT_SIZE}.</Text>}
    <Text style={ui.text}>המספר קובע את גודל שם הקורס המודגש. שאר הפרטים ללא הדגשה ובגודל של 85% ממנו. בקוביות צפופות כל הטקסט יוקטן יחד, תוך שמירה על היחס.</Text>
    <Text style={ui.text}>תמונה כמעט ריבועית, עם טווח שעות מותאם לקורסים.</Text>
    <Text style={ui.text}>המערכת מבוססת על שעות הקורסים הקבועות, ללא חגים ואירועי מוסד.</Text>
    {model.omitted > 0 && <Text style={ui.text}>לא יוצגו {model.omitted} קורסים ללא מפגשים או מפגשים עם שעות חסרות/לא תקינות או ביום שבת. אפשר לעדכן אותם בעריכת הקורס.</Text>}
    {Platform.OS === 'web' ? <>
      <Action title={busy ? 'יוצר את המערכת…' : 'תצוגה מקדימה של המערכת'} disabled={busy || !validSize || !model.entries.length} onPress={() => void generate()} />
      {validSize && preview?.key === key && <>
        <Image source={{ uri: preview.url }} accessibilityLabel="מערכת השעות השבועית, מראשון עד שישי" resizeMode="contain" style={{ width: '100%', aspectRatio: preview.ratio, backgroundColor: '#fff', borderRadius: 8 }} />
        <Action title="הורדת המערכת כתמונה (PNG)" onPress={() => {
          const link = document.createElement('a'); link.href = preview.url; link.download = `מערכת-שעות-${yearLabel.replace(/[^\p{L}\p{N}-]/gu,'-')}-${semester}.png`;
          document.body.appendChild(link); link.click(); link.remove();
        }} />
      </>}
    </> : <Text style={ui.text}>להורדת תמונת המערכת, פתחו את ההגדרות בגרסת הדפדפן.</Text>}
    {!!error && <Text accessibilityRole="alert" style={ui.text}>{error}</Text>}
  </View>;
}
