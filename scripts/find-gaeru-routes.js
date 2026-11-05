const fs = require('fs');
const content = fs.readFileSync('../gaeru/src/app.js', 'utf8');
const lines = content.split('\n');
console.log('--- ALL API ROUTES IN GAERU/SRC/APP.JS ---');
lines.forEach((l, idx) => {
  if (l.includes("app.use('/api") || l.includes('app.use("/api') || l.includes("app.get('/api") || l.includes("app.post('/api")) {
    console.log((idx + 1) + ': ' + l.trim());
  }
});
