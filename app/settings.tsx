import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize } from '../constants/theme';
import { useCourses } from '../hooks/useCourses';
import { supabase } from '../lib/supabase';

const SettingsScreen = () => {
  const router = useRouter();
  const { deleteAllData } = useCourses();
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAll = () => {
    Alert.alert(
      'מחיקת כל הנתונים',
      'פעולה זו תמחק את כל הקורסים, המפגשים וההערות שלך לצמיתות.\nאין דרך חזרה.',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק הכל',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteAllData();
              Alert.alert('בוצע', 'כל הנתונים נמחקו בהצלחה');
              router.back();
            } catch {
              Alert.alert('שגיאה', 'מחיקה נכשלה. נסה שוב.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const handleDeleteYearData = () => {
    Alert.alert(
      'מחיקת נתוני שנה אקדמית',
      'האם למחוק את הגדרות תאריכי השנה האקדמית?',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('academic_years').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            Alert.alert('בוצע', 'נתוני השנה האקדמית נמחקו');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-forward" size={24} color={Colors.primaryLight} />
        </TouchableOpacity>
        <Text style={styles.title}>הגדרות</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.body}>
        {/* App info */}
        <View style={styles.card}>
          <Text style={styles.cardIcon}>🎓</Text>
          <Text style={styles.cardTitle}>CourseTrack</Text>
          <Text style={styles.cardSub}>מעקב קורסים אקדמיים</Text>
          <Text style={styles.version}>גרסה 1.0.0</Text>
        </View>

        {/* Danger zone */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>אזור מסוכן</Text>

          <TouchableOpacity style={styles.dangerBtn} onPress={handleDeleteYearData}>
            <Text style={styles.dangerBtnText}>🗑️  מחק נתוני שנה אקדמית</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dangerBtn, styles.dangerBtnStrong]}
            onPress={handleDeleteAll}
            disabled={deleting}
          >
            {deleting
              ? <ActivityIndicator color={Colors.danger} />
              : <Text style={[styles.dangerBtnText, styles.dangerBtnTextStrong]}>
                  ⚠️  מחק את כל הנתונים
                </Text>
            }
          </TouchableOpacity>
          <Text style={styles.dangerHint}>פעולה זו אינה הפיכה. כל הקורסים, המפגשים וההערות יימחקו.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default SettingsScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { padding: Spacing.xs },
  backIcon: { fontSize: 28, color: Colors.primaryLight },
  title: {
    fontSize: FontSize.xl,
    fontFamily: 'Heebo_700Bold',
    color: Colors.text,
  },
  body: {
    flex: 1,
    padding: Spacing.md,
    gap: Spacing.xl,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.lg,
  },
  cardIcon: { fontSize: 48 },
  cardTitle: {
    fontSize: FontSize.xxl,
    fontFamily: 'Heebo_700Bold',
    color: Colors.text,
  },
  cardSub: {
    fontSize: FontSize.md,
    fontFamily: 'Heebo_400Regular',
    color: Colors.textSecondary,
  },
  version: {
    fontSize: FontSize.sm,
    fontFamily: 'Heebo_400Regular',
    color: Colors.textMuted,
    marginTop: Spacing.sm,
  },
  section: { gap: Spacing.sm },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontFamily: 'Heebo_700Bold',
    color: Colors.textMuted,
    textAlign: 'left',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  dangerBtn: {
    backgroundColor: Colors.danger + '15',
    borderWidth: 1,
    borderColor: Colors.danger + '44',
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  dangerBtnStrong: {
    backgroundColor: Colors.danger + '25',
    borderColor: Colors.danger,
  },
  dangerBtnText: {
    fontSize: FontSize.md,
    fontFamily: 'Heebo_500Medium',
    color: Colors.danger,
  },
  dangerBtnTextStrong: {
    fontFamily: 'Heebo_700Bold',
  },
  dangerHint: {
    fontSize: FontSize.xs,
    fontFamily: 'Heebo_400Regular',
    color: Colors.textMuted,
    textAlign: 'left',
    lineHeight: 18,
  },
});
