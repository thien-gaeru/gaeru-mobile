const fs = require('fs');
const path = require('path');

console.log('--- GAERU Mobile App Build Pre-check ---');
const wwwDir = path.join(__dirname, '..', 'www');
const requiredFiles = ['index.html', 'app.css', 'app.js', 'assets/brand/gaeru-logo.webp'];

let hasError = false;
for (const file of requiredFiles) {
  const fullPath = path.join(wwwDir, file);
  if (fs.existsSync(fullPath)) {
    console.log(`[OK] ${file}`);
  } else {
    console.error(`[MISSING] ${file}`);
    hasError = true;
  }
}

if (hasError) {
  console.error('\nBuild failed: Missing essential files.');
  process.exit(1);
}

console.log('\nApp Shell ready in www/! You can now run:');
console.log('  npm run cap:sync');
console.log('  npm run cap:open:android');
console.log('  npm run cap:open:ios');
