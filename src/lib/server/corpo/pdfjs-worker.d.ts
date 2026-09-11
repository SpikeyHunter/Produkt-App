// pdfjs-dist ships no types for the worker entry; we only import it for its side effect
// (registers globalThis.pdfjsWorker so pdfjs runs the worker in-process on Vercel).
declare module 'pdfjs-dist/legacy/build/pdf.worker.mjs';
