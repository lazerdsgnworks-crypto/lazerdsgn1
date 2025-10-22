
// @ts-ignore
import { PDFDocument } from 'pdf-lib/dist/pdf-lib.esm.js';
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist/build/pdf';

// You might need to host this worker file on your own server for production
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js`;

export function dataURLtoFile(dataurl: string, filename: string): File {
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
}

export async function createPdfThumbnail(fileOrDataUrl: File | string): Promise<string> {
    let loadingTask;
    if (fileOrDataUrl instanceof File) {
        const arrayBuffer = await fileOrDataUrl.arrayBuffer();
        loadingTask = pdfjsLib.getDocument(arrayBuffer);
    } else { // is dataURL
        const raw = atob(fileOrDataUrl.split(',')[1]);
        const rawLength = raw.length;
        const array = new Uint8Array(new ArrayBuffer(rawLength));
        for (let i = 0; i < rawLength; i++) {
            array[i] = raw.charCodeAt(i);
        }
        loadingTask = pdfjsLib.getDocument(array);
    }

    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1); // Get the first page
    const viewport = page.getViewport({ scale: 0.5 }); // Small scale for thumbnail
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({ canvasContext: context, viewport: viewport }).promise;
    return canvas.toDataURL(); // Returns a data URL of the thumbnail
}


export async function createThumbnail(dataUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 400;
            const MAX_HEIGHT = 300;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.7)); // Compress to JPEG
        };
        img.onerror = reject;
        img.src = dataUrl;
    });
}

export function compressImage(file: File, targetSizeInBytes = 1 * 1024 * 1024): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image();
            img.src = event.target!.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d')!;
                
                // --- OPTIMIZATION: Resize before compression ---
                const MAX_WIDTH = 1280;
                const MAX_HEIGHT = 1280;
                let { width, height } = img;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                // --- END OPTIMIZATION ---

                let quality = 0.9;

                const tryCompression = () => {
                    canvas.toBlob(blob => {
                        if (!blob) {
                           reject(new Error("Canvas to Blob conversion failed"));
                           return;
                        }
                        if (blob.size <= targetSizeInBytes || quality <= 0.1) {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result as string);
                            reader.onerror = reject;
                            reader.readAsDataURL(blob);
                        } else {
                            quality -= 0.1;
                            tryCompression();
                        }
                    }, 'image/jpeg', quality);
                };
                tryCompression();
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
}
