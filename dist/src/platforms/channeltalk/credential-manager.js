import { existsSync } from 'node:fs';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getConfigDir } from '../../shared/utils/config-dir.js';
import { ChannelConfigSchema } from './types.js';
export class ChannelCredentialManager {
    configDir;
    credentialsPath;
    constructor(configDir) {
        this.configDir = configDir ?? getConfigDir();
        this.credentialsPath = join(this.configDir, 'channel-credentials.json');
    }
    async load() {
        if (!existsSync(this.credentialsPath)) {
            return { current: null, workspaces: {} };
        }
        const content = await readFile(this.credentialsPath, 'utf-8');
        let json;
        try {
            json = JSON.parse(content);
        }
        catch {
            return { current: null, workspaces: {} };
        }
        const parsed = ChannelConfigSchema.safeParse(json);
        if (!parsed.success) {
            return { current: null, workspaces: {} };
        }
        return parsed.data;
    }
    async save(config) {
        await mkdir(this.configDir, { recursive: true });
        await writeFile(this.credentialsPath, JSON.stringify(config, null, 2), { mode: 0o600 });
        await chmod(this.credentialsPath, 0o600);
    }
    async getCredentials(workspaceId) {
        const envAccountCookie = process.env.E2E_CHANNEL_ACCOUNT_COOKIE;
        const envSessionCookie = process.env.E2E_CHANNEL_SESSION_COOKIE;
        const envWorkspaceId = process.env.E2E_CHANNEL_WORKSPACE_ID;
        if (envAccountCookie && envWorkspaceId && !workspaceId) {
            return {
                workspace_id: envWorkspaceId,
                workspace_name: 'env',
                account_cookie: envAccountCookie,
                session_cookie: envSessionCookie,
            };
        }
        const config = await this.load();
        if (workspaceId) {
            const workspace = config.workspaces[workspaceId];
            if (!workspace)
                return null;
            return {
                workspace_id: workspace.workspace_id,
                workspace_name: workspace.workspace_name,
                account_cookie: workspace.account_cookie,
                session_cookie: workspace.session_cookie,
            };
        }
        if (!config.current) {
            return null;
        }
        const workspace = config.workspaces[config.current.workspace_id];
        if (!workspace)
            return null;
        return {
            workspace_id: workspace.workspace_id,
            workspace_name: workspace.workspace_name,
            account_cookie: workspace.account_cookie,
            session_cookie: workspace.session_cookie,
        };
    }
    async setCredentials(entry) {
        const config = await this.load();
        config.workspaces[entry.workspace_id] = {
            workspace_id: entry.workspace_id,
            workspace_name: entry.workspace_name,
            account_id: entry.account_id,
            account_name: entry.account_name,
            account_cookie: entry.account_cookie,
            session_cookie: entry.session_cookie,
        };
        config.current = {
            workspace_id: entry.workspace_id,
        };
        await this.save(config);
    }
    async removeWorkspace(workspaceId) {
        const config = await this.load();
        if (!config.workspaces[workspaceId]) {
            return false;
        }
        delete config.workspaces[workspaceId];
        if (config.current?.workspace_id === workspaceId) {
            config.current = null;
        }
        await this.save(config);
        return true;
    }
    async setCurrent(workspaceId) {
        const config = await this.load();
        if (!config.workspaces[workspaceId]) {
            return false;
        }
        config.current = {
            workspace_id: workspaceId,
        };
        await this.save(config);
        return true;
    }
    async listAll() {
        const config = await this.load();
        const results = [];
        for (const workspace of Object.values(config.workspaces)) {
            results.push({
                workspace_id: workspace.workspace_id,
                workspace_name: workspace.workspace_name,
                account_id: workspace.account_id,
                account_name: workspace.account_name,
                account_cookie: workspace.account_cookie,
                session_cookie: workspace.session_cookie,
                is_current: config.current?.workspace_id === workspace.workspace_id,
            });
        }
        return results;
    }
    async clearCredentials() {
        await this.save({ current: null, workspaces: {} });
    }
}
//# sourceMappingURL=credential-manager.js.map