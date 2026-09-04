import db from "../db.js"

const user_create = db.prepare('INSERT INTO users (name, email, password) VALUES(?, ?, ?)');

const getIDStmt = db.prepare('SELECT * FROM users WHERE id = ?');

const getAllStmt = db.prepare('SELECT * FROM users');

const getEmailStmt = db.prepare('SELECT * FROM users WHERE email = ?');

const user_del = db.prepare('DELETE FROM users WHERE id = ? ');

const user_update = db.prepare(`
    UPDATE users
    SET
        name = ?,
        email = ?,
        password = ?
    WHERE id = ?
`);

function create_user({ name, email, password }) {
    const result = user_create.run(name, email, password)
    return getByID(result.lastInsertRowid);
}

function getByID(id) {
    return getIDStmt.get(id);
}

function getByEmail(email) {
    return getEmailStmt.get(email)
}

function getAllUsers() {
    return getAllStmt.all();
}

function del_user(id) {
    return user_del.run(id)
}

function update_user({ id, name, email, password }) {
    const result = user_update.run(name, email, password, id);

    return result.changes;
}


export { getByEmail, create_user, getAllUsers, getByID, del_user };
