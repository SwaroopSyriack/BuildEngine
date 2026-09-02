import Dockerode from 'dockerode'
import config from '@buildengine/shared/config.js';
import { Writable } from 'node:stream'


const docker = new Dockerode


async function ensureImage(imageName) {

    try {
        await docker.getImage(imageName).inspect();
        return;
    }
    catch (err) {
        //To pull the image
    }

    await new Promise((resolve, reject) => {

        docker.pull(imageName, (err, stream) => {
            if (err) {
                return reject(err)
            };
        });

    })

}

async function runContainer({ image, buildCmd, RepoDir, timeOut }) {

    const container = await docker.createContainer({
        Image: image,
        Cmd: ['sh', '-c', buildCmd],
        WorkingDir: '/workspace',
        Tty: false,
        HostConfig: {
            Binds: [`${RepoDir}:/workspace`],
            Memory: config.CONTAINER_MEMORY_BYTES,
            NetworkMode: 'bridge',
            AutoRemove: false
        },

    })

    try {
        const stream = await container.attach({ stream: true, stdout: true, stderr: true })
        await container.start()

        const stdoutWritable = new Writable({
            write(chunk, _enc, cb) {
                console.log('stdout', chunk.toString('utf8'));
                cb();
            },
        });
        const stderrWritable = new Writable({
            write(chunk, _enc, cb) {
                console.log('stderr', chunk.toString('utf8'));
                cb();
            },
        });
        docker.modem.demuxStream(stream, stdoutWritable, stderrWritable);

        let timeout = false;
        const timer = setTimeout(() => {
            timeout = true;
            container.kill().catch(() => { })
        }, timeOut)


        let result;
        try {
            result = await container.wait();
        }
        finally {
            clearTimeout(timer);
        }

        return { exitCode: result.StatusCode, timeout };

    }
    finally {
        // (await container).remove({ force: true }).catch(() => { })
    }

}


export { ensureImage, runContainer };