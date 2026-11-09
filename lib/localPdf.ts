declare global {
  interface Window {
    courseTrackReadPdf?: (buffer: ArrayBuffer) => Promise<string>;
  }
}
let ready: Promise<void> | null = null;
export async function prepareLocalPdfReader() {
  if (!ready)
    ready = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.type = "module";
      script.src = "/pdf-reader.mjs";
      script.onload = () => resolve();
      script.onerror = () => {
        ready = null;
        script.remove();
        reject(new Error("טעינת קורא ה־PDF נכשלה. נסו שוב או הדביקו פלט."));
      };
      document.head.appendChild(script);
    });
  await ready;
  if (!window.courseTrackReadPdf)
    throw new Error("קורא ה־PDF אינו זמין בדפדפן הזה.");
}
export async function readLocalPdf(file: File) {
  if (file.size > 10 * 1024 * 1024) throw new Error("בחרו קובץ עד 10MB.");
  await prepareLocalPdfReader();
  const reader = window.courseTrackReadPdf;
  if (!reader) throw new Error("קורא ה־PDF אינו זמין בדפדפן הזה.");
  return reader(await file.arrayBuffer());
}
