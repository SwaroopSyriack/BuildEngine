import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken'
import router from './deployment';
import { getByEmail, create_user } from '@buildengine/shared/models/user';
import { config } from 'dotenv';



router = express.Router();


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

        if ((!name) && (!email) && (!passwd)) {
            return res.status(404).json({ messsage: "Email and Password Cannot be Empty" })
        }
        if (getByEmail(email)) {
            return res.status(400).json({ message: " The Account of the user already exits " })
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const user = create_user({ name, email, hashedPassword })
        const token = issueToken(user);

        setSessionCookie(res, token)
        return res.status(201).json({ token: token, user: user })

    }
    catch (err) {
        res.status(500).json({ message: 'Internal Server Error' })
    }
})


router.post('/login', async (res, req) => {

    try {

        const { email, passwd, confirm_passwd } = req.body || {};

        if ((!email) && (!passwd)) {

            return res.status(404).json({ message: "Email & Password cannot be Empty ..." })
        }
        const user = getByEmail(email)

        if (!user) {
            return res.status(400).josn({ message: 'Invalid email or password' })
        }

        const valid = await bcrypt.compare(passwd, confirm_passwd)
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



