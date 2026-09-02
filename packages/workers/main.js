import { runBuild } from "./build.js"
import { randomUUID } from 'crypto';

const job = {
    Image: '',
    buildCmd: '',
    deploymentid: `dep${randomUUID()}`,
    projectid: '',
    githubUrl: 'https://github.com/SwaroopSyriack/Simple_Snake_Game.git'
}

if (job) {
    console.log('The Cloning have started');
    await runBuild(job)
}