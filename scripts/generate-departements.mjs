// Génère src/assets/data/departements.json (US 58) : contours simplifiés des départements de la France
// métropolitaine, embarqués dans l'app pour trouver un département sans réseau.
// Source : https://github.com/gregoiredavid/france-geojson (departements-version-simplifiee.geojson ;
// tracés IGN Admin Express COG 2018, Licence Ouverte Etalab).
// Usage : node scripts/generate-departements.mjs <departements-version-simplifiee.geojson> [dateVerif AAAA-MM-JJ]
// (dateVerif : par défaut la date du jour)
// Simplification : Douglas-Peucker (0,0015°, soit ~150 m), coordonnées arrondies à 4 décimales (~10 m).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOLERANCE = 0.0015;
const entree = process.argv[2];
if (!entree) {
  console.error('Usage : node scripts/generate-departements.mjs <departements-version-simplifiee.geojson>');
  process.exit(1);
}
const sortie = join(dirname(fileURLToPath(import.meta.url)), '..', 'src/assets/data/departements.json');

/** Distance au carré d'un point à un segment (en degrés, suffisant pour une simplification). */
function distance2(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
  const ex = p[0] - (a[0] + t * dx);
  const ey = p[1] - (a[1] + t * dy);
  return ex * ex + ey * ey;
}

/** Douglas-Peucker itératif sur une ligne ouverte. */
function simplifier(points, tolerance) {
  const garde = new Array(points.length).fill(false);
  garde[0] = garde[points.length - 1] = true;
  const pile = [[0, points.length - 1]];
  while (pile.length) {
    const [i, j] = pile.pop();
    let max = 0;
    let indice = -1;
    for (let k = i + 1; k < j; k++) {
      const d = distance2(points[k], points[i], points[j]);
      if (d > max) { max = d; indice = k; }
    }
    if (indice !== -1 && max > tolerance * tolerance) {
      garde[indice] = true;
      pile.push([i, indice], [indice, j]);
    }
  }
  return points.filter((_, k) => garde[k]);
}

const arrondi = (n) => Math.round(n * 1e4) / 1e4;

/** Anneau fermé simplifié ; coupé en deux pour que le premier point ne soit pas figé ; null si dégénéré. */
function anneau(points) {
  const m = Math.floor(points.length / 2);
  const ouvert = points.slice(0, -1);
  const a = simplifier(ouvert.slice(0, m + 1), TOLERANCE);
  const b = simplifier([...ouvert.slice(m), ouvert[0]], TOLERANCE);
  const arrondis = [...a, ...b.slice(1)].map(([x, y]) => [arrondi(x), arrondi(y)]);
  const sansDoublon = arrondis.filter((p, i) => i === 0 || p[0] !== arrondis[i - 1][0] || p[1] !== arrondis[i - 1][1]);
  return sansDoublon.length >= 4 ? sansDoublon : null;
}

const geojson = JSON.parse(readFileSync(entree, 'utf8'));
const departements = geojson.features.map((f) => {
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const polygones = polys
    .map((rings) => {
      const [exterieur, ...trous] = rings.map(anneau);
      return exterieur ? [exterieur, ...trous.filter(Boolean)] : null;
    })
    .filter(Boolean);
  return { code: f.properties.code, nom: f.properties.nom, polygones };
});
departements.sort((a, b) => a.code.localeCompare(b.code));

const contenu = {
  sources: [
    'https://github.com/gregoiredavid/france-geojson',
    'https://geoservices.ign.fr/adminexpress',
    'IGN Admin Express COG, édition 2018 (codes INSEE COG 2018), Licence Ouverte Etalab 2.0, via france-geojson (Grégoire David)',
  ],
  dateVerif: process.argv[3] ?? new Date().toISOString().slice(0, 10),
  departements,
};
writeFileSync(sortie, JSON.stringify(contenu) + '\n');
console.log(`${departements.length} départements écrits dans ${sortie}`);
