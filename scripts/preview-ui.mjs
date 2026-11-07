// Isolated visual QA with fake data. Never imports the real Supabase client.
// Not part of the Expo app or production export. Binds to loopback only.
import { build } from "esbuild";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
const root = resolve(".");
const port = Number(process.env.PREVIEW_PORT || 8082);
const result = await build({
  stdin: {
    contents: `import React from 'react';import {createRoot} from 'react-dom/client';import Settings from './app/settings';import Calendars from './app/calendars';import Admin from './app/admin';import Import from './app/import';const Component=({'/settings':Settings,'/calendars':Calendars,'/admin':Admin,'/import':Import})[location.pathname]||Settings;createRoot(document.getElementById('root')).render(<Component/>);`,
    loader: "tsx",
    resolveDir: root,
  },
  bundle: true,
  write: false,
  platform: "browser",
  format: "iife",
  define: { "process.env.NODE_ENV": '"development"', __DEV__: "true" },
  alias: { "react-native": "react-native-web" },
  plugins: [
    {
      name: "fixtures",
      setup(b) {
        b.onResolve(
          {
            filter:
              /^(expo-router|react-native-safe-area-context)$|\/lib\/supabase$|\/hooks\/useAcademicYear$|\/hooks\/useCourses$/,
          },
          (a) => ({ path: a.path, namespace: "fixture" }),
        );
        b.onLoad({ filter: /.*/, namespace: "fixture" }, (a) => ({
          loader: "js",
          resolveDir: root,
          contents:
            a.path === "expo-router"
              ? `import {useEffect} from 'react';export const useFocusEffect=fn=>useEffect(fn,[fn]);export const useRouter=()=>({push:p=>location.assign(p),replace:p=>location.assign(p)});`
              : a.path === "react-native-safe-area-context"
                ? `export {View as SafeAreaView} from 'react-native-web';`
                : a.path.endsWith("useAcademicYear")
                  ? `import {year} from './scripts/preview-fixtures';export const useAcademicYear=()=>({academicYear:year,loading:false});`
                  : a.path.endsWith("useCourses")
                    ? `export const useCourses=()=>({loading:false,courses:[{id:'preview',name:'עיבוד אותות ספרתי',semester:'א',color:'#3B82F6',credits:3.5,course_code:'50060-1',slots_data:[{type:'lecture',day_of_week:0,start_time:'08:00',end_time:'11:00',lecturer:'ד״ר כץ גלעד',room:'201'},{type:'exercise',day_of_week:0,start_time:'11:00',end_time:'12:00',lecturer:'דנילוב רומן'}]},{id:'preview2',name:'אותות אקראיים',semester:'א',color:'#F59E0B',slots_data:[{type:'lecture',day_of_week:3,start_time:'13:00',end_time:'16:00'},{type:'exercise',day_of_week:3,start_time:'12:00',end_time:'13:00'}]}],deleteAllData:async()=>{}});`
                    : `export {supabase} from './scripts/preview-fixtures';`,
        }));
      },
    },
  ],
});
const js = result.outputFiles[0].contents;
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/preview.js") {
      res.setHeader("Content-Type", "text/javascript");
      return res.end(js);
    }
    if (
      url.pathname.startsWith("/pdfjs/") ||
      url.pathname === "/pdf-reader.mjs"
    ) {
      const path = resolve(root, "public", "." + url.pathname);
      if (!path.startsWith(resolve(root, "public") + sep)) throw Error();
      res.setHeader(
        "Content-Type",
        path.endsWith(".mjs") ? "text/javascript" : "application/octet-stream",
      );
      return res.end(await readFile(path));
    }
    if (url.pathname.startsWith("/font/")) {
      const name = url.pathname.split("/").pop();
      if (!/^Heebo_\w+\.ttf$/.test(name)) throw Error();
      res.setHeader("Content-Type", "font/ttf");
      return res.end(
        await readFile(
          resolve(root, "node_modules/@expo-google-fonts/heebo", name),
        ),
      );
    }
    res.setHeader("Content-Type", "text/html;charset=utf-8");
    res.end(
      `<!doctype html><html lang="he" dir="rtl"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${["400Regular", "500Medium", "600SemiBold", "700Bold"].map((n) => `@font-face{font-family:Heebo_${n};src:url('/font/Heebo_${n}.ttf')}`).join("")}body{margin:0;background:#090912}#root{max-width:480px;margin:auto;height:calc(100dvh - 24px);display:flex}#root>div{width:100%}.banner{text-align:center;color:#FCD34D;font:12px sans-serif;height:24px;line-height:24px}</style><div class="banner">תצוגת בדיקה · נתוני דוגמה בלבד</div><div id="root"></div><script src="/preview.js"></script></html>`,
    );
  } catch {
    res.statusCode = 404;
    res.end("Not found");
  }
}).listen(port, "127.0.0.1", () =>
  console.log(`Isolated UI preview: http://127.0.0.1:${port}/settings`),
);
