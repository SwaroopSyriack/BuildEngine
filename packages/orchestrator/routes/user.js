import express from 'express';
import { getByEmail, create_user, getAllUsers, del_user, getUserProj } from '@buildengine/shared/models/user.js';
import { getUserByID } from '@buildengine/shared/models/user.js';
import bcrypt from 'bcrypt'
import { projSumamry, userSummary } from '../serialize.js';


const router = express.Router();
router.use(requireAuth)


router.get('/', (req, res) => {

    const result = getAllUsers()

    return res.status(200).json({
        message: 'Users Fecthed successfully',
        result: result.map(userSummary)
    });

})


router.post('/', async (req, res) => {
    try {

        const { name, email, password, } = req.body

        if (!name || !email || !password) {
            return res.status(400).json({ message: 'The Feilds cannot be empty' })

        }

        const exit_user = getByEmail(email);
        if (exit_user) {
            return res.status(400).json({ message: "User Already Exisiting" })
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const result = create_user({
            name,
            email,
            password: hashedPassword
        })

        return res.status(201).json({
            message: 'User created successfully',
            result: result.map(userSummary)
        });
    }
    catch (err) {
        console.error(err.message)
        return res.status(500).json({
            message: 'Internal server error'
        });
    }
})


router.delete('/:id', (req, res) => {
    try {

        const userId = req.params.id;
        const existingUser = getUserByID(userId)
        if (!existingUser) {
            return res.status(400).json({ message: `User ${userId} not Found` })
        }

        const result = del_user(userId)
        if (result.changes === 0) {
            return res.status(404).json({
                message: `User ${userId} not found`
            });
        }

        return res.status(200).json({
            message: 'User deleted successfully',
            result
        });


    }
    catch (err) {
        console.error(err)
        return res.status(500).json({
            message: 'Internal server error'
        });
    }
})


router.get('/:id/projects', (req, res) => {
    const user_id = req.params.id;
    const existingUser = getUserByID(user_id)
    if (!existingUser) return res.status(400).json({ message: 'User not Found' })
    const result = getUserProj(user_id)
    return res.status(200).json({ message: 'Projects Fecthed Successfully', result: result.map(projSumamry) })
})


export default router;