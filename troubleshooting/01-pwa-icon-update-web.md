# בעיה 01: האייקון של האפליקציה (PWA) לא מתעדכן במסך הבית (Web/Vercel)

## תיאור הבעיה
שינית את האייקון הראשי בתיקיית `assets/` (למשל `assets/icon.png`), דחפת ל-GitHub ו-Vercel סיים לפבלש (Deploy). 
כשנכנסים לאתר דרך הדפדפן (Favicon) רואים את האייקון החדש, אבל כשלוחצים **"הוספה למסך הבית"** (Add to Home Screen), עדיין רואים את האייקון הישן.

## למה זה קורה?
1. **קבצים סטטיים בתיקיית `public/`**: בפריסה ל-Web באמצעות Expo + Vercel, ישנה תיקייה בשם `public`. הקבצים בתיקייה זו (כמו `icon-192.png` או `icon-512.png`) לא מתעדכנים אוטומטית שמשנים את ה-`assets`. הם דורסים את ההגדרות של Expo ומגישים למשתמש את האייקון הישן שהיה שם.
2. **PWA Caching בדפדפני מובייל**: דפדפנים בטלפון (במיוחד אנדרואיד/כרום) שומרים את ה-`manifest.json` בזיכרון עמוק ואגרסיבי. הם מניחים שאם שם הקובץ (לדוגמה `icon-192.png`) לא השתנה, אז גם התמונה לא השתנתה.

## הפתרון (צעד אחר צעד)

### שלב 1: עדכון הקבצים בתיקיית `public/`
צריך להעתיק את האייקון החדש מתיקיית `assets/` ולדרוס איתו את התמונות הישנות בתיקיית `public/`.
אפשר לעשות זאת פיזית על ידי גרירה של הקבצים, או דרך הקונסול/טרמינל (Windows):

```powershell
Copy-Item assets/icon.png public/icon-192.png -Force
Copy-Item assets/icon.png public/icon-512.png -Force
Copy-Item assets/icon.png public/apple-touch-icon.png -Force
```

### שלב 2: שבירת הקאש (Cache Busting) ב-`manifest.json`
כנס לקובץ `public/manifest.json`.
חפש את אזור ה-`icons`. תוסיף פרמטר סטטי לכתובת הקובץ, לדוגמה `?v=2` (ואם כבר מוגדר, תעלה אותו ל-`v=3` וכן הלאה). הפעולה הזאת "מכריחה" את הטלפון להוריד את הקובץ מחדש.

**דוגמה לשינוי:**
```diff
  "icons": [
    {
-      "src": "icon-192.png",
+      "src": "icon-192.png?v=2",
      "type": "image/png",
      "sizes": "192x192"
    },
    {
-      "src": "icon-512.png",
+      "src": "icon-512.png?v=2",
      "type": "image/png",
      "sizes": "512x512"
    }
  ]
```

### שלב 3: העלאה ל-Vercel
דחוף את כל השינויים (חובה לכלול את תיקיית `public/`) ל-Git:

```bash
git add public/
git commit -m "Update PWA web icons and increment cache version"
git push
```

אחרי ש-Vercel מסיים את הבילד, המשתמשים שיכנסו לאתר יקבלו את ה-manifest החדש שמורה לדפדפן למשוך את האייקון העדכני.
