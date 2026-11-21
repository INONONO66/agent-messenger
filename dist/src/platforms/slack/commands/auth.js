import { Command } from 'commander';
import { collectBrowserProfileOption } from '../../../shared/chromium/index.js';
import { handleError } from '../../../shared/utils/error-handler.js';
import { formatOutput } from '../../../shared/utils/output.js';
import { debug } from '../../../shared/utils/stderr.js';
import { SlackClient, SlackError } from '../client.js';
import { CredentialManager, getSelectedWorkspaceId } from '../credential-manager.js';
import { refreshCookie, refreshKnownWorkspaceDomains, tryWebTokenRefresh } from '../ensure-auth.js';
import { loginWithQr } from '../qr-http-login.js';
import { TokenExtractor } from '../token-extractor.js';
export function formatCredentialDebug(ws, showSecrets) {
    const tokenDisplay = showSecrets ? ws.token : `${ws.token.substring(0, 20)}...`;
    const cookieDisplay = showSecrets ? ws.cookie : ws.cookie ? 'present' : 'missing';
    return `${ws.workspace_id}: token=${tokenDisplay}, cookie=${cookieDisplay}`;
}
async function extractAction(options) {
    try {
        if (options.unsafelyShowSecrets) {
            options.debug = true;
        }
        const debugLog = options.debug ? (msg) => debug(`[debug] ${msg}`) : undefined;
        const extractor = new TokenExtractor(undefined, undefined, undefined, debugLog, options.browserProfile);
        if (process.platform === 'darwin') {
            console.log('');
            console.log('  Extracting your Slack credentials...');
            console.log('');
            console.log('  Your Mac may ask for your password to access Keychain.');
            console.log('  This is required because Slack encrypts your login cookies');
            console.log('  using macOS Keychain for security.');
            console.log('');
            console.log('  What happens:');
            console.log("    1. We read the encrypted cookie from Slack's local storage");
            console.log('    2. macOS Keychain decrypts it (requires your password)');
            console.log('    3. The credentials are stored locally in ~/.config/agent-messenger/');
            console.log('');
            console.log('  Your password is never stored or transmitted anywhere.');
            console.log('');
        }
        if (options.debug) {
            debug(`[debug] Slack directory: ${extractor.getSlackDir()}`);
        }
        const workspaces = await extractor.extract();
        if (options.debug) {
            debug(`[debug] Found ${workspaces.length} workspace(s)`);
            for (const ws of workspaces) {
                debug(`[debug] - ${formatCredentialDebug(ws, options.unsafelyShowSecrets)}`);
            }
        }
        if (workspaces.length === 0) {
            console.log(formatOutput({
                error: getNoWorkspacesFoundMessage(),
                hint: options.debug ? undefined : 'Run with --debug for more info.',
            }, options.pretty));
            process.exit(1);
        }
        const credManager = new CredentialManager();
        const config = await credManager.load();
        const workspaceDomains = extractor.getWorkspaceDomains();
        const validWorkspaces = [];
        const failureReasons = [];
        const resolvedTeamIds = new Set();
        const refreshCache = new Map();
        for (const ws of workspaces) {
            if (options.debug) {
                debug(`[debug] Testing credentials for ${ws.workspace_id}...`);
            }
            try {
                const client = await new SlackClient().login({ token: ws.token, cookie: ws.cookie });
                const authInfo = await client.testAuth();
                if (!authInfo.team_id)
                    throw new SlackError('testAuth returned empty team_id', 'invalid_auth');
                ws.workspace_id = authInfo.team_id;
                ws.workspace_name = authInfo.team || ws.workspace_name;
                if (!resolvedTeamIds.has(ws.workspace_id)) {
                    resolvedTeamIds.add(ws.workspace_id);
                    validWorkspaces.push(ws);
                    await credManager.setWorkspace(ws);
                }
                if (options.debug) {
                    debug(`[debug] ✓ Valid: ${authInfo.team} (${authInfo.user})`);
                }
            }
            catch (error) {
                const code = error instanceof SlackError ? error.code : undefined;
                if (code && !failureReasons.includes(code)) {
                    failureReasons.push(code);
                }
                if (options.debug) {
                    debug(`[debug] ✗ Invalid: ${error.message}`);
                }
                if (options.debug) {
                    const domain = workspaceDomains[ws.workspace_id];
                    const target = domain
                        ? `${ws.workspace_id} (${domain}.slack.com)`
                        : `${ws.workspace_id} (trying all known domains)`;
                    debug(`[debug] Attempting web token refresh for ${target}...`);
                }
                const refreshed = await tryWebTokenRefresh(ws, workspaceDomains, { resolvedTeamIds, refreshCache });
                if (refreshed && !resolvedTeamIds.has(refreshed.workspace_id)) {
                    ws.token = refreshed.token;
                    ws.workspace_id = refreshed.workspace_id;
                    ws.workspace_name = refreshed.workspace_name;
                    resolvedTeamIds.add(ws.workspace_id);
                    validWorkspaces.push(ws);
                    await credManager.setWorkspace(ws);
                    if (options.debug) {
                        debug(`[debug] ✓ Web refresh succeeded: ${refreshed.workspace_id}/${refreshed.workspace_name}`);
                    }
                }
                else if (options.debug) {
                    debug('[debug] ✗ Web refresh failed');
                }
            }
        }
        for (const cookie of new Set(workspaces.map((ws) => ws.cookie).filter(Boolean))) {
            const enumerated = await refreshKnownWorkspaceDomains(cookie, workspaceDomains, {
                resolvedTeamIds,
                refreshCache,
            });
            for (const result of enumerated) {
                const ws = {
                    workspace_id: result.workspace_id,
                    workspace_name: result.workspace_name,
                    token: result.token,
                    cookie,
                };
                validWorkspaces.push(ws);
                await credManager.setWorkspace(ws);
                if (options.debug) {
                    debug(`[debug] ✓ Recovered via domain enumeration: ${result.workspace_id}/${result.workspace_name}`);
                }
            }
        }
        if (validWorkspaces.length === 0) {
            const errorMessage = getExtractionErrorMessage(failureReasons);
            console.log(formatOutput({
                error: errorMessage,
                extracted_count: workspaces.length,
                hint: options.debug ? undefined : 'Run with --debug for more details.',
            }, options.pretty));
            process.exit(1);
        }
        if (!config.current_workspace && validWorkspaces.length > 0) {
            await credManager.setCurrentWorkspace(validWorkspaces[0].workspace_id);
        }
        const output = {
            workspaces: validWorkspaces.map((ws) => `${ws.workspace_id}/${ws.workspace_name}`),
            current: config.current_workspace || validWorkspaces[0].workspace_id,
        };
        console.log(formatOutput(output, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}
async function logoutAction(workspace, options) {
    try {
        const credManager = new CredentialManager();
        const config = await credManager.load();
        let targetWorkspace = workspace ?? getSelectedWorkspaceId() ?? undefined;
        if (!targetWorkspace) {
            if (!config.current_workspace) {
                console.log(formatOutput({ error: 'No current workspace set. Specify a workspace ID.' }, options.pretty));
                process.exit(1);
            }
            targetWorkspace = config.current_workspace;
        }
        if (!config.workspaces[targetWorkspace]) {
            console.log(formatOutput({
                error: `Workspace not found: ${targetWorkspace}`,
                hint: 'Run "workspace list" to see available workspaces.',
            }, options.pretty));
            process.exit(1);
        }
        await credManager.removeWorkspace(targetWorkspace);
        console.log(formatOutput({ removed: targetWorkspace, success: true }, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}
async function statusAction(options) {
    try {
        const credManager = new CredentialManager();
        const ws = await credManager.getWorkspace();
        if (!ws) {
            const selectedWorkspace = getSelectedWorkspaceId();
            console.log(formatOutput(selectedWorkspace
                ? {
                    error: `Workspace not found: ${selectedWorkspace}`,
                    hint: 'Run "workspace list" to see available workspaces.',
                }
                : { error: 'No current workspace set. Run "auth extract" first.' }, options.pretty));
            process.exit(1);
        }
        let authInfo = null;
        let valid = false;
        try {
            const client = await new SlackClient().login({ token: ws.token, cookie: ws.cookie });
            authInfo = await client.testAuth();
            valid = true;
        }
        catch {
            authInfo = await refreshCookie(ws.token, credManager);
            valid = authInfo !== null;
        }
        const output = {
            workspace_id: ws.workspace_id,
            workspace_name: ws.workspace_name,
            user: authInfo?.user,
            team: authInfo?.team,
            valid,
        };
        console.log(formatOutput(output, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}
async function qrAction(imageArg, options) {
    try {
        const dataUrl = imageArg ?? (await readStdin());
        if (!dataUrl) {
            console.log(formatOutput({
                error: 'No QR image provided. Pass the copied QR image data URL as an argument, or pipe it via stdin.',
                hint: 'In Slack: your name (top-left) → "Sign in on mobile" → right-click the QR → Copy Image Address.',
            }, options.pretty));
            process.exit(1);
        }
        const debugLog = options.debug ? (msg) => debug(`[debug] ${msg}`) : undefined;
        const session = await loginWithQr(dataUrl, { debug: debugLog });
        const client = await new SlackClient().login({ token: session.token, cookie: session.cookie });
        const authInfo = await client.testAuth();
        const credManager = new CredentialManager();
        const workspace = {
            workspace_id: authInfo.team_id,
            workspace_name: authInfo.team || session.workspace,
            token: session.token,
            cookie: session.cookie,
        };
        await credManager.setWorkspace(workspace);
        const config = await credManager.load();
        if (!config.current_workspace) {
            await credManager.setCurrentWorkspace(workspace.workspace_id);
        }
        console.log(formatOutput({
            workspace: `${workspace.workspace_id}/${workspace.workspace_name}`,
            user: authInfo.user,
            current: (await credManager.load()).current_workspace,
        }, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}
function readStdin() {
    if (process.stdin.isTTY)
        return Promise.resolve('');
    return new Promise((resolve) => {
        let data = '';
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', (chunk) => {
            data += chunk;
        });
        process.stdin.on('end', () => resolve(data));
        process.stdin.on('error', () => resolve(data));
    });
}
export function getExtractionErrorMessage(failureReasons) {
    if (failureReasons.includes('missing_cookie')) {
        return 'Cookie extraction failed. Grant Keychain access when prompted, and make sure you are signed into Slack in the desktop app or a supported Chromium browser.';
    }
    if (failureReasons.includes('invalid_auth')) {
        return 'Slack session has expired. Sign into Slack in the desktop app or a supported Chromium browser, wait a few seconds, then re-run this command.';
    }
    return 'Extracted tokens are invalid. Make sure you are logged into Slack in the desktop app or a supported Chromium browser.';
}
export function getNoWorkspacesFoundMessage() {
    return 'No workspaces found. Make sure you are logged into Slack in the desktop app or a supported Chromium browser.';
}
export const authCommand = new Command('auth')
    .description('Authentication commands')
    .addCommand(new Command('extract')
    .description('Extract tokens from Slack desktop app or a supported Chromium browser')
    .option('--pretty', 'Pretty print JSON output')
    .option('--debug', 'Show debug output for troubleshooting')
    .option('--browser-profile <path>', 'Additional Chromium profile/user-data directory to scan (repeatable, comma-separated supported)', collectBrowserProfileOption, [])
    .option('--unsafely-show-secrets', 'Show full token and cookie values in debug output')
    .action((options) => extractAction(options)))
    .addCommand(new Command('qr')
    .description('Sign in by pasting a QR code from Slack\u2019s "Sign in on mobile" screen')
    .argument('[image]', 'QR image data URL (data:image/png;base64,...); read from stdin if omitted')
    .option('--pretty', 'Pretty print JSON output')
    .option('--debug', 'Show debug output for troubleshooting')
    .action(qrAction))
    .addCommand(new Command('logout')
    .description('Logout from workspace')
    .argument('[workspace]', 'Workspace ID')
    .option('--pretty', 'Pretty print JSON output')
    .action(logoutAction))
    .addCommand(new Command('status')
    .description('Show authentication status')
    .option('--pretty', 'Pretty print JSON output')
    .action(statusAction));
//# sourceMappingURL=auth.js.map