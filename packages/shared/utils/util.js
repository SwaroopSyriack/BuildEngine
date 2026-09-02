const NAME_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

function isValidName(name) {
    return typeof name === 'string' && NAME_RE.test(name);
}

export { isValidName };