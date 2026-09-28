import express from "express";
import path from 'path'
import { fileURLToPath } from "url";
import config from "@buildengine/shared/config.js";
import deprouter from "./routes/deployment.js";
import projrouter from "./routes/project.js"
import userrouter from "./routes/user.js";
import authrouter from './routes/auth.js'
import { deployInsert } from "@buildengine/shared/models/deployment.js";
import { getByID } from "@buildengine/shared/models/project.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express()
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));


app.get('/health', (req, res) => {
    return res.status(201).json({ message: 'HEALTH OK', service: 'orchestrator' })
})


app.post('/deploy/:projID', (req, res) => {
    try {

        const projectID = req.params.projID;
        // const { repo_url, build_command, build_image, output_dir } = req.body;

        // if ((!repo_url) || repo_url !== typeof 'string') {
        //     return res.status(400).json({ message: 'Inavlid Url' })
        // }

        const existingProj = getByID(projectID)

        if (!existingProj) {

            return res.status(404).json({ message: 'Project not Found' })

        }

        const resolvedBuildCommand = existingProj.build_command || config.DEFAULT_BUILD_COMMAND;
        const resolvedBuildImage = existingProj.build_image || config.DEFAULT_BUILD_IMAGE;

        const result = deployInsert({ project_id: projectID, repo_url: existingProj.repo_url, build_command: resolvedBuildCommand, build_image: resolvedBuildImage })


        if (result) {

            res.status(201).json({
                deploymentId: result.id,
                status: result.status,
            })
        }
    }
    catch (err) {
        console.error('[deploy] failed:', err);
        res.status(500).json({ message: 'internal error' });
    }
})


app.use('/projects', projrouter);
app.use('/deployments', deprouter);
app.use('/users', userrouter);
app.use('/auth', authrouter)

app.use((req, res) => {
    res.status(404).json({ error: 'not found' });
});

app.listen(config.ORCHESTRATOR_PORT, () => {
    console.log(`[orchestrator] listening on http://localhost:${config.ORCHESTRATOR_PORT}`);
});