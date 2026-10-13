import { execFile } from 'node:child_process'


function killTree(pid) {
    return new Promise((resolve) => {

        if (process.platform === 'win32') {
            execFile('taskkill', ['/pid', String(pid), '/T', '/F'], () => resolve());
        }
        else {
            try {
                process.kill(-pid, 'SIGKILL');
            }
            catch (err) {
                try {
                    process.kill(pid, 'SIGKILL');
                }
                catch (err2) {
                    if (err2.code !== 'ESRCH') console.error('killTree failed:', err2);
                }
            }
            resolve()
        }


    })
}


export default killTree;