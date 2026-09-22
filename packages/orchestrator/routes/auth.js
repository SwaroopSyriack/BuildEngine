import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken'
import { getByEmail, create_user } from '@buildengine/shared/models/user.js';
import config from '@buildengine/shared/config.js'
import { extractToken, COOKIE_NAME } from '../middleware/auth.js';
import { getUserByID } from '@buildengine/shared/models/user.js';
import { userSummary } from '../serialize.js';



const router = express.Router();


function issueToken(user) {
    return jwt.sign({ 'sub': user.id }, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRES_IN })

}

function durationToMs(spec) {
    const match = /^(\d+)\s*(s|m|h|d)$/.exec(String(spec));
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    const n = Number(match[1]);
    const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2]];
    return n * unitMs;
}


function setSessionCookie(res, token) {
    res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: durationToMs(config.JWT_EXPIRES_IN),
    });
}


router.post('/signup', async (req, res) => {

    try {

        const { name, email, passwd } = req.body || {};

        if ((!name) || (!email) || (!passwd)) {
            return res.status(400).json({ messsage: "Email and Password Cannot be Empty" })
        }
        if (getByEmail(email)) {
            return res.status(409).json({ message: " The Account of the user already exits " })
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(passwd, saltRounds);
        const user = create_user({ name, email, password: hashedPassword })
        const token = issueToken(user);

        setSessionCookie(res, token)
        return res.status(201).json({ token: token, user: userSummary(user) })

    }
    catch (err) {
        console.error('[auth/login]', err);
        res.status(500).json({ message: 'Internal Server Error' })
    }
})


router.post('/login', async (req, res) => {

    try {

        const { email, passwd } = req.body || {};

        if ((!email) || (!passwd)) {

            return res.status(400).json({ message: "Email & Password cannot be Empty ..." })
        }
        const user = getByEmail(email)

        if (!user) {
            return res.status(400).josn({ message: 'Invalid email or password' })
        }

        const valid = await bcrypt.compare(passwd, user.password)
        if (!valid) {
            return res.status(400).json({ message: 'Invalid email or password' })
        }

        const token = issueToken(user)
        setSessionCookie(res, token)

        return res.status(200).json({ token, user: userSummary(user) });

    }

    catch (err) {
        console.error('[auth/login]', err);
        return res.status(500).json({ message: 'Internal server error' });
    }
})

router.post('/logout', (req, res) => {
    res.clearCookie(COOKIE_NAME);
    return res.status(200).json({ message: 'Logged out' });
});



router.get('/me', (req, res) => {

    const token = extractToken(req)

    if (!token) {
        return res.status(401).json({ message: 'The user not Authenticated.' })
    }

    try {
        const paylaod = jwt.verify(token, config.JWT_SECRET)
        const user = getUserByID(paylaod.sub)
        if (!user) {
            return res.status(401).json({ message: 'User no longer exits ' })
        }
        return res.status(200).json({ user: userSummary(user) });
    }
    catch (err) {
        return res.status(500).json({ message: 'Invalid Session' });
    }
})

export default router;



