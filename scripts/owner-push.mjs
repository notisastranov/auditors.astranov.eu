#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OWNER = 'notisastranov';
const REPO = 'auditors.astranov.eu';
const BRANCH = 'main';
const USER = 'notisastranov';
const CACHE_FILE = path.join(ROOT, 'scripts', '.owner-token-cache');

function tokenFromCredentialManager() {
  const r = spawnSync('git', ['-c', 'credential.https://github.com.helper=manager', 'credential', 'fill'], {
    input: `protocol=https\nhost=github.com\nusername=${USER}\n\n`,
    encoding: 'utf8',
    timeout: 15000,
  });
  return (r.stdout || '').match(/^password=(.+)$/m)?.[1]?.trim() || null;
}

function getToken() {
  const env = process.env.ASTRANOV_GITHUB_TOKEN || process.env.GITHUB_TOKEN || '';
  if (/^gh[oprsu]_/.test(env)) return env.trim();
  try {
    const t = fs.readFileSync(CACHE_FILE, 'utf8').trim();
    if (/^gh[oprsu]_/.test(t)) return t;
  } catch (_) {}
  return tokenFromCredentialManager();
}

async function gh(apiPath, { method = 'GET', body, token }) {
  const r = await fetch(`https://api.github.com${apiPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${apiPath} → ${r.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

async function pushFile(token, filePath) {
  const full = path.join(ROOT, filePath);
  const content = fs.readFileSync(full, 'utf8');
  const b64 = Buffer.from(content, 'utf8').toString('base64');
  let sha;
  try {
    const cur = await gh(`/repos/${OWNER}/${REPO}/contents/${filePath}?ref=${BRANCH}`, { token });
    sha = cur.sha;
  } catch (_) {}
  return gh(`/repos/${OWNER}/${REPO}/contents/${filePath}`, {
    method: 'PUT',
    token,
    body: { message: `deploy ${filePath}`, content: b64, branch: BRANCH, ...(sha ? { sha } : {}) },
  });
}

const files = process.argv.slice(2);
if (!files.length) {
  console.error('Usage: node scripts/owner-push.mjs <files...>');
  process.exit(1);
}

const token = getToken();
if (!token) {
  console.error('No GitHub token');
  process.exit(1);
}

const results = [];
for (const f of files) {
  results.push({ path: f, commit: (await pushFile(token, f)).commit.sha });
}
console.log(JSON.stringify({ ok: true, owner: OWNER, repo: REPO, branch: BRANCH, results }));