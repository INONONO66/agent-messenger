import { existsSync } from 'node:fs';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getConfigDir } from '../../shared/utils/config-dir.js';
import { WeChatBotConfigSchema } from './types.js';
export class WeChatBotCredentialManager {
    configDir;
    credentialsPath;
    constructor(configDir) {
        this.configDir = configDir ?? getConfigDir();
        this.credentialsPath = join(this.configDir, 'wechatbot-credentials.json');
    }
    async load() {
        if (!existsSync(this.credentialsPath)) {
            return { current: null, accounts: {} };
        }
        const content = await readFile(this.credentialsPath, 'utf-8');
        let json;
        try {
            json = JSON.parse(content);
        }
        catch {
            return { current: null, accounts: {} };
        }
        const parsed = WeChatBotConfigSchema.safeParse(json);
        if (!parsed.success) {
            return { current: null, accounts: {} };
        }
        return parsed.data;
    }
    async save(config) {
        await mkdir(this.configDir, { recursive: true });
        await writeFile(this.credentialsPath, JSON.stringify(config, null, 2), { mode: 0o600 });
        await chmod(this.credentialsPath, 0o600);
    }
    async getCredentials(accountId) {
        const envAppId = process.env.E2E_WECHATBOT_APP_ID;
        const envAppSecret = process.env.E2E_WECHATBOT_APP_SECRET;
        if (envAppId && envAppSecret && !accountId) {
            return {
                app_id: envAppId,
                app_secret: envAppSecret,
                account_name: 'env',
            };
        }
        const config = await this.load();
        if (accountId) {
            const account = config.accounts[accountId];
            if (!account)
                return null;
            return {
                app_id: account.app_id,
                app_secret: account.app_secret,
                account_name: account.account_name,
            };
        }
        if (!config.current) {
            return null;
        }
        const account = config.accounts[config.current.account_id];
        if (!account)
            return null;
        return {
            app_id: account.app_id,
            app_secret: account.app_secret,
            account_name: account.account_name,
        };
    }
    async setCredentials(entry) {
        const config = await this.load();
        config.accounts[entry.app_id] = {
            app_id: entry.app_id,
            app_secret: entry.app_secret,
            account_name: entry.account_name,
        };
        config.current = {
            account_id: entry.app_id,
        };
        await this.save(config);
    }
    async removeAccount(accountId) {
        const config = await this.load();
        if (!config.accounts[accountId]) {
            return false;
        }
        delete config.accounts[accountId];
        if (config.current?.account_id === accountId) {
            config.current = null;
        }
        await this.save(config);
        return true;
    }
    async setCurrent(accountId) {
        const config = await this.load();
        if (!config.accounts[accountId]) {
            return false;
        }
        config.current = {
            account_id: accountId,
        };
        await this.save(config);
        return true;
    }
    async listAll() {
        const config = await this.load();
        const results = [];
        for (const account of Object.values(config.accounts)) {
            results.push({
                app_id: account.app_id,
                app_secret: account.app_secret,
                account_name: account.account_name,
                is_current: config.current?.account_id === account.app_id,
            });
        }
        return results;
    }
    async clearCredentials() {
        await this.save({ current: null, accounts: {} });
    }
}
//# sourceMappingURL=credential-manager.js.map