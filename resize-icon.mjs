import sharp from 'sharp';

const sourceImage = './public/icon.png';

const metadata = await sharp(sourceImage).metadata();
console.log(`Source: ${metadata.width}x${metadata.height}`);

const sizes = [
  { size: 180, path: './public/apple-touch-icon.png' },
  { size: 192, path: './public/icon-192.png' },
  { size: 512, path: './public/icon-512.png' },
  { size: 1024, path: './ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png' },
];

for (const { size, path } of sizes) {
  await sharp(sourceImage)
    .resize(size, size)
    .png()
    .toFile(path);

  console.log(`Created ${path} (${size}x${size})`);
}

console.log('\nAll icons generated. Rebuild the app to see the updated icon.');
