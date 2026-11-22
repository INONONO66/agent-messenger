import { Command } from 'commander';
import { collectBrowserProfileOption } from '../../../shared/chromium/index.js';
import { formatOutput } from '../../../shared/utils/output.js';
import { ChannelClient } from '../client.js';
import { ChannelCredentialManager } from '../credential-manager.js';
import { ChannelTokenExtractor } from '../token-extractor.js';
let createChannelClient = async (accountCookie, sessionCookie) => new ChannelClient().login({ accountCookie, sessionCookie });
let createCredentialManager = () => new ChannelCredentialManager();
let createTokenExtractor = (browserProfile) => new ChannelTokenExtractor(undefined, browserProfile);
export function setChannelAuthCommandDependenciesForTesting(dependencies) {
    if (dependencies.createChannelClient)
        createChannelClient = dependencies.createChannelClient;
    if (dependencies.createCredentialManager)
        createCredentialManager = dependencies.createCredentialManager;
    if (dependencies.createTokenExtractor)
        createTokenExtractor = dependencies.createTokenExtractor;
}
export function resetChannelAuthCommandDependenciesForTesting() {
    createChannelClient = async (accountCookie, sessionCookie) => new ChannelClient().login({ accountCookie, sessionCookie });
    createCredentialManager = () => new ChannelCredentialManager();
    createTokenExtractor = (browserProfile) => new ChannelTokenExtractor(undefined, browserProfile);
}
export async function extractAction(options = {}) {
    try {
        const credManager = options._credManager ?? createCredentialManager();
        const extractor = createTokenExtractor(options.browserProfile);
        const extracted = await extractor.extract();
        if (extracted.length === 0) {
            return {
                error: getNoChannelTalkCredentialsMessage(),
            };
        }
        for (const cookies of extracted) {
            try {
                const client = await createChannelClient(cookies.accountCookie, cookies.sessionCookie);
                const account = await client.getAccount();
                const channels = await client.listChannels();
                if (channels.length === 0)
                    continue;
                const previousCurrent = await credManager.getCredentials();
                for (const channel of channels) {
                    await credManager.setCredentials({
                        workspace_id: channel.id,
                        workspace_name: channel.name,
                        account_id: account.id,
                        account_name: account.name,
                        account_cookie: cookies.accountCookie,
                        session_cookie: cookies.sessionCookie,
                    });
                }
                const previousStillExists = previousCurrent && channels.some((ch) => ch.id === previousCurrent.workspace_id);
                const currentId = previousStillExists ? previousCurrent.workspace_id : channels[0].id;
                await credManager.setCurrent(currentId);
                return {
                    success: true,
                    workspaces: channels.map((ch) => ({
                        workspace_id: ch.id,
                        workspace_name: ch.name,
                    })),
                    current_workspace_id: currentId,
                };
            }
            catch {
                continue;
            }
        }
        return { error: getNoValidChannelTalkCredentialsMessage() };
    }
    catch (error) {
        return { error: error.message };
    }
}
export function getNoChannelTalkCredentialsMessage() {
    return 'No credentials. Make sure Channel Talk is logged in to the desktop app or a supported Chromium browser.';
}
export function getNoValidChannelTalkCredentialsMessage() {
    return 'No valid credentials found. Make sure Channel Talk is logged in to the desktop app or a supported Chromium browser.';
}
export async function statusAction(options = {}) {
    try {
        const credManager = options._credManager ?? createCredentialManager();
        const creds = await credManager.getCredentials(options.workspace);
        if (!creds) {
            return {
                valid: false,
                error: options.workspace
                    ? `Workspace "${options.workspace}" not found. Run "auth list" to see available workspaces.`
                    : 'No credentials. Run "agent-channeltalk auth extract" first.',
            };
        }
        const storedWorkspace = (await credManager.listAll()).find((workspace) => workspace.workspace_id === creds.workspace_id);
        try {
            const client = await createChannelClient(creds.account_cookie, creds.session_cookie ?? undefined);
            const account = await client.getAccount();
            return {
                valid: true,
                workspace_id: creds.workspace_id,
                workspace_name: creds.workspace_name,
                account_name: account.name,
            };
        }
        catch (error) {
            return {
                valid: false,
                workspace_id: creds.workspace_id,
                workspace_name: creds.workspace_name,
                account_name: storedWorkspace?.account_name,
                error: error.message,
            };
        }
    }
    catch (error) {
        return { valid: false, error: error.message };
    }
}
export async function clearAction(options = {}) {
    try {
        const credManager = options._credManager ?? createCredentialManager();
        await credManager.clearCredentials();
        return { success: true };
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function listAction(options = {}) {
    try {
        const credManager = options._credManager ?? createCredentialManager();
        const all = await credManager.listAll();
        return all.map((workspace) => ({
            workspace_id: workspace.workspace_id,
            workspace_name: workspace.workspace_name,
            is_current: workspace.is_current,
        }));
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function useAction(workspaceId, options = {}) {
    try {
        const credManager = options._credManager ?? createCredentialManager();
        const found = await credManager.setCurrent(workspaceId);
        if (!found) {
            return { error: `Workspace "${workspaceId}" not found. Run "auth list" to see available workspaces.` };
        }
        return {
            success: true,
            workspace_id: workspaceId,
        };
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function removeAction(workspaceId, options = {}) {
    try {
        const credManager = options._credManager ?? createCredentialManager();
        const removed = await credManager.removeWorkspace(workspaceId);
        if (!removed) {
            return { error: `Workspace "${workspaceId}" not found. Run "auth list" to see available workspaces.` };
        }
        return {
            success: true,
            workspace_id: workspaceId,
        };
    }
    catch (error) {
        return { error: error.message };
    }
}
function cliOutput(result, pretty, exitOnError = true) {
    console.log(formatOutput(result, pretty));
    if (exitOnError && !Array.isArray(result) && 'error' in result && result.error) {
        process.exit(1);
    }
}
export function createAuthCommand() {
    return new Command('auth')
        .description('Authentication commands')
        .addCommand(new Command('extract')
        .description('Extract cookies from Channel Talk desktop app or a supported Chromium browser')
        .option('--pretty', 'Pretty print JSON output')
        .option('--browser-profile <path>', 'Additional Chromium profile/user-data directory to scan (repeatable, comma-separated supported)', collectBrowserProfileOption, [])
        .action(async (opts) => {
        cliOutput(await extractAction(opts), opts.pretty);
    }))
        .addCommand(new Command('status')
        .description('Show authentication status')
        .option('--workspace <id>', 'Check specific workspace (default: current)')
        .option('--pretty', 'Pretty print JSON output')
        .action(async (opts) => {
        const result = await statusAction(opts);
        console.log(formatOutput(result, opts.pretty));
        if (!result.valid) {
            process.exit(1);
        }
    }))
        .addCommand(new Command('clear')
        .description('Clear all stored credentials')
        .option('--pretty', 'Pretty print JSON output')
        .action(async (opts) => {
        cliOutput(await clearAction(opts), opts.pretty);
    }))
        .addCommand(new Command('list')
        .description('List all stored workspaces')
        .option('--pretty', 'Pretty print JSON output')
        .action(async (opts) => {
        cliOutput(await listAction(opts), opts.pretty);
    }))
        .addCommand(new Command('use')
        .description('Switch active workspace')
        .argument('<workspace-id>', 'Workspace ID')
        .option('--pretty', 'Pretty print JSON output')
        .action(async (workspaceId, opts) => {
        cliOutput(await useAction(workspaceId, opts), opts.pretty);
    }))
        .addCommand(new Command('remove')
        .description('Remove a stored workspace')
        .argument('<workspace-id>', 'Workspace ID')
        .option('--pretty', 'Pretty print JSON output')
        .action(async (workspaceId, opts) => {
        cliOutput(await removeAction(workspaceId, opts), opts.pretty);
    }));
}
export const authCommand = createAuthCommand();
//# sourceMappingURL=auth.js.map