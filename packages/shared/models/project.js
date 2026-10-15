import db from "../db.js";
import crypto from 'node:crypto'


function newId(prefix) {
    return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

const getByNameStmt = db.prepare('SELECT * FROM projects WHERE name = ?');

const insertStmt = db.prepare('INSERT INTO projects(id,user_id,name,repo_url,build_command,build_image,output_dir,spa_fallback) VALUES (?,?,?,?,?,?,?,?)');

const getByIDStmt = db.prepare('SELECT * FROM projects WHERE id = ?');

const listAllStmt = db.prepare('SELECT * FROM projects WHERE user_id = ?');

const delProjStmt = db.prepare('DELETE FROM projects WHERE id = ? ');

const getDeployStmt = db.prepare('SELECT * FROM deployments WHERE project_id = ? ')

const updateRepoStmt = db.prepare(`
  UPDATE projects SET repo_url = ?, build_command = COALESCE(?, build_command), build_image = COALESCE(?, build_image)
  WHERE id = ?
`);

const setLiveDeploymentStmt = db.prepare('UPDATE projects SET live_deployment_id = ? WHERE id = ?');



function create_project({ user_id, name, repo_url, build_command, build_image, output_dir, spa_fallback }) {
    const id = newId('proj')
    insertStmt.run(id, user_id, name, repo_url, build_command, build_image, output_dir, spa_fallback ? 1 : 0);
    return getByID(id)
}

function getByName(name) {
    return getByNameStmt.get(name)
}

function getByID(id) {
    return getByIDStmt.get(id)
}

function listAll(userid) {
    return listAllStmt.all(userid)
}

function delProj(id) {
    return delProjStmt.run(id)
}

function getDeploymensts(projID) {
    return getDeployStmt.all(projID)
}

function updateRepo(projectId, repoUrl, buildCommand, buildImage) {
    return updateRepoStmt.run(repoUrl, buildCommand, buildImage, projectId)
}

function setLiveDeployment(id, deploymentId) {
    return setLiveDeploymentStmt.run(deploymentId, id)
}

export { getByName, create_project, listAll, getByID, delProj, getDeploymensts, updateRepo, setLiveDeployment }; 