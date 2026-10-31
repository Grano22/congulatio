const ACCEPTED = /^image\/(png|jpeg|webp|gif|avif|bmp)$/;

export class AvatarError extends Error {}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> =>
  new Promise((resolve) => canvas.toBlob(resolve, type, quality));

export async function squareAvatar(file: File, side: number, maxBytes: number): Promise<Blob> {
  if (!ACCEPTED.test(file.type)) throw new AvatarError('Choose a PNG, JPEG, WebP, GIF or AVIF picture.');
  if (file.size > 20 * 1024 * 1024) throw new AvatarError('That picture is larger than 20 MiB.');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new AvatarError('That picture could not be read.');
  }
  const crop = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = side;
  canvas.height = side;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new AvatarError('This browser cannot resize pictures.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, (bitmap.width - crop) / 2, (bitmap.height - crop) / 2, crop, crop, 0, 0, side, side);
  bitmap.close();
  for (const quality of [0.88, 0.75, 0.6]) {
    const blob = (await toBlob(canvas, 'image/webp', quality)) ?? (await toBlob(canvas, 'image/jpeg', quality));
    if (blob && blob.size <= maxBytes) return blob;
  }
  throw new AvatarError('The picture is still too large after resizing.');
}

export const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
