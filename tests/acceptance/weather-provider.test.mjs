// US 49, critère 4 : Open-Meteo n'est mentionné que dans son implémentation et ses tests (PLAN §4 : WeatherProvider).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../helpers/run.mjs';

const IMPLEMENTATION = 'src/app/core/data/open-meteo.service.ts';
const AUTORISES = [IMPLEMENTATION, 'src/app/core/data/open-meteo.service.spec.ts'];
const MENTION = /open[-_ ]?meteo/i;
// Seules lignes tolérées dans app.config.ts : l'import de la classe et son câblage sur WeatherProvider.
const CABLAGE = [
  "import { OpenMeteoService } from './core/data/open-meteo.service';",
  '{ provide: WeatherProvider, useClass: OpenMeteoService },',
];

function fichiers(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? fichiers(p) : [p];
  });
}

test('critère 4 : given l\'implémentation Open-Meteo, when on lit son fichier, then elle existe et appelle api.open-meteo.com', () => {
  assert.ok(existsSync(join(ROOT, IMPLEMENTATION)), `${IMPLEMENTATION} manque`);
  assert.match(readFileSync(join(ROOT, IMPLEMENTATION), 'utf8'), /api\.open-meteo\.com/);
});

test('critère 4 : given weather-provider.ts, when on le lit, then il existe et ne mentionne pas Open-Meteo', () => {
  const f = join(ROOT, 'src/app/core/data/weather-provider.ts');
  assert.ok(existsSync(f), 'src/app/core/data/weather-provider.ts manque');
  assert.doesNotMatch(readFileSync(f, 'utf8'), MENTION);
});

test('critère 4 : given le code source de l\'app, when on cherche une mention d\'Open-Meteo hors de son implémentation et de ses tests, then aucune mention n\'est trouvée', () => {
  const trouves = [];
  for (const f of fichiers(join(ROOT, 'src'))) {
    const rel = f.replace(`${ROOT}/`, '');
    if (AUTORISES.includes(rel)) continue;
    let texte;
    try { texte = readFileSync(f, 'utf8'); } catch { continue; }
    if (texte.includes('\0')) continue;
    // Mention dans le nom du fichier ou dans son contenu. app.config.ts nomme la classe OpenMeteoService (câblage) : seule exception.
    const lignes = texte.split('\n').flatMap((l, i) => (MENTION.test(l) ? [`${rel}:${i + 1}: ${l.trim()}`] : []));
    if (MENTION.test(rel)) trouves.push(rel);
    if (rel === 'src/app/app.config.ts') {
      trouves.push(...lignes.filter((l) => !CABLAGE.includes(l.slice(l.indexOf(': ') + 2))));
    } else {
      trouves.push(...lignes);
    }
  }
  assert.deepEqual(trouves, [], `Mentions d'Open-Meteo hors de l'implémentation :\n${trouves.join('\n')}`);
});

test('critère 0 : given app.config.ts, when on le lit, then WeatherProvider est fourni par OpenMeteoService', () => {
  const texte = readFileSync(join(ROOT, 'src/app/app.config.ts'), 'utf8');
  assert.match(texte, /provide:\s*WeatherProvider\s*,\s*useClass:\s*OpenMeteoService/);
});
