import express from "express";

import deprouter from "./routes/deployment";
import projrouter from "./routes/project";
import userrouter from "./routes/user";
import { deploy } from "@buildengine/shared/models/deployment";
import { deploySummary } from "./serialize";


const app = express()
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));


app.get('/health', (req, res) => {
    return res.status(201).json({ message: 'HEALTH OK', service: 'orchestrator' })
})


app.post('/deploy', (req, res) => {
    try {
        const { repo_url, build_command, build_image, output_dir } = req.body;

        if ((!repo_url) || repo_url !== typeof 'string') {
            res.status(400).json({ message: 'Inavlid Url' })
        }

        const resolvedBuildCommand = buildCommand || config.DEFAULT_BUILD_COMMAND;
        const resolvedBuildImage = buildImage || config.DEFAULT_BUILD_IMAGE;

        const result = deploy(repo_url, resolvedBuildCommand, resolvedBuildImage)

        if (result) {

            res.status(201).json({
                deploymentId: deployment.id,
                deploymentName: deployment.name,
                status: deployment.status,
            })
        }
    }
    catch (err) {
        console.error(err)
    }
})


app.use('/projects', projectsRouter);
app.use('/deployments', deploymentsRouter);

app.use((req, res) => {
    res.status(404).json({ error: 'not found' });
});