import express from 'express';
import { isValidName } from '@buildengine/shared/utils/util.js';
import { getByName, create_project, listAll, getByID, delProj, getDeploymensts } from '@buildengine/shared/models/project.js';
import { deploySummary, projSumamry } from '../serialize.js';


const router = express.Router();


router.get('/', (req, res) => {

    const result = listAll()

    return res.status(200).json({
        message: 'Fetched all items',
        result: result.map(projSumamry)
    });

})


router.get('/:id', (req, res) => {

    try {

        const projID = req.params.id;

        const exist_proj = getByID(projID)

        if (!exist_proj) {
            return res.status(404).json({
                message: 'Project not Found'
            })
        }
        res.status(200).json({ message: 'Project Found ', result: projSumamry(exist_proj) })


    }
    catch (err) {
        return res.status(500).json({
            message: 'Internal server error'
        });
    }
})


router.post('/', (req, res) => {

    try {

        const { user_id, name, repo_url, build_command, build_image, output_dir, spa_fallback } = req.body || {}

        if ((!name) || (!isValidName(name))) {
            return res.status(400).json({ message: ' name is required and must be a valid subdomain label (lowercase letters, digits, hyphens)' })
        }

        if ((!repo_url) || typeof repo_url !== 'string') {

            return res.status(400).json({ message: 'repoUrl is required' })

        }

        if (getByName(name)) {
            return res.status(400).json({ message: ` project '${name}' already exists' ` });
        }


        const result = create_project({
            user_id,
            name,
            repo_url,
            build_command: build_command || null,
            build_image: build_image || null,
            output_dir: output_dir || null,
            spa_fallback: spa_fallback === undefined ? true : !!spa_fallback

        })

        if (result) {
            res.status(201).json({ message: 'project Created', result: projSumamry(result) })
        }
    }
    catch (err) {
        console.error(err.message)
        return res.status(500).json({
            message: 'Internal server error'
        });
    }
});


router.delete('/:id', (req, res) => {
    try {

        const proj_id = req.params.id;

        const existingProj = getByID(proj_id)
        if (!existingProj) {
            return res.status(400).json({ message: `Project ${proj_id} Not Found` })
        }
        delProj(proj_id)
        return res.status(200).json({ message: `Project ${existingProj.name} deleted Successfully` })

    }
    catch (err) {
        console.log(err);
        return res.status(500).json({
            message: 'Internal server error'
        });

    }

})


// Need to Add the Serilizers not Added
router.get('/:id/deployments', (req, res) => {
    const projID = req.params.id;
    const existingProj = getByID(projID);
    if (!existingProj) {
        return res.status(404).json({ message: 'Project not Found' })
    }
    const result = getDeploymensts(projID)
    return res.status(200).json({ message: 'Found Deployments for Project', result: result.map(deploySummary) })

})

export default router;


