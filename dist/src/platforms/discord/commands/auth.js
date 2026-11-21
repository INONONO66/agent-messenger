import { Command } from 'commander';
import { collectBrowserProfileOption } from '../../../shared/chromium/index.js';
import { handleError } from '../../../shared/utils/error-handler.js';
import { formatOutput } from '../../../shared/utils/output.js';
import { displayQR } from '../../../shared/utils/qr.js';
import { debug, info } from '../../../shared/utils/stderr.js';
import { DiscordClient } from '../client.js';
import { DiscordCredentialManager } from '../credential-manager.js';
import { loginWithRemoteAuth } from '../remote-auth.js';
import { DiscordTokenExtractor } from '../token-extractor.js';
export async function extractAction(options) {
    try {
        const extractor = new DiscordTokenExtractor(undefined, undefined, undefined, undefined, options.browserProfile);
        if (process.platform === 'darwin') {
            console.log('');
            console.log('  Extracting your Discord credentials...');
            console.log('');
            console.log('  Your Mac may ask for your password to access Keychain.');
            console.log('  This is required because Discord encrypts your login token');
            console.log('  using macOS Keychain for security.');
            console.log('');
            console.log('  What happens:');
            console.log("    1. We read the encrypted token from Discord's local storage");
            console.log('    2. macOS Keychain decrypts it (requires your password)');
            console.log('    3. The token is stored locally in ~/.config/agent-messenger/');
            console.log('');
            console.log('  Your password is never stored or transmitted anywhere.');
            console.log('');
        }
        if (options.debug) {
            debug(`[debug] Extracting Discord token...`);
        }
        const extracted = await extractor.extract();
        if (extracted.length === 0) {
            console.log(formatOutput({
                error: getNoDiscordTokenFoundMessage(),
                hint: options.debug ? undefined : 'Run with --debug for more info.',
            }, options.pretty));
            process.exit(1);
        }
        for (const { token } of extracted) {
            if (options.debug) {
                debug(`[debug] Token extracted: ${token.substring(0, 20)}...`);
            }
            try {
                const client = await new DiscordClient().login({ token });
                if (options.debug) {
                    debug(`[debug] Testing token validity...`);
                }
                const authInfo = await client.testAuth();
                if (options.debug) {
                    debug(`[debug] ✓ Token valid for user: ${authInfo.username}`);
                    debug(`[debug] Discovering servers...`);
                }
                const servers = await client.listServers();
                if (options.debug) {
                    debug(`[debug] ✓ Found ${servers.length} server(s)`);
                }
                if (servers.length === 0) {
                    if (options.debug) {
                        debug(`[debug] No servers found for this token, trying next...`);
                    }
                    continue;
                }
                const credManager = new DiscordCredentialManager();
                const serverMap = {};
                for (const server of servers) {
                    serverMap[server.id] = {
                        server_id: server.id,
                        server_name: server.name,
                    };
                }
                const config = {
                    token,
                    current_server: servers[0].id,
                    servers: serverMap,
                };
                await credManager.save(config);
                if (options.debug) {
                    debug(`[debug] ✓ Credentials saved`);
                }
                const output = {
                    servers: servers.map((g) => `${g.id}/${g.name}`),
                    current: servers[0].id,
                };
                console.log(formatOutput(output, options.pretty));
                return;
            }
            catch (error) {
                if (options.debug) {
                    debug(`[debug] Token validation failed: ${error.message}, trying next...`);
                }
                continue;
            }
        }
        console.log(formatOutput({
            error: 'No usable Discord token found. Tokens may be expired or have no servers.',
            hint: 'Make sure Discord is logged in to the desktop app or a supported Chromium browser, and that you are a member of at least one server.',
        }, options.pretty));
        process.exit(1);
    }
    catch (error) {
        handleError(error);
    }
}
async function saveTokenWithServers(token, credManager) {
    const client = await new DiscordClient().login({ token });
    const authInfo = await client.testAuth();
    const servers = await client.listServers();
    if (servers.length === 0)
        return null;
    const serverMap = {};
    for (const server of servers) {
        serverMap[server.id] = { server_id: server.id, server_name: server.name };
    }
    await credManager.save({ token, current_server: servers[0].id, servers: serverMap });
    return {
        username: authInfo.username,
        servers: servers.map((s) => ({ id: s.id, name: s.name })),
        current: servers[0].id,
    };
}
export async function qrAction(options) {
    try {
        const interactive = Boolean(process.stdout.isTTY);
        const debugLog = options.debug ? (msg) => debug(`[debug] ${msg}`) : undefined;
        const session = await loginWithRemoteAuth({
            debug: debugLog,
            onQrUrl: async (url) => {
                await displayQR(url, {
                    platform: 'Discord',
                    brandColor: '#5865F2',
                    scanInstruction: 'Scan with the Discord mobile app (Settings → Scan QR Code)',
                    interactive,
                    formatOutput,
                    pretty: options.pretty,
                });
            },
            onPendingLogin: (user) => {
                if (interactive)
                    info(`\nQR scanned by ${user.username}. Confirm the login on your phone...\n`);
            },
        });
        const credManager = new DiscordCredentialManager();
        const saved = await saveTokenWithServers(session.token, credManager);
        if (!saved) {
            console.log(formatOutput({
                error: 'Logged in, but this account is not a member of any server.',
                hint: 'Join at least one server, then run this command again.',
            }, options.pretty));
            process.exit(1);
        }
        console.log(formatOutput({ user: saved.username, servers: saved.servers.map((s) => `${s.id}/${s.name}`), current: saved.current }, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}
export async function logoutAction(options) {
    try {
        const credManager = new DiscordCredentialManager();
        const config = await credManager.load();
        if (!config.token) {
            console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty));
            process.exit(1);
        }
        await credManager.clearToken();
        console.log(formatOutput({ removed: 'discord', success: true }, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}
export async function statusAction(options) {
    try {
        const credManager = new DiscordCredentialManager();
        const config = await credManager.load();
        if (!config.token) {
            console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty));
            process.exit(1);
        }
        let authInfo = null;
        let valid = false;
        try {
            const client = await new DiscordClient().login({ token: config.token });
            authInfo = await client.testAuth();
            valid = true;
        }
        catch {
            valid = false;
        }
        const output = {
            authenticated: valid,
            user: authInfo?.username,
            current_server: config.current_server,
            servers_count: Object.keys(config.servers).length,
        };
        console.log(formatOutput(output, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}
export function getNoDiscordTokenFoundMessage() {
    return 'No Discord token found. Make sure Discord is logged in to the desktop app or a supported Chromium browser.';
}
export const authCommand = new Command('auth')
    .description('Authentication commands')
    .addCommand(new Command('extract')
    .description('Extract token from Discord desktop app or a supported Chromium browser')
    .option('--pretty', 'Pretty print JSON output')
    .option('--debug', 'Show debug output for troubleshooting')
    .option('--browser-profile <path>', 'Additional Chromium profile/user-data directory to scan (repeatable, comma-separated supported)', collectBrowserProfileOption, [])
    .action(extractAction))
    .addCommand(new Command('qr')
    .description('Sign in by scanning a QR code with the Discord mobile app')
    .option('--pretty', 'Pretty print JSON output')
    .option('--debug', 'Show debug output for troubleshooting')
    .action(qrAction))
    .addCommand(new Command('logout')
    .description('Logout from Discord')
    .option('--pretty', 'Pretty print JSON output')
    .action(logoutAction))
    .addCommand(new Command('status')
    .description('Show authentication status')
    .option('--pretty', 'Pretty print JSON output')
    .action(statusAction));
//# sourceMappingURL=auth.js.map