import express from 'express';
import db from '@buildengine/shared/db.js'
import { getByEmail, create_user, getAllUsers, getByID } from '@buildengine/shared/models/user.js';
import bcrypt from 'bcrypt'


const router = express.Router();


router.get('/', (req, res, next) => {

    try {

        const result = getAllUsers()

        if (result) {
            res.status(201).json({
                message: 'User created successfully',
                result: result
            });
        }

    }
    catch (err) {
        console.error(err.message)
    }


})


router.post('/', async (req, res, next) => {
    try {

        const { name, email, password, } = req.body

        if (name === null || email === null || password === null) {
            res.status(400).json({ message: 'The Feilds cannot be empty' })

        }

        const exit_user = getByEmail(email);
        if (exit_user) {
            res.status(400).json({ message: "User Already Exisiting" })
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const result = create_user(name, email, hashedPassword)

        if (result) {
            res.status(201).json({
                message: 'User created successfully',
                result: result
            });
        }
    }
    catch (err) {
        console.error(err.message)
    }
})


router.delete('/:id', (req, res, next) => {
    try {

        const userId = req.params.id;
        const exit_user = getByID(userId)
        if (!exit_user) {
            res.status(400).json({ message: `User ${exit_user.name} not Found` })
        }

        const result = del_user(userId)
        if (result > 0) {
            res.status(201).json({
                message: 'User created successfully',
                result: result
            });
        }

    }
    catch (err) {
        console.error(err)
    }
})


export default router;