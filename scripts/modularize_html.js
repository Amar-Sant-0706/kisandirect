const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(filePath, 'utf8');

const toastMarker = 'id="toastContainer"></div>';
const bodyCloseMarker = '</body>';

const toastIdx = html.indexOf(toastMarker);
const bodyCloseIdx = html.lastIndexOf(bodyCloseMarker);

if (toastIdx === -1 || bodyCloseIdx === -1) {
  console.error("Markers not found! Toast:", toastIdx, "Body:", bodyCloseIdx);
  process.exit(1);
}

// Find the <script> right after toastContainer
const scriptStartIdx = html.indexOf('<script>', toastIdx);
// Find the </script> right before </body>
const scriptEndIdx = html.lastIndexOf('</script>', bodyCloseIdx);

if (scriptStartIdx === -1 || scriptEndIdx === -1) {
  console.error("Script tags not found! Start:", scriptStartIdx, "End:", scriptEndIdx);
  process.exit(1);
}

const modularScripts = `  <!-- Modular KisanDirect AI Application Scripts -->
  <script src="js/data.js"></script>
  <script src="js/marketplace.js"></script>
  <script src="js/ai-vision.js"></script>
  <script src="js/ai-forecasting.js"></script>
  <script src="js/route-optimizer.js"></script>
  <script src="js/doca-monitor.js"></script>
  <script src="js/app.js"></script>`;

const newHtml = html.substring(0, scriptStartIdx) + modularScripts + '\n\n' + html.substring(scriptEndIdx + 9);
fs.writeFileSync(filePath, newHtml, 'utf8');

console.log("Successfully replaced inlined script block with modular script tags!");
console.log("Old length:", html.length, "New length:", newHtml.length);
