import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { BASE, makeSandbox, removeSandbox, startOrchestrator, stopOrchestrator } from './helpers/sandbox.js';

let dir, server, token, projectId, deploymentId;

async function api(method, path, { body, auth = true } = {}) {
    const headers = {};
    if (body) headers['Content-Type'] = 'application/json';
    if (auth && token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    let data = text;
    try { data = JSON.parse(text); } catch { /* plain text response */ }
    return { status: res.status, ok: res.ok, data };
}

before(async () => {
    dir = makeSandbox();
    server = await startOrchestrator(dir);
});

after(async () => {
    await stopOrchestrator(server);
    if (dir) removeSandbox(dir);
});

describe('health', () => {
    test('GET /health responds', async () => {
        const r = await api('GET', '/health', { auth: false });
        assert.ok(r.ok);
        assert.equal(r.data.service, 'orchestrator');
    });
});

describe('auth', () => {
    const user = { name: 'CI User', email: 'ci@example.dev', passwd: 'pw-123' };

    test('signup returns a token and user', async () => {
        const r = await api('POST', '/auth/signup', { body: user, auth: false });
        assert.equal(r.status, 201);
        assert.ok(r.data.token);
        assert.equal(r.data.user.email, user.email);
        token = r.data.token;
    });

    test('signup with an existing email is rejected', async () => {
        const r = await api('POST', '/auth/signup', { body: user, auth: false });
        assert.equal(r.status, 409);
    });

    test('login with the wrong password is rejected', async () => {
        const r = await api('POST', '/auth/login', { body: { email: user.email, passwd: 'wrong' }, auth: false });
        assert.equal(r.status, 400);
    });

    test('login with the right password returns a token', async () => {
        const r = await api('POST', '/auth/login', { body: { email: user.email, passwd: user.passwd }, auth: false });
        assert.equal(r.status, 200);
        assert.ok(r.data.token);
    });

    test('GET /auth/me returns the user', async () => {
        const r = await api('GET', '/auth/me');
        assert.equal(r.status, 200);
        assert.equal(r.data.user.email, user.email);
    });

    test('protected routes need a token', async () => {
        const r = await api('GET', '/projects', { auth: false });
        assert.equal(r.status, 401);
    });
});

describe('projects', () => {
    test('invalid project name is rejected', async () => {
        const r = await api('POST', '/projects', { body: { user_id: 1, name: 'Not Valid!', repo_url: 'https://github.com/a/b.git' } });
        assert.equal(r.status, 400);
    });

    test('missing repo_url is rejected', async () => {
        const r = await api('POST', '/projects', { body: { user_id: 1, name: 'no-repo' } });
        assert.equal(r.status, 400);
    });

    test('create a project', async () => {
        const r = await api('POST', '/projects', { body: { user_id: 1, name: 'ci-site', repo_url: 'https://github.com/a/b.git' } });
        assert.equal(r.status, 201);
        assert.equal(r.data.result.name, 'ci-site');
        assert.equal(r.data.result.spaFallback, true);
        projectId = r.data.result.id;
    });

    test('duplicate project name is rejected', async () => {
        const r = await api('POST', '/projects', { body: { user_id: 1, name: 'ci-site', repo_url: 'https://github.com/a/b.git' } });
        assert.equal(r.status, 400);
    });

    test('project appears in the list', async () => {
        const r = await api('GET', '/projects');
        assert.equal(r.status, 200);
        assert.ok(r.data.result.some((p) => p.id === projectId));
    });

    test('get project by id', async () => {
        const r = await api('GET', `/projects/${projectId}`);
        assert.equal(r.status, 200);
        assert.equal(r.data.result.id, projectId);
    });

    test('unknown project returns 404', async () => {
        const r = await api('GET', '/projects/proj_doesnotexist');
        assert.equal(r.status, 404);
    });

    test('a project with no deployments can be deleted', async () => {
        const created = await api('POST', '/projects', { body: { user_id: 1, name: 'ci-delete-me', repo_url: 'https://github.com/a/b.git' } });
        const r = await api('DELETE', `/projects/${created.data.result.id}`);
        assert.equal(r.status, 200);
        const gone = await api('GET', `/projects/${created.data.result.id}`);
        assert.equal(gone.status, 404);
    });
});

describe('deployments', () => {
    test('POST /deploy/:id queues a pending deployment', async () => {
        const r = await api('POST', `/deploy/${projectId}`);
        assert.equal(r.status, 201);
        assert.equal(r.data.status, 'pending');
        deploymentId = r.data.deploymentId;
    });

    test('deploying an unknown project returns 404', async () => {
        const r = await api('POST', '/deploy/proj_doesnotexist');
        assert.equal(r.status, 404);
    });

    test('deployment appears in the project list', async () => {
        const r = await api('GET', `/projects/${projectId}/deployments`);
        assert.equal(r.status, 200);
        assert.ok(r.data.result.some((d) => d.id === deploymentId));
    });

    test('GET /deployments/:id returns it with default build settings', async () => {
        const r = await api('GET', `/deployments/${deploymentId}`);
        assert.equal(r.status, 200);
        assert.equal(r.data.result.status, 'pending');
        assert.ok(r.data.result.buildCommand);
        assert.ok(r.data.result.buildImage);
    });

    test('logs for a new deployment are empty', async () => {
        const r = await api('GET', `/deployments/${deploymentId}/logs?format=json`);
        assert.equal(r.status, 200);
        assert.deepEqual(r.data, []);
    });

    test('logs for an unknown deployment return 404', async () => {
        const r = await api('GET', '/deployments/dep-doesnotexist/logs?format=json');
        assert.equal(r.status, 404);
    });
});

describe('logout', () => {
    test('POST /auth/logout succeeds', async () => {
        const r = await api('POST', '/auth/logout');
        assert.equal(r.status, 200);
    });
});