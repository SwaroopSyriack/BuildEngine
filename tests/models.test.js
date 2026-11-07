import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { makeSandbox, removeSandbox, importFrom } from './helpers/sandbox.js';

let dir, users, projects, deployments, projectId;

before(async () => {
    dir = makeSandbox();
    users = await importFrom(dir, 'packages/shared/models/user.js');
    projects = await importFrom(dir, 'packages/shared/models/project.js');
    deployments = await importFrom(dir, 'packages/shared/models/deployment.js');

    const user = users.create_user({ name: 'Model', email: 'model@example.dev', password: 'hash' });
    projectId = projects.create_project({
        user_id: user.id, name: 'model-site', repo_url: 'https://github.com/a/b.git',
        build_command: null, build_image: null, output_dir: null, spa_fallback: true,
    }).id;
});

after(() => {
    if (dir) removeSandbox(dir);
});

const newDeployment = () =>
    deployments.deployInsert({ project_id: projectId, repo_url: 'https://github.com/a/b.git', build_command: 'npm run build', build_image: 'node:20-bullseye' });

describe('deployment queue', () => {
    test('deployInsert creates a pending deployment', () => {
        const d = newDeployment();
        assert.match(d.id, /^dep-/);
        assert.equal(d.status, 'pending');
    });

    test('getNextWorker claims the oldest pending job and marks it building', () => {
        const job = deployments.getNextWorker('test-worker');
        assert.ok(job);
        const row = deployments.getByID(job.id);
        assert.equal(row.status, 'building');
        assert.equal(row.claimed_by, 'test-worker');
        assert.ok(row.started_at);
    });

    test('getNextWorker returns nothing when the queue is empty', () => {
        assert.equal(deployments.getNextWorker('test-worker'), undefined);
    });
});

describe('deployment results', () => {
    test('updateBuilder marks a deployment ready', () => {
        const d = newDeployment();
        deployments.updateBuilder('dist', `http://${d.id}.example`, d.id);
        const row = deployments.getByID(d.id);
        assert.equal(row.status, 'ready');
        assert.equal(row.output_dir, 'dist');
        assert.equal(row.storage_path, `http://${d.id}.example`);
        assert.ok(row.finished_at);
    });

    test('failedBuilder marks a deployment failed with its message', () => {
        const d = newDeployment();
        deployments.failedBuilder('build failed (exit 1)', d.id);
        const row = deployments.getByID(d.id);
        assert.equal(row.status, 'failed');
        assert.equal(row.error_message, 'build failed (exit 1)');
    });

    test('commit_sha stores the commit', () => {
        const d = newDeployment();
        deployments.commit_sha(d.id, 'abc1234');
        assert.equal(deployments.getByID(d.id).commit_sha, 'abc1234');
    });

    test('setLiveDeployment points the project at a deployment', () => {
        const d = newDeployment();
        projects.setLiveDeployment(projectId, d.id);
        assert.equal(projects.getByID(projectId).live_deployment_id, d.id);
    });
});

describe('build logs', () => {
    test('appendLogs / getLogs keep order and filter by stream', () => {
        const d = newDeployment();
        deployments.appendLogs(d.id, 'system', 'start');
        deployments.appendLogs(d.id, 'stdout', 'out line');
        deployments.appendLogs(d.id, 'stderr', 'err line');

        assert.deepEqual(deployments.getLogs(d.id).map((l) => l.chunk), ['start', 'out line', 'err line']);
        assert.deepEqual(deployments.getLogs(d.id, 'stderr').map((l) => l.chunk), ['err line']);
    });

    test('an invalid stream name is rejected by the database', () => {
        const d = newDeployment();
        assert.throws(() => deployments.appendLogs(d.id, 'not-a-stream', 'x'));
    });
});