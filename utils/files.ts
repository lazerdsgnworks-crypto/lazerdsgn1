// @ts-ignore
import { PDFDocument } from 'pdf-lib/dist/pdf-lib.esm.js';
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist/build/pdf';

// You might need to host this worker file on your own server for production
// FIX: Resolved "Invalid URL" TypeError by providing a full, absolute URL to the PDF.js worker. This ensures the worker can be located correctly from the CDN, bypassing issues with relative path resolution via `import.meta.url`.
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://aistudiocdn.com/pdfjs-dist@^5.4.296/build/pdf.worker.mjs';

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

/**
 * Encodes raw PCM audio data into a valid WAV file format.
 * @param pcmData The raw audio data.
 * @param sampleRate The sample rate of the audio (e.g., 24000).
 * @param numChannels The number of audio channels (e.g., 1 for mono).
 * @param bitsPerSample The number of bits per sample (e.g., 16).
 * @returns A Blob representing the WAV file.
 */
export function pcmToWav(pcmData: Uint8Array, sampleRate: number, numChannels: number, bitsPerSample: number): Blob {
    const dataSize = pcmData.length;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    const writeString = (offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };

    const blockAlign = numChannels * (bitsPerSample / 8);
    const byteRate = sampleRate * blockAlign;

    // RIFF header
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true); // chunkSize
    writeString(8, 'WAVE');

    // fmt chunk
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // audioFormat (1 for PCM)
    view.setUint16(22, numChannels, true); // numChannels
    view.setUint32(24, sampleRate, true); // sampleRate
    view.setUint32(28, byteRate, true); // byteRate
    view.setUint16(32, blockAlign, true); // blockAlign
    view.setUint16(34, bitsPerSample, true); // bitsPerSample

    // data chunk
    writeString(36, 'data');
    view.setUint32(40, dataSize, true); // subchunk2Size

    // Write PCM data
    const pcmAsDataView = new Uint8Array(pcmData.buffer);
    for (let i = 0; i < dataSize; i++) {
        view.setUint8(44 + i, pcmAsDataView[i]);
    }

    return new Blob([view], { type: 'audio/wav' });
}