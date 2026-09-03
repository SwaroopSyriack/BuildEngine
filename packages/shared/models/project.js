import db from "../db.js";
import crypto from 'node:crypto'


function newId(prefix) {
    return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

const getByNameStmt = db.prepare('SELECT * FROM projects WHERE name = ?');

const insertStatement = db.prepare('INSERT INTO projects(id,name,repo_url,build_command,build_image,output_dir,spa_fallback) VALUES (?,?,?,?,?,?,?)');

const getByIDstmt = db.prepare('SELECT * FROM projects WHERE id = ?');

const listAllstmt = db.prepare('SELECT * FROM projects');



function create_project({ name, repo_url, build_command, build_image, output_dir, spa_fallback }) {
    const id = newId('proj')
    insertStatement.run(id, name, repo_url, build_command, build_image, output_dir, spa_fallback ? 1 : 0);
    return getByID(id)
}

function getByName(name) {
    return getByNameStmt.get(name)
}

function getByID(id) {
    return getByIDstmt.get(id)
}

function listAll() {
    return listAllstmt.all()
}



export { getByName, create_project, listAll, getByID }; 