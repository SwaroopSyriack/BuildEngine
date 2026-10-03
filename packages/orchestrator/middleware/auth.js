import config from '@buildengine/shared/config.js'
import jwt from 'jsonwebtoken'


const COOKIE_NAME = 'session';

function extractToken(req) {

    if (req.cookies?.[COOKIE_NAME]) return req.cookies[COOKIE_NAME];

    const header = req.headers.authorization || '';
    const [schema, token] = header.split(' ')
    if (schema === 'Bearer' && token) {
        console.log(token)
        return token
    }

    return null;
}


function requireAuth(req, res, next) {
    const token = extractToken(req);
    try {

        if (!token) {
            return res.status(401).json({ message: 'Not Authenticated' })
        }

        const payload = jwt.verify(token, config.JWT_SECRET)
        req.userId = payload.sub;
        next();
    }
    catch (err) {
        console.log(err)
        return res.status(401).json({ message: 'Invalid or expired Session' })

    }


}


export { extractToken, COOKIE_NAME, requireAuth }