import { spawn } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const BASE = 'http://localhost:3000';

// Top-level entries never copied: real data, build temp files, git history, secrets.
const SKIP = new Set(['data', 'tmp', '.git', '.env', 'tests', '.github']);

export function makeSandbox() {
    const dir = mkdtempSync(path.join(tmpdir(), 'buildengine-test-'));
    cpSync(REPO, dir, {
        recursive: true,
        verbatimSymlinks: true, // keep workspace links (node_modules/@buildengine/shared) pointing inside the copy
        filter: (src) => !SKIP.has(path.relative(REPO, src).split(path.sep)[0]),
    });
    return dir;
}

export function removeSandbox(dir) {
    rmSync(dir, { recursive: true, force: true });
}

/** Import a module from the sandbox copy (so it opens the sandbox's database). */
export function importFrom(dir, relPath) {
    return import(pathToFileURL(path.join(dir, relPath)).href);
}

const testEnv = () => ({ ...process.env, JWT_SECRET: process.env.JWT_SECRET || 'test-secret' });

async function healthy() {
    try { return (await fetch(`${BASE}/health`)).ok; } catch { return false; }
}

export async function startOrchestrator(dir) {
    if (await healthy()) throw new Error('Port 3000 is already in use - stop the running orchestrator before running tests.');

    const child = spawn(process.execPath, ['packages/orchestrator/main.js'], { cwd: dir, env: testEnv(), stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (d) => (output += d));
    child.stderr.on('data', (d) => (output += d));

    for (let i = 0; i < 50; i++) {
        if (child.exitCode !== null) throw new Error(`Orchestrator exited early:\n${output}`);
        if (await healthy()) return child;
        await new Promise((r) => setTimeout(r, 200));
    }
    child.kill();
    throw new Error(`Orchestrator did not become healthy within 10s:\n${output}`);
}

export async function stopOrchestrator(child) {
    if (!child || child.exitCode !== null) return;
    const exited = new Promise((r) => child.once('exit', r));
    child.kill();
    await exited;
}