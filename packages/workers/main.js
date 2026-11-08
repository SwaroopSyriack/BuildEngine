import { runBuild } from "./build.js"
import { randomUUID } from 'crypto';
import config from "@buildengine/shared/config.js";
import { getNextWorker } from "@buildengine/shared/models/deployment.js";
import os from 'node:os'


const WORKER_ID = `${os.hostname()}-${process.pid}`;

async function start() {
    let didWork = false;
    try {
        const job = getNextWorker(WORKER_ID)
        if (job) {
            didWork = true;
            console.log(`[worker] claimed deployment ${job.id}`);
            await runBuild(job)
            console.log(`[worker] finished deployment the id is given ${job.id}`);
        }


    }
    catch (err) {
        console.error('[worker] tick error (worker stays alive):', err);
    }
    const delay = didWork ? 0 : config.DOCKER_RETRY_INTERVAL_MS;
    setTimeout(start, delay);
}
console.log(`[worker] starting (${WORKER_ID}), polling for pending deployments...`);
start();

