// Keep phone photos below hosted request limits while preserving the printed card number.
export async function prepareCardPhoto(file: File): Promise<File> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Choose a JPG, PNG or WebP photo. On iPhone, use a compatible camera format.');
  }
  if (file.size === 0 || file.size > 20 * 1024 * 1024) throw new Error('Choose a photo under 20 MB.');
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser could not prepare this photo.');
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Could not prepare this photo.')), 'image/jpeg', .9));
    if (blob.size > 4 * 1024 * 1024) throw new Error('This photo is too large. Try a closer photo of the card.');
    return new File([blob], 'card-photo.jpg', { type: 'image/jpeg' });
  } finally { bitmap.close(); }
}
