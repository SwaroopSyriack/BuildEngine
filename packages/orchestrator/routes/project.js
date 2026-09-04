import express from 'express';
import { isValidName } from '@buildengine/shared/utils/util.js';
import { getByName, create_project, listAll, getByID } from '@buildengine/shared/models/project.js';
import { projSumamry } from '../serialize.js';


const router = express.Router();


router.get('/', (req, res) => {

    return res.status(200).json({
        message: 'Fetched all items',
        result: result.map(projSumamry)
    });

})


router.get('/:name', (req, res) => {

    try {

        const proj_name = req.params.name;

        const exist_proj = getByName(proj_name)

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

        const { name, repo_url, build_command, build_image, output_dir, spa_fallback } = req.body || {}

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

export default router;


