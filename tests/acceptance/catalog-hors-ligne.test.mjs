// US 40 : le contenu embarqué reste disponible hors ligne après la première visite (PLAN §4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../helpers/run.mjs';

test('given ngsw-config.json, when on le lit, then /assets/data/** est préchargé par un groupe placé avant le groupe paresseux des assets', () => {
  const groupes = JSON.parse(readFileSync(join(ROOT, 'ngsw-config.json'), 'utf8')).assetGroups;
  const iContenu = groupes.findIndex((g) => g.resources?.files?.includes('/assets/data/**'));
  assert.notEqual(iContenu, -1, 'aucun groupe ne déclare /assets/data/**');
  assert.equal(groupes[iContenu].installMode, 'prefetch');
  const iAssets = groupes.findIndex((g) => g.resources?.files?.includes('/assets/**'));
  assert.ok(iAssets === -1 || iContenu < iAssets, 'le groupe du contenu doit précéder celui de /assets/** (le premier qui correspond l\'emporte)');
});

test('US 293 : given ngsw-config.json, when on le lit, then /assets/pictogrammes/** est préchargé par un groupe placé avant le groupe paresseux des assets', () => {
  const groupes = JSON.parse(readFileSync(join(ROOT, 'ngsw-config.json'), 'utf8')).assetGroups;
  const iPictogrammes = groupes.findIndex((g) => g.resources?.files?.includes('/assets/pictogrammes/**'));
  assert.notEqual(iPictogrammes, -1, 'aucun groupe ne déclare /assets/pictogrammes/**');
  assert.equal(groupes[iPictogrammes].installMode, 'prefetch');
  const iAssets = groupes.findIndex((g) => g.resources?.files?.includes('/assets/**'));
  assert.ok(iAssets === -1 || iPictogrammes < iAssets, 'le groupe des pictogrammes doit précéder celui de /assets/**');
});
