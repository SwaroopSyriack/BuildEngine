import db from "../db";
import crypto from 'node:crypto'

function newID() {
    return `dep-crypto.randomUUID(6).toString('hex')`
}

const deployStmt = db.prepare('INSERT INTO deployments (repo_url,build_command,build_image)');

const getByIDstmt = db.prepare('SELECT * FROM deployments WHERE id = ?')


function deploy({ repo_url, build_command, build_image, }) {
    const id = newID()
    deployStmt.run(repo_url, build_command, build_image)
    return getByID(id)

}

function getByID(id) {
    return getByIDstmt.get(id)
}


export { deploy, getByID }