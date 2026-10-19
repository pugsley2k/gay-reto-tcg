// Reuse the storefront's outlined letterforms; no fonts or external services required.
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');
async function main() {
  const root = path.resolve(__dirname, '..');
  const wordmark = await fs.readFile(path.join(root, 'public/brand-wordmark.svg'), 'utf8');
  const glyphs = [...wordmark.matchAll(/<path d="([^"]+)"/g)].map(match => match[1]);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="26" fill="#191b20"/><g fill="#FAEAC4" transform="translate(7 0) skewX(-8)"><path d="${glyphs[0]}" transform="translate(17 101) scale(.044 -.044)"/><path d="${glyphs[3]}" transform="translate(67 101) scale(.044 -.044)"/></g></svg>\n`;
  await fs.writeFile(path.join(root, 'public/favicon.svg'), svg);
  for (const [filename, size] of [['favicon.png',96],['apple-touch-icon.png',180],['android-chrome-192x192.png',192],['android-chrome-512x512.png',512]]) {
    await sharp(Buffer.from(svg)).resize(size,size).png().toFile(path.join(root,'public',filename));
  }
  const images = await Promise.all([16,32,48].map(size=>sharp(Buffer.from(svg)).resize(size,size).png().toBuffer()));
  const header=Buffer.alloc(6+images.length*16); header.writeUInt16LE(1,2); header.writeUInt16LE(images.length,4);
  let offset=header.length;
  images.forEach((image,index)=>{const entry=6+index*16;header[entry]=[16,32,48][index];header[entry+1]=header[entry];header.writeUInt16LE(1,entry+4);header.writeUInt16LE(32,entry+6);header.writeUInt32LE(image.length,entry+8);header.writeUInt32LE(offset,entry+12);offset+=image.length;});
  await fs.writeFile(path.join(root,'app/favicon.ico'),Buffer.concat([header,...images]));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
