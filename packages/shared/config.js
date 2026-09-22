import path from "node:path";
import { fileURLToPath } from "node:url";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..')

function envInt(name, fallback) {
    const v = process.env[name];
    return v ? parseInt(v, 10) : fallback;
}

export default {
    ROOT,
    TMP_DIR: path.join(ROOT, 'tmp'),
    DATA_DIR: path.join(ROOT, 'data', 'buildengine.db'),
    CLONE_TIME_OUT: envInt('CLONE_TIMEOUT_MS', 120_000),
    DEFAULT_IMAGE_NAME: 'node:20-bullseye',
    DEFAULT_BUILD_CMD: 'npm install && npm run build',
    RUN_TIME_OUT: envInt('BUILD_TIMEOUT_MS', 5 * 60_000),
    CONTAINER_MEMORY_BYTES: envInt('CONTAINER_MEMORY_BYTES', 1024 * 1024 * 1024),
    OUT_DIR_CANDIDATES: ['dist', 'build', 'out'],
    AWS_REGION: 'ap-southeast-2',
    ORCHESTRATOR_PORT: 3000,
    DEFAULT_BUILD_IMAGE: process.env.DEFAULT_BUILD_IMAGE || 'node:20-bullseye',
    DEFAULT_BUILD_COMMAND: process.env.DEFAULT_BUILD_COMMAND || 'npm install && npm run build',
    DOCKER_RETRY_INTERVAL_MS: envInt('DOCKER_RETRY_INTERVAL_MS', 5000),
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',


}