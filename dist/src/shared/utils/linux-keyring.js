import { execSync } from 'node:child_process';
export function lookupLinuxKeyringPassword(appName) {
    return execSync(`secret-tool lookup xdg:schema chrome_libsecret_os_crypt_password_v2 application ${appName}`, {
        timeout: 5000,
        encoding: 'utf8',
    }).trim();
}
//# sourceMappingURL=linux-keyring.js.map