export interface PlanFile {
  blob: Blob;
  filename: string;
  width: number;
  height: number;
}

const imageSize = (url: string) =>
  new Promise<{ width: number; height: number }>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('Gambar tidak dapat dibaca'));
    img.src = url;
  });

/** Size of an SVG from its viewBox or width/height attributes. */
function svgSize(text: string): { width: number; height: number } | null {
  const svg = new DOMParser().parseFromString(text, 'image/svg+xml').documentElement;
  const box = svg.getAttribute('viewBox')?.split(/[\s,]+/).map(Number);
  if (box && box.length === 4 && box[2]! > 0 && box[3]! > 0) return { width: box[2]!, height: box[3]! };
  const w = parseFloat(svg.getAttribute('width') ?? '');
  const h = parseFloat(svg.getAttribute('height') ?? '');
  return w > 0 && h > 0 ? { width: w, height: h } : null;
}

/** Prepare a layout file for upload: SVG/PNG/JPG as-is, PDF page 1 rendered to a 2x PNG. */
export async function readPlanFile(file: File): Promise<PlanFile> {
  const ext = file.name.toLowerCase().split('.').pop() ?? '';
  if (ext === 'pdf') {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas tidak tersedia');
    await page.render({ canvasContext: ctx, viewport }).promise;
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PDF gagal dirender'))), 'image/png'));
    return { blob, filename: file.name.replace(/\.pdf$/i, '.png'), width: canvas.width, height: canvas.height };
  }
  if (ext === 'svg') {
    const size = svgSize(await file.text());
    if (size) return { blob: file, filename: file.name, ...size };
  }
  const url = URL.createObjectURL(file);
  try {
    return { blob: file, filename: file.name, ...(await imageSize(url)) };
  } finally {
    URL.revokeObjectURL(url);
  }
}
