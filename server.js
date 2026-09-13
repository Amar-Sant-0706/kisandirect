// ==============================================================================
// KisanDirect AI - Root Entry Point Proxy
// Forwards execution to server/server.js to guarantee seamless deployment
// on platforms where startCommand is configured as "node server.js"
// ==============================================================================

require('./server/server.js');
