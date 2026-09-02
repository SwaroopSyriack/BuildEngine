import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from 'node:fs'
import config from "./config";
import { fileURLToPath } from 'url';

function getDirname(importMetaUrl) {
    const filename = fileURLToPath(importMetaUrl);
    return dirname(filename);
}
const __dirname = getDirname(import.meta.url);


fs.mkdirSync(path.dirname(config.DATA_DIR), { recursive: true })

const db = new DatabaseSync(config.DATA_DIR);

db.exec('PRAGMA foreign_keys = ON;')
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA busy_timeout = 5000;');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8')

db.exec(schema)


export default db;
