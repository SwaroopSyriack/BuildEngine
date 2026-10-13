import path from 'path'
import { execFile, spawn } from 'child_process';
import config from '@buildengine/shared/config.js';
import { ensureImage, runContainer } from './docker.js';
import fs from 'fs'
import { fail } from 'assert';
import upload_aws from './upload.js';
import { updateBuilder, failedBuilder } from "@buildengine/shared/models/deployment.js";
import { setLiveDeployment } from '@buildengine/shared/models/project.js';
import { appendLogs } from '@buildengine/shared/models/deployment.js';
import killTree from './procKill.js';




async function runShellCommand(cmd, args, { cwd, timeoutms, onLog }) {

    return new Promise((resolve) => {
        const child = spawn(cmd, args, {
            cwd, detached: process.platform !== 'win32'
        });

        let timedOut = false;
        const timer = setTimeout(() => {
            timedOut = true
            killTree(child.pid)

        }, timeoutms)

        child.stdout.on('data', (d) => onLog('stdout', d.toString('utf8')))
        child.stderr.on('data', (d) => onLog('stderr', d.toString('utf8')))

        child.on('close', (code) => {
            clearTimeout(timer);
            resolve({ code, timedOut })
        })

        child.on('error', (err) => {
            clearTimeout(timer)
            onLog('system', `Failed to start '${cmd}': ${err.message}`)
            resolve({ code: -1, timedOut: false })
        })
    }
    )
}


function directoryPackageJson(repoDir) {
    try {

        const contents = fs.readdirSync(repoDir, { withFileTypes: true });

        for (const content of contents) {
            const currentPath = path.join(repoDir, content.name);

            if (content.isFile() && content.name === 'package.json') {
                return repoDir;
            }

            if (
                content.isDirectory() &&
                content.name !== 'node_modules' &&
                content.name !== '.git'
            ) {
                const result = directoryPackageJson(currentPath);
                if (result) return result;
            }

        }

        return null;
    }
    catch (err) {
        console.log(err)
        return fail(`package.json could not be parsed: ${err.message}`);

    }
}


function findOutDir(repoPath, candidates) {

    for (const candidate of candidates) {

        const full = path.join(repoPath, candidate)
        try {

            const stat = fs.statSync(full)

            if (stat.isDirectory() && fs.readdirSync(full).length > 0) {
                return candidate;
            }
        }
        catch (err) {

        }
    }

    return null;


}

async function runBuild(job) {

    const deploymentId = job.id;
    const log = (stream, chunk) => appendLogs(deploymentId, stream, chunk)
    const fail = (message) => {
        log('system', `FAILED: ${message}`);
        failedBuilder(message, deploymentId,);
    }
    const tmpDir = path.join(config.TMP_DIR, deploymentId)
    const repoDir = path.join(tmpDir, 'repo')

    try {

        fs.mkdirSync(tmpDir, { recursive: true })
        log('system', `Starting build for ${job.repo_url}`);

        log('system', `Cloning repository (depth 1)...`);
        const gitResult = await runShellCommand('git', ['clone', '--depth', '1', job.repo_url, repoDir], { cwd: tmpDir, timeoutms: config.CLONE_TIME_OUT, onLog: log })

        if (gitResult.timedOut) {
            return fail('git clone timed out')

        }
        if (gitResult.code !== 0) {
            return fail(`git clone failed (exit ${gitResult.code})`)
        }

        let repoFolderPath;

        try {
            repoFolderPath = directoryPackageJson(repoDir)
        }
        catch (err) {
            return fail(`Could not scan repo for package.json: ${err.message} `)
        }

        if (!repoFolderPath) {
            return fail('No package.json found in cloned repository')
        }

        log('system', `Ensuring build image ${job.build_image} is available...`);
        await ensureImage(config.DEFAULT_IMAGE_NAME);

        log('system', `Running build command in container: ${job.build_command}`);
        const runResult = await runContainer(
            {
                image: job.build_image,
                buildCmd: job.build_command,
                RepoDir: repoFolderPath,
                timeOut: config.RUN_TIME_OUT,
                onLog: log
            }
        )

        if (runResult.exitCode !== 0) {
            return fail(`build timed out after ${runResult.exitCode}ms`);
        }
        if (runResult.timeout) {
            return fail(`build timed out after ${config.RUN_TIME_OUT}ms`);
        }

        const out = findOutDir(repoFolderPath, config.OUT_DIR_CANDIDATES)
        if (!out) {
            return fail(`Could not locate build output; tried: ${config.OUT_DIR_CANDIDATES.join(', ')}. Set project.outputDir explicitly.`)
        }
        log('system', `Using output directory: ${out}`);

        await upload_aws(path.join(repoFolderPath, out), deploymentId)
        updateBuilder(out, `http://${deploymentId}.s3-website.${config.AWS_REGION}.amazonaws.com`, job.id)
        setLiveDeployment(job.project_id, deploymentId)
        log('system', `The Deployment Url is : http://${deploymentId}.s3-website.${config.AWS_REGION}.amazonaws.com`);
    }
    catch (err) {
        fail(`Unexpected error: ${err.message}`)
    }

    finally {
        fs.rm(tmpDir, { recursive: true, force: true }, (err) => {
            console.log(err)
        });
    }
}

export { runBuild }