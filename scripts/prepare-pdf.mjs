import { mkdir, copyFile, cp } from "node:fs/promises";
const base = new URL("../", import.meta.url);
await mkdir(new URL("public/pdfjs/", base), { recursive: true });
for (const file of ["pdf.mjs", "pdf.worker.mjs"])
  await copyFile(
    new URL(`node_modules/pdfjs-dist/legacy/build/${file}`, base),
    new URL(`public/pdfjs/${file}`, base),
  );
for (const dir of ["cmaps", "standard_fonts", "wasm"])
  await cp(
    new URL(`node_modules/pdfjs-dist/${dir}`, base),
    new URL(`public/pdfjs/${dir}`, base),
    { recursive: true },
  );
