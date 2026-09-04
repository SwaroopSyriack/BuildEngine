import express from 'express';
import { getByID } from '@buildengine/shared/models/deployment.js';


const router = express.Router();


router.get('/:id', (req, res) => {

    try {

        const depID = req.params.id;

        const result = getByID(depID);

        if (!result) {

            return res.status(404).json({
                message: 'Deployment not found'
            });

        }

        return res.status(200).json({ message: 'Successfull', result: result })
    }
    catch (err) {
        console.error(err)
        return res.status(500).json({
            message: 'Internal server error'
        });
    }
})


export default router;

