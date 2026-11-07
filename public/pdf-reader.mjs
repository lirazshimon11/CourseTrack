// All PDF bytes stay in this browser. Assets are served by this app, never a CDN.
import { getDocument, GlobalWorkerOptions } from "./pdfjs/pdf.mjs";
GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.mjs";
window.courseTrackReadPdf = async function (buffer) {
  const task = getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    cMapUrl: "/pdfjs/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "/pdfjs/standard_fonts/",
    wasmUrl: "/pdfjs/wasm/",
  });
  try {
    const doc = await task.promise;
    if (doc.numPages > 20) throw new Error("ניתן לייבא עד 20 עמודים.");
    const lines = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const items = content.items
        .filter((w) => w.str?.trim())
        .map((w) => ({
          text: w.str,
          x: w.transform[4],
          y: w.transform[5] + w.height / 2,
        }))
        .sort((a, b) => b.y - a.y);
      const rows = [];
      for (const w of items) {
        let row = rows.at(-1);
        if (
          !row ||
          Math.abs(w.y - row.reduce((n, a) => n + a.y, 0) / row.length) >= 10
        ) {
          row = [];
          rows.push(row);
        }
        row.push(w);
      }
      for (const row of rows)
        lines.push(
          row
            .sort((a, b) => b.x - a.x)
            .map((w) => w.text)
            .join(" "),
        );
      page.cleanup();
    }
    return lines.join("\n");
  } finally {
    await task.destroy();
  }
};
