import React, { useCallback, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Disclosure, ui } from './SettingsUI';
import { clearDiagnostics, diagnosticsText } from '../lib/clientDiagnostics';

export function ImportDiagnostics() {
  const [text, setText] = useState('');
  const refresh = useCallback(() => setText(diagnosticsText() || 'עדיין לא נרשמו אירועים.'), []);
  return <Disclosure title="אבחון בעיית בחירת PDF">
    <Text style={ui.text}>אם האפליקציה חוזרת לדף הבית, חזרו לכאן ולחצו על הצגת היומן. שלחו לי את כל הטקסט שמופיע.</Text>
    <TouchableOpacity accessibilityRole="button" style={ui.button} onPress={refresh}><Text style={ui.buttonText}>הצגת יומן אבחון</Text></TouchableOpacity>
    {!!text && <TextInput accessibilityLabel="יומן אבחון" multiline editable={false} selectTextOnFocus value={text} style={[ui.input, { minHeight: 180, textAlign: 'left', writingDirection: 'ltr', fontSize: 11 }]} />}
    <TouchableOpacity accessibilityRole="button" style={[ui.button, { backgroundColor: '#343447' }]} onPress={() => { clearDiagnostics(); setText(''); }}><Text style={ui.buttonText}>ניקוי יומן</Text></TouchableOpacity>
  </Disclosure>;
}
