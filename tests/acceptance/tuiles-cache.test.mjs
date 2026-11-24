// US 17 : les tuiles OpenStreetMap gardées par le service worker tiennent la zone des spots (PLAN §4, §10 phase 5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../helpers/run.mjs';

test('given ngsw-config.json, when on lit le groupe tuiles-osm, then il garde jusqu\'à 3000 tuiles pendant 30 jours', () => {
  const groupe = JSON.parse(readFileSync(join(ROOT, 'ngsw-config.json'), 'utf8')).dataGroups.find((g) => g.name === 'tuiles-osm');
  assert.ok(groupe, 'le groupe tuiles-osm est absent');
  assert.deepEqual(groupe.urls, ['https://tile.openstreetmap.org/**']);
  assert.equal(groupe.cacheConfig.maxSize, 3000);
  assert.equal(groupe.cacheConfig.maxAge, '30d');
});
