// ==============================================================================
// KisanDirect AI - Mobile Responsiveness & Layout Safety Verification Script
// Audits store.html, index.html, and login.html for:
// 1. Meta viewport tag configuration
// 2. Global html/body overflow-x and max-width safety rules
// 3. Media elements max-width rule
// 4. Header action strip responsive classes (icons with hidden text on mobile)
// 5. Ticker responsive flex-1 and min-w-0 truncation
// 6. Main container bottom padding pb-24 md:pb-8 (so bottom nav doesn't cover content)
// 7. Modals mobile padding and responsive flexbox wrappers
// 8. Produce cards compact responsive button styles
// ==============================================================================

const fs = require('fs');
const path = require('path');

const storeHtml = fs.readFileSync(path.join(__dirname, '..', 'store.html'), 'utf8');
const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const loginHtml = fs.readFileSync(path.join(__dirname, '..', 'login.html'), 'utf8');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

console.log('=== VERIFYING MOBILE RESPONSIVENESS & ZERO-OVERFLOW SAFEGUARDS ===\n');

console.log('--- 1. Viewport Meta & Global Safety CSS ---');
assert(storeHtml.includes('name="viewport" content="width=device-width, initial-scale=1.0'), 'store.html has mobile viewport meta tag');
assert(storeHtml.includes('html, body {\n      overflow-x: hidden;\n      max-width: 100vw;'), 'store.html has html, body overflow-x: hidden & max-width: 100vw');
assert(storeHtml.includes('img, svg, video {\n      max-width: 100%;\n      height: auto;\n    }'), 'store.html constrains all media to max-width: 100%');
assert(loginHtml.includes('html, body {\n      overflow-x: hidden;\n      max-width: 100vw;'), 'login.html has html, body overflow-x: hidden & max-width: 100vw');

console.log('\n--- 2. Top Live Mandi Ticker Bar ---');
assert(storeHtml.includes('min-w-0 flex-1 overflow-hidden'), 'store.html ticker has min-w-0 flex-1 overflow-hidden');
assert(storeHtml.includes('text-[10px] sm:text-[11px] md:text-xs truncate'), 'store.html ticker text scales down on mobile');
assert(storeHtml.includes('id="themeToggleBtn"') && storeHtml.includes('px-2 sm:px-2.5'), 'store.html theme toggle button has compact padding on mobile');
assert(storeHtml.includes('id="languageSelect"') && storeHtml.includes('px-1.5 sm:px-2'), 'store.html language selector dropdown has compact padding on mobile');

console.log('\n--- 3. Brand Header & Compact Action Strip ---');
assert(storeHtml.includes('text-base sm:text-xl md:text-2xl font-black'), 'Brand title scales gracefully on mobile');
assert(storeHtml.includes('id="brandTagline"') && storeHtml.includes('hidden sm:block'), 'Brand tagline is hidden on mobile to conserve header width');
assert(storeHtml.includes('w-8 h-8 sm:w-auto') && storeHtml.includes('px-0 sm:px-3'), 'KisanVani button shrinks to icon-only circle on mobile');
assert(storeHtml.includes('id="aiScannerNavBtn"') && storeHtml.includes('hidden md:inline'), 'AI Scanner button hides label text on mobile');
assert(storeHtml.includes('id="navSellProduceBtn"') && storeHtml.includes('hidden sm:inline-flex'), 'Sell Crops button hides on small mobile screens to keep header under 325px');
assert(storeHtml.includes('max-w-[75px] sm:max-w-[120px]'), 'Nav user profile name truncates at 75px on mobile');

console.log('\n--- 4. Main Container & Mobile Clearance ---');
assert(storeHtml.includes('<main class="max-w-7xl mx-auto px-3 sm:px-4 pt-3 sm:pt-4 pb-24 md:pb-8">'), 'Main container has pb-24 md:pb-8 clearance for fixed mobile bottom nav');

console.log('\n--- 5. Produce Cards Grid & Responsive Action Buttons ---');
assert(storeHtml.includes('grid grid-cols-2 md:grid-cols-4'), 'Produce catalog renders 2 columns on mobile, 4 on desktop');
const orderBtnMatches = (storeHtml.match(/theme-btn-cta font-black text-\[10px\] sm:text-xs rounded-xl py-1\.5 sm:py-2 px-1/g) || []).length;
assert(orderBtnMatches >= 8, `All produce card ORDER buttons use text-[10px] sm:text-xs py-1.5 sm:py-2 (found ${orderBtnMatches})`);
const contactBtnMatches = (storeHtml.match(/border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-700 font-bold text-\[10px\] sm:text-xs rounded-xl py-1\.5 sm:py-2 px-1/g) || []).length;
assert(contactBtnMatches >= 8, `All produce card CONTACT buttons use text-[10px] sm:text-xs py-1.5 sm:py-2 (found ${contactBtnMatches})`);

console.log('\n--- 6. Modals Mobile Responsiveness ---');
assert(storeHtml.includes('id="farmerContactModal"') && storeHtml.includes('py-2.5 sm:py-3 px-2 sm:px-4 rounded-xl font-bold text-[11px] sm:text-xs'), 'Farmer Contact modal buttons scale with text-[11px] sm:text-xs');
assert(storeHtml.includes('flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 bg-slate-50 p-2.5 rounded-xl'), 'My Listed Crops modal ribbon uses flex-col on mobile');
assert(storeHtml.includes('id="cartModal"') && storeHtml.includes('w-full max-w-full sm:max-w-md'), 'Cart modal drawer expands to 100% width on mobile');
assert(storeHtml.includes('id="storeLoginModal"') && storeHtml.includes('p-3 sm:p-4'), 'Store Login modal has responsive padding');
assert(storeHtml.includes('id="storeTabFarmer"') && storeHtml.includes('text-[10px] sm:text-xs font-bold'), 'Store Login role tabs have responsive text-[10px] sm:text-xs');
assert(storeHtml.includes('id="kisanVaniModal"') && storeHtml.includes('flex flex-col sm:flex-row sm:items-center justify-between'), 'KisanVani modal commodity filter uses responsive flex layout');
assert(storeHtml.includes('id="voiceRoleFarmer"') && storeHtml.includes('text-[10px] sm:text-xs font-bold'), 'KisanVani voice persona buttons have responsive text-[10px] sm:text-xs');
assert(storeHtml.includes('id="aiQualityScannerModal"') && storeHtml.includes('p-3 sm:p-4'), 'AI Quality Scanner modal has responsive padding');

console.log('\n--- 7. Synchronization with index.html ---');
assert(indexHtml === storeHtml, 'root index.html is 100% identical to store.html');

console.log(`\n==================================================================`);
console.log(`MOBILE RESPONSIVENESS AUDIT: ${passed} PASSED, ${failed} FAILED`);
console.log(`==================================================================\n`);

if (failed > 0) process.exit(1);
