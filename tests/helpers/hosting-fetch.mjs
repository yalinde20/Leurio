// Lancé par `firebase emulators:exec` (tests/acceptance/hosting-deploy.test.mjs) :
// interroge l'émulateur Hosting local et écrit un JSON { chemin: { status, cacheControl, corps } }.
const BASE = process.env.HOSTING_BASE ?? 'http://127.0.0.1:5000';
const chemins = ['/', '/conseil', '/boite', '/ngsw-worker.js'];
const out = {};
for (const c of chemins) {
  const r = await fetch(BASE + c);
  out[c] = { status: r.status, cacheControl: r.headers.get('cache-control'), corps: await r.text() };
}
console.log('RESULTAT:' + JSON.stringify(out));
