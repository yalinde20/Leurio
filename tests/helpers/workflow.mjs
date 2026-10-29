import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, run } from './run.mjs';

export const WORKFLOW = '.github/workflows/ci.yml';

const unquote = (s) => s.trim().replace(/^(['"])(.*)\1$/, '$2');
const indent = (l) => l.length - l.trimStart().length;
const significant = (l) => l.trim() !== '' && !l.trim().startsWith('#');

/** Lit le fichier du workflow (texte brut). */
export function readWorkflowText() {
  const file = join(ROOT, WORKFLOW);
  if (!existsSync(file)) throw new Error(`${WORKFLOW} est absent`);
  return readFileSync(file, 'utf8');
}

/** Bloc enfant d'une clé de premier niveau (lignes plus indentées que la clé). */
function block(lines, key, baseIndent = 0) {
  const i = lines.findIndex((l) => significant(l) && indent(l) === baseIndent && l.trim().startsWith(`${key}:`));
  if (i < 0) return null;
  const out = [lines[i]];
  for (let j = i + 1; j < lines.length; j++) {
    if (significant(lines[j]) && indent(lines[j]) <= baseIndent) break;
    out.push(lines[j]);
  }
  return out;
}

/** Déclencheurs : { push: { branches: [...] } | null, pull_request: {} | null }. */
export function parseTriggers(text) {
  const lines = text.split('\n');
  const on = block(lines, 'on') ?? block(lines, "'on'") ?? block(lines, 'true');
  const triggers = { push: null, pull_request: null };
  if (!on) return triggers;
  const first = on[0].slice(on[0].indexOf(':') + 1).trim();
  if (first) { // forme en ligne : on: [push, pull_request] ou on: push
    for (const n of first.replace(/[[\]]/g, '').split(',').map(unquote)) if (n in triggers) triggers[n] = { branches: [] };
    return triggers;
  }
  const body = on.slice(1).filter(significant);
  const childIndent = body.length ? indent(body[0]) : 0;
  for (const name of Object.keys(triggers)) {
    const b = block(on.slice(1), name, childIndent);
    if (!b) continue;
    const branches = [];
    const inline = b[0].slice(b[0].indexOf(':') + 1).trim();
    if (inline) triggers[name] = { branches };
    else {
      const br = block(b.slice(1), 'branches', b.slice(1).filter(significant).length ? indent(b.slice(1).find(significant)) : 0);
      if (br) {
        const v = br[0].slice(br[0].indexOf(':') + 1).trim();
        if (v) branches.push(...v.replace(/[[\]]/g, '').split(',').map(unquote).filter(Boolean));
        for (const l of br.slice(1)) if (l.trim().startsWith('- ')) branches.push(unquote(l.trim().slice(2)));
      }
      triggers[name] = { branches };
    }
  }
  return triggers;
}

/** Étapes (steps:) de tous les jobs, dans l'ordre : { name, uses, run, with, 'continue-on-error', if }. */
export function parseSteps(text) {
  const lines = text.split('\n');
  const steps = [];
  for (let i = 0; i < lines.length; i++) {
    if (!significant(lines[i]) || !/^\s*steps:\s*$/.test(lines[i])) continue;
    const base = indent(lines[i]);
    let cur = null;
    let sub = null; // clé 'with' en cours
    for (let j = i + 1; j < lines.length; j++) {
      const l = lines[j];
      if (!significant(l)) continue;
      if (indent(l) <= base && !l.trim().startsWith('- ')) break;
      if (indent(l) < base) break;
      let content = l.trim();
      const isItem = content.startsWith('- ') && indent(l) <= base + 2;
      if (isItem) { cur = {}; steps.push(cur); sub = null; content = content.slice(2).trim(); }
      if (!cur) continue;
      const m = content.match(/^([\w-]+):\s*(.*)$/);
      if (!m) continue;
      const [, k, v] = m;
      if (v === '|' || v === '>' || v === '|-' || v === '>-') {
        const own = indent(l) + (isItem ? 2 : 0);
        const parts = [];
        let n = j + 1;
        for (; n < lines.length; n++) {
          if (lines[n].trim() !== '' && indent(lines[n]) <= own) break;
          parts.push(lines[n].trim());
        }
        cur[k] = parts.filter(Boolean).join('\n');
        j = n - 1;
      } else if (k === 'with' && v === '') sub = 'with', cur.with = {};
      else if (sub === 'with' && indent(l) > base + 2 + 2 && !isItem) cur.with[k] = unquote(v);
      else { cur[k] = unquote(v.replace(/\s+#.*$/, '')); if (k !== 'with') sub = null; }
    }
  }
  return steps;
}

/**
 * Simule le job en local : exécute les `run:` dans l'ordre (les `uses:` sont ignorés),
 * s'arrête à la première étape en échec. `skip` : commandes non exécutées (supposées réussies).
 */
export function simulate(steps, { skip = [] } = {}) {
  const executed = [];
  for (const step of steps) {
    if (!step.run) continue;
    const label = step.name ?? step.run;
    const ignore = step['continue-on-error'] === 'true';
    if (skip.includes(step.run.trim())) { executed.push({ label, command: step.run, skipped: true }); continue; }
    const r = run('bash', ['-e', '-o', 'pipefail', '-c', step.run], 900_000);
    executed.push({ label, command: step.run, status: r.status });
    if (r.status !== 0 && !ignore) return { ok: false, failed: { label, command: step.run, output: r.output }, executed };
  }
  return { ok: true, failed: null, executed };
}
