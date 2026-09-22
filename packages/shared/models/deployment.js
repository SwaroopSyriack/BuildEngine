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


export { deployInsert, getByID, getNextWorker }