import { existsSync } from 'node:fs';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getConfigDir } from '../../shared/utils/config-dir.js';
import { WebexBotConfigSchema } from './types.js';
export class WebexBotCredentialManager {
    configDir;
    credentialsPath;
    constructor(configDir) {
        this.configDir = configDir ?? getConfigDir();
        this.credentialsPath = join(this.configDir, 'webexbot-credentials.json');
    }
    async load() {
        if (!existsSync(this.credentialsPath)) {
            return { current: null, bots: {} };
        }
        const content = await readFile(this.credentialsPath, 'utf-8');
        let json;
        try {
            json = JSON.parse(content);
        }
        catch {
            return { current: null, bots: {} };
        }
        const parsed = WebexBotConfigSchema.safeParse(json);
        if (!parsed.success) {
            return { current: null, bots: {} };
        }
        return parsed.data;
    }
    async save(config) {
        await mkdir(this.configDir, { recursive: true });
        await writeFile(this.credentialsPath, JSON.stringify(config, null, 2), { mode: 0o600 });
        await chmod(this.credentialsPath, 0o600);
    }
    async getCredentials(botId) {
        const envToken = process.env.E2E_WEBEXBOT_TOKEN;
        if (envToken && !botId) {
            return {
                token: envToken,
                bot_id: 'env',
                bot_name: 'env',
            };
        }
        const config = await this.load();
        if (botId) {
            const bot = config.bots[botId];
            if (!bot)
                return null;
            return {
                token: bot.token,
                bot_id: bot.bot_id,
                bot_name: bot.bot_name,
            };
        }
        if (!config.current) {
            return null;
        }
        const bot = config.bots[config.current.bot_id];
        if (!bot)
            return null;
        return {
            token: bot.token,
            bot_id: bot.bot_id,
            bot_name: bot.bot_name,
        };
    }
    async setCredentials(creds) {
        const config = await this.load();
        config.bots[creds.bot_id] = {
            bot_id: creds.bot_id,
            bot_name: creds.bot_name,
            token: creds.token,
        };
        config.current = {
            bot_id: creds.bot_id,
        };
        await this.save(config);
    }
    async removeBot(botId) {
        const config = await this.load();
        if (!config.bots[botId]) {
            return false;
        }
        delete config.bots[botId];
        if (config.current?.bot_id === botId) {
            config.current = null;
        }
        await this.save(config);
        return true;
    }
    async setCurrent(botId) {
        const config = await this.load();
        if (!config.bots[botId]) {
            return false;
        }
        config.current = {
            bot_id: botId,
        };
        await this.save(config);
        return true;
    }
    async listAll() {
        const config = await this.load();
        const results = [];
        for (const bot of Object.values(config.bots)) {
            results.push({
                token: bot.token,
                bot_id: bot.bot_id,
                bot_name: bot.bot_name,
                is_current: config.current?.bot_id === bot.bot_id,
            });
        }
        return results;
    }
    async clearCredentials() {
        await this.save({ current: null, bots: {} });
    }
}
//# sourceMappingURL=credential-manager.js.map