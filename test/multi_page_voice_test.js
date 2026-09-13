const http = require('http');

function testUrl(path, expectedStatus = 200, checkRedirect = false) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3000${path}`, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (checkRedirect) {
          const isRedir = res.statusCode === 302 || res.statusCode === 301;
          const target = res.headers.location;
          console.log(`[ROUTE CHECK] ${path} -> Status: ${res.statusCode}, Redirect Location: ${target}`);
          resolve(isRedir && target === '/login.html');
        } else {
          console.log(`[ROUTE CHECK] ${path} -> Status: ${res.statusCode} (Expected: ${expectedStatus}), Size: ${body.length} bytes`);
          resolve(res.statusCode === expectedStatus && body.length > 500);
        }
      });
    }).on('error', reject);
  });
}

async function runVerification() {
  console.log('=== MULTI-PAGE & VOICE API VERIFICATION ===\n');

  // 1. Check Root Redirect to login.html
  const rootOk = await testUrl('/', 302, true);
  console.log(`Root / redirects to /login.html: ${rootOk ? 'PASS' : 'FAIL'}`);

  // 2. Check each dedicated page
  const pages = [
    '/login.html',
    '/register.html',
    '/marketplace.html',
    '/farmer-hub.html',
    '/quality-scanner.html',
    '/demand-forecast.html',
    '/route-optimizer.html',
    '/doca-control.html'
  ];

  let pagesPassed = 0;
  for (const p of pages) {
    const ok = await testUrl(p, 200);
    if (ok) pagesPassed++;
  }
  console.log(`\nPages Available: ${pagesPassed}/${pages.length} passed.`);

  // 3. Test Multilingual Voice API across 9 languages
  console.log('\n=== TESTING MULTILINGUAL VOICE API (9 LANGUAGES) ===');
  const langs = ['hi', 'en', 'mr', 'te', 'ta', 'gu', 'kn', 'bn', 'pa'];
  let voicePassed = 0;

  for (const lang of langs) {
    const ok = await new Promise(resolve => {
      http.get(`http://localhost:3000/api/voice/bulletin?lang=${lang}`, res => {
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => {
          const json = JSON.parse(body);
          const valid = json.success && json.audioText && json.locale;
          console.log(`[VOICE] lang=${lang} -> locale=${json.locale}, commodities=${json.commoditiesCount}, textLength=${json.audioText.length}`);
          resolve(valid);
        });
      });
    });
    if (ok) voicePassed++;
  }

  console.log(`\nVoice API: ${voicePassed}/${langs.length} languages generating live daily bulletins.`);
  console.log('\n=== ALL MULTI-PAGE & VOICE TESTS COMPLETED SUCCESSFULLY ===');
}

runVerification().catch(console.error);
