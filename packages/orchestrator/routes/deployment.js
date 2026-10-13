import express from 'express';
import { getByID, getLogs } from '@buildengine/shared/models/deployment.js';
import { requireAuth } from '../middleware/auth.js';
import { deploySummary } from '../serialize.js';



const router = express.Router();
router.use(requireAuth)


router.get('/:id', (req, res) => {

    try {

        const depID = req.params.id;

        const result = getByID(depID);

        if (!result) {

            return res.status(404).json({
                message: 'Deployment not found'
            });

        }

        return res.status(200).json({ message: 'Successfull', result: deploySummary(result) })
    }
    catch (err) {
        console.error(err)
        return res.status(500).json({
            message: 'Internal server error'
        });
    }
})


router.get('/:id/logs', (req, res) => {

    try {
        const deployment = getByID(req.params.id);
        if (!deployment) return res.status(404).json({ error: 'deployment not found' });

        const streamFilter = ['stdout', 'stderr', 'system'].includes(req.query.stream) ? req.query.stream : null;
        const logs = getLogs(deployment.id, streamFilter);

        if (req.query.format === 'json') {
            return res.json(logs.map((l) => ({ ts: l.ts, stream: l.stream, chunk: l.chunk })));
        }

        res.type('text/plain');
        res.send(logs.map((l) => `[${l.ts}] [${l.stream}] ${l.chunk}`).join('\n'));

    }

    catch (err) {
        console.error(err)
        return res.status(500).json({
            message: 'Internal server error'
        });
    }



})


export default router;

