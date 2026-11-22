import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getConfigDir } from '../../shared/utils/config-dir.js';
export class LineCredentialManager {
    configDir;
    credentialsPath;
    constructor(configDir) {
        this.configDir = configDir ?? getConfigDir();
        this.credentialsPath = join(this.configDir, 'line-credentials.json');
    }
    async load() {
        if (!existsSync(this.credentialsPath)) {
            return { current_account: null, accounts: {} };
        }
        const content = await readFile(this.credentialsPath, 'utf-8');
        return JSON.parse(content);
    }
    async save(config) {
        await mkdir(this.configDir, { recursive: true });
        await writeFile(this.credentialsPath, JSON.stringify(config, null, 2), { mode: 0o600 });
    }
    async getAccount(accountId) {
        const config = await this.load();
        if (accountId) {
            return config.accounts[accountId] ?? null;
        }
        if (!config.current_account) {
            return null;
        }
        return config.accounts[config.current_account] ?? null;
    }
    async setAccount(credentials) {
        const config = await this.load();
        config.accounts[credentials.account_id] = credentials;
        if (!config.current_account) {
            config.current_account = credentials.account_id;
        }
        await this.save(config);
    }
    async removeAccount(accountId) {
        const config = await this.load();
        delete config.accounts[accountId];
        if (config.current_account === accountId) {
            config.current_account = Object.keys(config.accounts)[0] ?? null;
        }
        await this.save(config);
    }
    async setCurrentAccount(accountId) {
        const config = await this.load();
        config.current_account = accountId;
        await this.save(config);
    }
    async listAccounts() {
        const config = await this.load();
        return Object.values(config.accounts).map((account) => ({
            account_id: account.account_id,
            display_name: account.display_name,
            device: account.device,
            is_current: config.current_account === account.account_id,
            created_at: account.created_at,
        }));
    }
    async clearAll() {
        if (existsSync(this.credentialsPath)) {
            await rm(this.credentialsPath, { force: true });
        }
    }
}
export { LineCredentialManager as CredentialManager };
//# sourceMappingURL=credential-manager.js.map