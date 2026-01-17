const fs = require('fs');
const path = require('path');

const candidatePaths = [
  '../node_modules/pdfjs-dist/build/pdf.worker.min.js',
  '../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.js',
  '../node_modules/pdfjs-dist/build/pdf.worker.min.mjs',
];
const destinationDir = path.resolve(__dirname, '../public');
const destination = path.join(destinationDir, 'pdf.worker.min.js');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function findSource() {
  for (const candidate of candidatePaths) {
    const resolved = path.resolve(__dirname, candidate);
    if (fs.existsSync(resolved)) {
      return resolved;
    }
  }
  return null;
}

function copyWorker() {
  try {
    const source = findSource();
    if (!source) {
      console.warn('[copy-pdf-worker] מקור worker לא נמצא באף מסלול צפוי:', candidatePaths.join(', '));
      return;
    }
    ensureDir(destinationDir);
    fs.copyFileSync(source, destination);
    console.log('[copy-pdf-worker] הועתק בהצלחה אל', destination);
  } catch (error) {
    console.warn('[copy-pdf-worker] שגיאה בהעתקת הקובץ. ממשיך ללא העתקה (קובץ קיים?):', error.message);
  }
}

copyWorker();

