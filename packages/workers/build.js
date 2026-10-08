import path from 'path'
import { execFile } from 'child_process';
import config from '@buildengine/shared/config.js';
import { ensureImage, runContainer } from './docker.js';
import fs from 'fs'
import { fail } from 'assert';
import upload_aws from './upload.js';
import { updateBuilder, failedBuilder } from "@buildengine/shared/models/deployment.js";
import { setLiveDeployment } from '@buildengine/shared/models/project.js';
import { appendLogs } from '@buildengine/shared/models/deployment.js';




async function runShellCommand(cmd, args, { cwd, timeout, maxBuffer, onLog }) {

    return new Promise((resolve, reject) => {
        execFile(cmd, args, {
            cwd, timeout, maxBuffer
        }, (error, stdout, stderr) => {
            if (error) {
                console.error(stderr)
                reject(error)
                return;
            }
            resolve(stdout)
        })
    })
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
    const tmpDir = path.join(config.TMP_DIR, deploymentId)
    const repoDir = path.join(tmpDir, 'repo')

    try {

        fs.mkdirSync(tmpDir, { recursive: true })
        log('system', `Starting build for ${job.repo_url}`);

        log('system', `Cloning repository (depth 1)...`);
        await runShellCommand('git', ['clone', '--depth', '1', job.repo_url, repoDir], { cwd: tmpDir, timeout: config.CLONE_TIME_OUT, maxBuffer: 10 * 1024 * 1024, onLog: log })

        let repoFolderPath;

        try {
            repoFolderPath = directoryPackageJson(repoDir)
        }
        catch {
            console.error(`Could not scan repo for package.json: ${err.message} `)
        }

        if (!repoFolderPath) {
            console.error('No package.json found in cloned repository')
        }

        await ensureImage(config.DEFAULT_IMAGE_NAME);

        const runResult = await runContainer(
            {
                image: job.build_image,
                buildCmd: job.build_command,
                RepoDir: repoFolderPath,
                timeOut: config.RUN_TIME_OUT
            }
        )

        if (runResult.exitCode === -1) {
            console.error('Failed to run the container');
            throw new Error("Timed out running the container");
        }
        if (runResult.timeout) {
            console.error(`Timed out running the container`);
            throw new Error("Timed out running the container");
        }

        const out = findOutDir(repoFolderPath, config.OUT_DIR_CANDIDATES)
        if (!out) {
            throw new Error(
                `Could not locate build output; tried: ${config.OUT_DIR_CANDIDATES.join(', ')}. Set project.outputDir explicitly.`
            )
        }
        console.log('system', `Using output directory: ${out}`);

        await upload_aws(path.join(repoFolderPath, out), deploymentId)
        updateBuilder(out, `http://${deploymentId}.s3-website.${config.AWS_REGION}.amazonaws.com`, job.id)
        setLiveDeployment(job.project_id, deploymentId)
        console.log(`The Deployment Url is : http://${deploymentId}.s3-website.${config.AWS_REGION}.amazonaws.com`);
    }
    catch (err) {
        console.error('Unexpected Error :', err)
        failedBuilder(err.message, deploymentId)
    }

    finally {
        console.log('Removing the temp Folder')
        fs.rm(tmpDir, { recursive: true, force: true }, (err) => {
            console.log(err)
        });
    }
}

export { runBuild }