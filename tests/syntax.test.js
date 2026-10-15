import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { REPO } from './helpers/sandbox.js';

const files = readdirSync(path.join(REPO, 'packages'), { recursive: true })
    .filter((f) => f.endsWith('.js') && !f.split(path.sep).includes('node_modules'))
    .map((f) => path.join(REPO, 'packages', f));

test('found JS files to check', () => {
    assert.ok(files.length > 0);
});

for (const file of files) {
    test(`syntax: ${path.relative(REPO, file)}`, () => {
        const r = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
        assert.equal(r.status, 0, r.stderr);
    });
}