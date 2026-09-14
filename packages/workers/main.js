import { runBuild } from "./build.js"
import { randomUUID } from 'crypto';
import config from "@buildengine/shared/config.js";
import { getNextWorker } from "@buildengine/shared/models/deployment.js";
import os from 'node:os'


const WORKER_ID = `${os.hostname()}-${process.pid}`;

// const job = {
//     Image: '',
//     buildCmd: '',
//     deploymentid: `dep${randomUUID()}`,
//     projectid: '',
//     githubUrl: 'https://github.com/SwaroopSyriack/Simple_Snake_Game.git'
// }

async function start() {
    let didWork = false;
    try {
        const job = getNextWorker(WORKER_ID)
        if (job) {
            didWork = true;
            console.log(`[worker] claimed deployment ${job.id}`);
            await runBuild(job)
            console.log(`[worker] finished deployment ${job.id}`);
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

// if (job) {
//     console.log('The Cloning have started');

// }