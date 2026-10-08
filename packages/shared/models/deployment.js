import db from "../db.js";
import crypto from 'node:crypto'

function newID() {
    return `dep-${crypto.randomBytes(6).toString('hex')}`
}

const deployStmt = db.prepare(`INSERT INTO deployments (id , project_id ,repo_url,build_command,build_image , status ) VALUES (? , ? , ? , ? , ? ,'pending')`);

const getByIDstmt = db.prepare('SELECT * FROM deployments WHERE id = ?')


const getNextWorkerStmt = db.prepare(`
UPDATE deployments
SET status = 'building', claimed_by = ?, claimed_at = datetime('now'), started_at = datetime('now')
WHERE id = (
    SELECT id FROM deployments WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1
  )
RETURNING id, project_id, repo_url, build_command, build_image, output_dir`)


const updateWorkerBuliderStmt = db.prepare(`UPDATE deployments
SET status = 'ready' , output_dir = ? , storage_path = ? ,finished_at = datetime('now')
WHERE id = ?`)


const updateWorkerFailedStmt = db.prepare(`UPDATE deployments
SET status = 'failed' , error_message = ? ,finished_at = datetime('now')
WHERE id = ?`)

const appendLogsStmt = db.prepare(`INSERT INTO build_logs (deployment_id , stream , chunk) VALUES (? , ? ,? )`)

const getLogsStmt = db.prepare(`SELECT ts, stream, chunk FROM  build_logs WHERE deployment_id = ? ORDER BY AESC`)

const getFilteredLogsStmt = db.prepare(`SELECT ts, stream, chunk FROM  build_logs WHERE deployment_id = ? and stream = ? ORDER BY AESC`)

const commitShaStmt = db.prepare(`Update deployments SET commit_sha = ? where deployment_id = ?`)


function deployInsert({ project_id, repo_url, build_command, build_image, }) {
    const id = newID()
    deployStmt.run(id, project_id, repo_url, build_command, build_image)
    return getByID(id)

}

function getByID(id) {
    return getByIDstmt.get(id)
}

function getNextWorker(id) {
    return getNextWorkerStmt.get(id)
}

function updateBuilder(output_dir, storage_path, id) {
    return updateWorkerBuliderStmt.run(output_dir, storage_path, id)
}

function failedBuilder(error_message, id) {
    return updateWorkerFailedStmt.run(error_message, id)
}

function appendLogs(deployment_id, stream, chunk) {
    return appendLogsStmt.run(deployment_id, stream, chunk)
}


function getLogs(deployment_id, stream) {
    return stream ? getFilteredLogsStmt.all(deployment_id, stream) : getLogsStmt.all(deployment_id)
}

function commit_sha(commitsha) {
    return commitShaStmt.run(commitsha)
}


export { deployInsert, getByID, getNextWorker, updateBuilder, failedBuilder, appendLogs, commit_sha, getLogs }