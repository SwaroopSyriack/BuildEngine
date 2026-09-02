import express from 'express';
import { isValidName } from '@buildengine/shared/utils/util.js';
import { getByName, create_project, listAll, getByID } from '@buildengine/shared/models/project.js';
import { projSumamry } from '../serialize';


const router = express.Router();


router.get('/', (req, res) => {
    try {
        const result = listAll()
        if (result) {
            res.status(201).json({ message: 'Fetched all items ', result: result.map(projSumamry) })
        }
    }

    catch (err) {

        console.error('Error Ocuured', err.message)
    }

})


router.get('/:name', (req, res) => {

    try {

        const proj_id = req.params.id;

        const exist_proj = getByName(proj_id)

        if (!exist_proj) {
            res.status(404).json({
                message: 'Project not Found'
            })
        }

        res.status(201).json({ message: 'Project Found ', result: projSumamry(exist_proj) })


    }
    catch (err) {

    }
})


router.post('/', (req, res) => {

    try {

        const { name, repo_url, build_command, build_image, output_dir, spa_fallback } = req.body || {}

        if ((!name) || (!isValidName(name))) {
            res.status(400).json({ message: ' name is required and must be a valid subdomain label (lowercase letters, digits, hyphens)' })
        }

        if ((!repo_url) || typeof repoUrl !== 'string') {

            res.status(400).json({ message: 'repoUrl is required' })

        }

        if (getByName(name)) {
            res.status(400).json({ message: ` project '${name}' already exists' ` });
        }


        const result = create_project({
            name,
            repo_url,
            build_command: build_command || null,
            build_image: build_image || null,
            output_dir: output_dir || null,
            spa_fallback: spaFallback === undefined ? true : !!spaFallback,

        })

        if (result) {
            res.status(201).json({ message: 'project Created', result: projSumamry(result) })
        }
    }
    catch (err) {
        console.error(err.message)
    }
});

export default router;


