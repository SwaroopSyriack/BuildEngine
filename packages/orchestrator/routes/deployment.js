import express from 'express';
import { getByID } from '@buildengine/shared/models/deployment.js';


const router = express.Router();


router.get('/:id', (req, res) => {

    try {

        const depID = req.params.id;

        const result = getByID(depID);

        if (result) {
            res.status(201).json({ message: 'Successfull', result: result })
        }
    }
    catch (err) {
        console.error(err)
    }
})


export default router;

