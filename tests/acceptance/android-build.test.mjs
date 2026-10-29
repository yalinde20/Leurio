import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../helpers/run.mjs';
import { spawnSync } from 'node:child_process';

// Nécessite le SDK Android : exécuté en CI (pas de skip silencieux).
test('critère 2 : given le dossier android, when on lance le build debug Android, then il produit un APK sans erreur', () => {
  const dir = join(ROOT, 'android');
  assert.ok(existsSync(dir), 'le dossier android n\'existe pas');
  assert.ok(existsSync(join(dir, 'gradlew')), 'android/gradlew est absent');
  const r = spawnSync('./gradlew', ['assembleDebug', '--no-daemon'], { cwd: dir, encoding: 'utf8', timeout: 1_800_000 });
  assert.equal(r.status, 0, `assembleDebug a échoué : ${r.stdout ?? ''}${r.stderr ?? ''}${r.error ?? ''}`);
  assert.ok(existsSync(join(dir, 'app/build/outputs/apk/debug/app-debug.apk')), 'app-debug.apk est absent');
});
