const http = require('http');

function check(url, tests) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`Testing ${url} (Status: ${res.statusCode}, Length: ${data.length} bytes)`);
        let allPassed = true;
        for (const [desc, snippet] of Object.entries(tests)) {
          const ok = data.includes(snippet);
          console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${desc}`);
          if (!ok) allPassed = false;
        }
        resolve(allPassed);
      });
    }).on('error', (err) => {
      console.error(`Error requesting ${url}:`, err.message);
      resolve(false);
    });
  });
}

async function run() {
  console.log('=== VERIFYING STORE & LOGIN UNIFIED INTERFACE ===');

  const storePassed = await check('http://localhost:3000/store.html', {
    'KisanVani Nav Button': 'id="kisanVaniNavBtn"',
    'AI Scanner Nav Button': 'id="aiScannerNavBtn"',
    'Sell Crops Nav Button': 'id="navSellProduceBtn"',
    'User Auth Container': 'id="navUserContainer"',
    'Store Login Modal': 'id="storeLoginModal"',
    'KisanVani Modal': 'id="kisanVaniModal"',
    'AI Quality Scanner Modal': 'id="aiQualityScannerModal"',
    'gateSellProduceAction Function': 'gateSellProduceAction',
    'gateBuyProduceAction Function': 'gateBuyProduceAction',
    'Equalizer Waveform': 'class="voice-equalizer-container',
    'AI Scan Laser': 'class="scanner-laser-line"'
  });

  const loginPassed = await check('http://localhost:3000/login.html', {
    'Data Theme Support': 'data-theme',
    'Theme Toggle': 'id="themeToggleBtn"',
    'Farmer Quick Login': 'farmer@kisandirect.gov.in',
    'Buyer Quick Login': 'procurement@reliancefresh.com',
    'Owner Quick Login': 'owner@kisandirect.com',
    'Registration Form': 'id="registerView"'
  });

  const indexPassed = await check('http://localhost:3000/', {
    'Root Mounts SPA & Has App Container': 'id="app"'
  });

  console.log('\n=== VERIFICATION RESULT ===');
  console.log('store.html UI elements:', storePassed ? 'ALL PASSED' : 'SOME FAILED');
  console.log('login.html UI elements:', loginPassed ? 'ALL PASSED' : 'SOME FAILED');
  console.log('index.html static mount:', indexPassed ? 'ALL PASSED' : 'SOME FAILED');

  process.exit(storePassed && loginPassed && indexPassed ? 0 : 1);
}

run();
