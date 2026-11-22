import { Command } from 'commander';
import { collectBrowserProfileOption } from '../../../shared/chromium/index.js';
import { handleError } from '../../../shared/utils/error-handler.js';
import { isInteractive } from '../../../shared/utils/interactive.js';
import { formatOutput } from '../../../shared/utils/output.js';
import { debug, info } from '../../../shared/utils/stderr.js';
import { TeamsClient } from '../client.js';
import { TeamsCredentialManager } from '../credential-manager.js';
import { completeDeviceCode, loginWithDeviceCode, PendingApprovalError, startDeviceCode } from '../device-login.js';
import { probeAccountType } from '../realm-discovery.js';
import { TeamsTokenExtractor } from '../token-extractor.js';
export async function loginAction(options) {
    try {
        const explicitAccountType = resolveLoginAccountType(options.accountType);
        if (options.deviceCode) {
            await finishDeviceCode(options, explicitAccountType);
            return;
        }
        if (!isInteractive()) {
            const accountType = options.email
                ? await resolveAccountTypeFromEmail(options, explicitAccountType)
                : explicitAccountType;
            await startNonInteractiveLogin(options.clientId, accountType);
            return;
        }
        const debugLog = options.debug ? (msg) => debug(`[debug] ${msg}`) : undefined;
        const accountType = await resolveAccountTypeFromEmail(options, explicitAccountType);
        const result = await loginWithDeviceCode({
            clientId: options.clientId,
            accountType,
            onCode: async ({ verificationUri, userCode }) => {
                info(`\nTo sign in, open ${verificationUri} and enter code ${userCode}\n`);
                info(`Waiting for approval of code ${userCode}...`);
            },
            onPending: () => info('Approved. Finishing sign-in...'),
            debug: debugLog,
        });
        console.log(formatOutput({
            authenticated: true,
            account_type: result.accountType,
            user: result.userName,
            teams: result.teams.map((t) => `${t.id}/${t.name}`),
            current: result.current,
        }, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}
function resolveLoginAccountType(value) {
    if (value === undefined)
        return 'work';
    if (value === 'work' || value === 'personal')
        return value;
    throw new Error('Invalid account type. Use "work" or "personal".');
}
// When the user did not force --account-type, look the account up by email so a
// personal account is routed to the personal flow up front instead of failing
// after approval. Any misstep falls back to the caller's default account type.
async function resolveAccountTypeFromEmail(options, fallback) {
    if (options.accountType !== undefined)
        return fallback;
    const email = options.email ?? (isInteractive() ? await promptEmail() : undefined);
    if (!email)
        return fallback;
    const probed = await probeAccountType(email);
    if (!probed)
        return fallback;
    if (probed === 'personal') {
        info('Detected a personal Microsoft account. Using personal sign-in.');
    }
    return probed;
}
async function promptEmail() {
    const { createInterface } = await import('node:readline/promises');
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    try {
        const answer = await rl.question('Microsoft email (press Enter to skip): ');
        return answer.trim() || undefined;
    }
    finally {
        rl.close();
    }
}
async function startNonInteractiveLogin(clientIdOverride, accountType) {
    const { info: device, clientId } = await startDeviceCode(clientIdOverride, accountType);
    const clientIdFlag = clientIdOverride ? ` --client-id ${clientIdOverride}` : '';
    const accountTypeFlag = accountType === 'personal' ? ' --account-type personal' : '';
    console.log(formatOutput({
        next_action: 'authorize',
        account_type: accountType,
        verification_uri: device.verificationUri,
        verification_uri_complete: device.verificationUriComplete,
        user_code: device.userCode,
        device_code: device.deviceCode,
        client_id: clientId,
        expires_at: Date.now() + device.expiresIn * 1000,
        message: `Show the user \`verification_uri\` and \`user_code\` (or \`verification_uri_complete\`) and ask them to approve in a browser. After they approve, run \`agent-teams auth login --device-code <device_code>${clientIdFlag}${accountTypeFlag}\` to finish.`,
    }));
    process.exit(0);
}
async function finishDeviceCode(options, accountType) {
    const { getTeamsAppClientId } = await import('../app-config.js');
    const clientId = options.clientId ?? getTeamsAppClientId(accountType).clientId;
    try {
        const result = await completeDeviceCode(options.deviceCode, clientId, undefined, accountType);
        console.log(formatOutput({
            authenticated: true,
            account_type: result.accountType,
            user: result.userName,
            teams: result.teams.map((t) => `${t.id}/${t.name}`),
            current: result.current,
        }, options.pretty));
    }
    catch (error) {
        if (error instanceof PendingApprovalError) {
            const clientIdFlag = options.clientId ? ` --client-id ${options.clientId}` : '';
            const accountTypeFlag = options.accountType ? ` --account-type ${accountType}` : '';
            console.log(formatOutput({
                next_action: 'still_pending',
                device_code: options.deviceCode,
                message: `User has not approved yet. Confirm they completed authorization in the browser, then run \`agent-teams auth login --device-code <device_code>${clientIdFlag}${accountTypeFlag}\` again.`,
            }, options.pretty));
            process.exit(0);
        }
        console.log(formatOutput({
            next_action: 'restart',
            error: error.message,
            message: 'This device code is no longer valid. Run `agent-teams auth login` to start over.',
        }, options.pretty));
        process.exit(1);
    }
}
async function validateTokenWithProbe(token, accountType, accountTypeKnown, debugLog) {
    const primaryTypes = [accountType];
    if (!accountTypeKnown) {
        primaryTypes.push(accountType === 'work' ? 'personal' : 'work');
    }
    let lastError = null;
    for (const candidateType of primaryTypes) {
        try {
            const client = await new TeamsClient().login({ token, accountType: candidateType });
            const authInfo = await client.testAuth();
            if (candidateType !== accountType) {
                debugLog?.(`[debug] Reclassified ${accountType} → ${candidateType} via API probe`);
            }
            return { client, accountType: candidateType, authInfo };
        }
        catch (error) {
            lastError = error;
            debugLog?.(`[debug] Probe ${candidateType} failed: ${lastError.message}`);
        }
    }
    throw lastError ?? new Error('Token validation failed');
}
export async function extractAction(options) {
    try {
        if (options.token) {
            await extractManualToken(options.token, options);
            return;
        }
        const debugLog = options.debug ? (msg) => debug(`[debug] ${msg}`) : undefined;
        const extractor = new TeamsTokenExtractor(undefined, undefined, debugLog, options.browserProfile);
        if (process.platform === 'darwin') {
            console.log('');
            console.log('  Extracting your Microsoft Teams credentials...');
            console.log('');
            console.log('  Your Mac may ask for your password to access Keychain.');
            console.log('  This is required because Teams encrypts your login token');
            console.log('  using macOS Keychain for security.');
            console.log('');
            console.log('  What happens:');
            console.log("    1. We read the encrypted token from Teams' cookies");
            console.log('    2. macOS Keychain decrypts it (requires your password)');
            console.log('    3. The token is stored locally in ~/.config/agent-messenger/');
            console.log('');
            console.log('  Your password is never stored or transmitted anywhere.');
            console.log('');
        }
        if (options.debug) {
            debug('[debug] Extracting Teams tokens from all accounts...');
        }
        const extracted = await extractor.extract();
        if (extracted.length === 0) {
            console.log(formatOutput({
                error: getNoTeamsTokenFoundMessage(),
                hint: 'Run with --token <token> to manually provide a token, or --debug for more info.',
            }, options.pretty));
            process.exit(1);
        }
        if (options.debug) {
            debug(`[debug] Found ${extracted.length} account(s)`);
        }
        const credManager = new TeamsCredentialManager();
        const config = { current_account: null, accounts: {} };
        const outputAccounts = [];
        for (const { token, accountType: extractedType, accountTypeKnown } of extracted) {
            if (options.debug) {
                const label = accountTypeKnown ? extractedType : `${extractedType} (probing)`;
                debug(`[debug] Validating ${label} account token...`);
            }
            try {
                const debugLog = options.debug ? (msg) => debug(msg) : undefined;
                const { client, accountType, authInfo } = await validateTokenWithProbe(token, extractedType, accountTypeKnown, debugLog);
                const teams = await client.listTeams();
                if (options.debug) {
                    debug(`[debug] ✓ ${accountType}: ${authInfo.displayName} (${teams.length} team(s))`);
                }
                if (config.accounts[accountType]) {
                    if (options.debug) {
                        debug(`[debug] Skipping duplicate ${accountType} account`);
                    }
                    continue;
                }
                const teamMap = {};
                for (const team of teams) {
                    teamMap[team.id] = { team_id: team.id, team_name: team.name };
                }
                const account = {
                    token,
                    token_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                    region: client.getRegion(),
                    account_type: accountType,
                    user_name: authInfo.displayName,
                    current_team: teams[0]?.id ?? null,
                    teams: teamMap,
                };
                config.accounts[accountType] = account;
                if (!config.current_account) {
                    config.current_account = accountType;
                }
                outputAccounts.push({
                    account_type: accountType,
                    user: authInfo.displayName,
                    teams: teams.map((t) => `${t.id}/${t.name}`),
                });
            }
            catch (error) {
                const errorMessage = error.message;
                const is401 = errorMessage.includes('401') || errorMessage.includes('Unauthorized');
                if (options.debug) {
                    debug(`[debug] ✗ ${extractedType}: ${errorMessage}`);
                }
                if (extracted.length === 1) {
                    console.log(formatOutput({
                        error: `Token validation failed: ${errorMessage}`,
                        hint: is401
                            ? 'Token expired. Open Microsoft Teams in the desktop app or a supported Chromium browser, send a message to refresh your session, then run "auth extract" again.'
                            : 'Make sure Microsoft Teams is running and you are logged in via the desktop app or a supported Chromium browser.',
                    }, options.pretty));
                    process.exit(1);
                }
            }
        }
        if (Object.keys(config.accounts).length === 0) {
            console.log(formatOutput({
                error: 'All extracted tokens failed validation. Make sure Microsoft Teams is running and you are logged in via the desktop app or a supported Chromium browser.',
            }, options.pretty));
            process.exit(1);
        }
        await credManager.saveConfig(config);
        if (options.debug) {
            debug('[debug] ✓ Credentials saved');
        }
        console.log(formatOutput({
            accounts: outputAccounts,
            current_account: config.current_account,
        }, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}
async function extractManualToken(token, options) {
    if (options.debug) {
        debug(`[debug] Using provided token: ${token.substring(0, 20)}...`);
    }
    try {
        const client = await new TeamsClient().login({ token });
        const authInfo = await client.testAuth();
        const teams = await client.listTeams();
        if (teams.length === 0) {
            console.log(formatOutput({ error: 'No teams found. Make sure you are a member of at least one Microsoft Teams team.' }, options.pretty));
            process.exit(1);
        }
        const credManager = new TeamsCredentialManager();
        const accountType = 'work';
        const teamMap = {};
        for (const team of teams) {
            teamMap[team.id] = { team_id: team.id, team_name: team.name };
        }
        const account = {
            token,
            token_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            region: client.getRegion(),
            account_type: accountType,
            user_name: authInfo.displayName,
            current_team: teams[0].id,
            teams: teamMap,
        };
        const existingConfig = await credManager.loadConfig();
        const config = existingConfig ?? { current_account: accountType, accounts: {} };
        config.accounts[accountType] = account;
        if (!config.current_account) {
            config.current_account = accountType;
        }
        await credManager.saveConfig(config);
        if (options.debug) {
            debug('[debug] ✓ Credentials saved');
        }
        console.log(formatOutput({
            accounts: [
                {
                    account_type: accountType,
                    user: authInfo.displayName,
                    teams: teams.map((t) => `${t.id}/${t.name}`),
                },
            ],
            current_account: accountType,
        }, options.pretty));
    }
    catch (error) {
        const errorMessage = error.message;
        const is401 = errorMessage.includes('401') || errorMessage.includes('Unauthorized');
        console.log(formatOutput({
            error: `Token validation failed: ${errorMessage}`,
            hint: is401
                ? 'Token expired. Open Microsoft Teams in the desktop app or a supported Chromium browser, send a message to refresh your session, then run "auth extract" again.'
                : 'Make sure Microsoft Teams is running and you are logged in via the desktop app or a supported Chromium browser.',
        }, options.pretty));
        process.exit(1);
    }
}
export function getNoTeamsTokenFoundMessage() {
    return 'No Teams token found. Make sure you are logged in to Microsoft Teams via the desktop app or a supported Chromium browser.';
}
export async function logoutAction(options) {
    try {
        const credManager = new TeamsCredentialManager();
        const config = await credManager.loadConfig();
        if (!config || Object.keys(config.accounts).length === 0) {
            console.log(formatOutput({ error: 'Not authenticated. Run "auth login" or "auth extract" first.' }, options.pretty));
            process.exit(1);
        }
        await credManager.clearCredentials();
        console.log(formatOutput({ removed: 'teams', success: true }, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}
export async function statusAction(options) {
    try {
        const credManager = new TeamsCredentialManager();
        const config = await credManager.loadConfig();
        if (!config || Object.keys(config.accounts).length === 0) {
            console.log(formatOutput({ error: 'Not authenticated. Run "auth login" or "auth extract" first.' }, options.pretty));
            process.exit(1);
        }
        const accountStatuses = [];
        for (const [key, account] of Object.entries(config.accounts)) {
            const isExpired = account.token_expires_at ? new Date(account.token_expires_at).getTime() <= Date.now() : true;
            let displayName = account.user_name ?? null;
            let valid = false;
            if (!isExpired) {
                try {
                    const client = await new TeamsClient().login({
                        token: account.token,
                        tokenExpiresAt: account.token_expires_at ?? undefined,
                        accountType: account.account_type,
                        region: account.region,
                    });
                    const authInfo = await client.testAuth();
                    displayName = authInfo.displayName;
                    valid = true;
                }
                catch {
                    valid = false;
                }
            }
            accountStatuses.push({
                account_type: key,
                authenticated: valid,
                user: displayName,
                teams_count: Object.keys(account.teams).length,
                token_expires_at: account.token_expires_at ?? null,
                token_expired: isExpired,
                current: key === config.current_account,
            });
        }
        console.log(formatOutput({
            current_account: config.current_account,
            accounts: accountStatuses,
        }, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}
export async function switchAccountAction(accountType, options) {
    try {
        const credManager = new TeamsCredentialManager();
        const config = await credManager.loadConfig();
        if (!config || !config.accounts[accountType]) {
            const available = config ? Object.keys(config.accounts).join(', ') : 'none';
            console.log(formatOutput({
                error: `Account not found: ${accountType}`,
                available,
                hint: 'Run "auth extract" to discover all accounts.',
            }, options.pretty));
            process.exit(1);
        }
        await credManager.setCurrentAccount(accountType);
        const account = config.accounts[accountType];
        console.log(formatOutput({
            current_account: accountType,
            user: account.user_name,
            teams_count: Object.keys(account.teams).length,
        }, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}
export const authCommand = new Command('auth')
    .description('Authentication commands')
    .addCommand(new Command('login')
    .description('Sign in via device code (no desktop app needed). Detects the account type from your email.')
    .option('--pretty', 'Pretty print JSON output')
    .option('--debug', 'Show debug output for troubleshooting')
    .option('--device-code <code>', 'Finish a non-interactive login started earlier')
    .option('--client-id <id>', 'Override the AAD client ID')
    .option('--account-type <type>', 'Force account type: work or personal (skips email detection)')
    .option('--email <email>', 'Microsoft email, used to auto-detect work vs personal')
    .action(loginAction))
    .addCommand(new Command('extract')
    .description('Extract token from Microsoft Teams desktop app or a supported Chromium browser')
    .option('--pretty', 'Pretty print JSON output')
    .option('--debug', 'Show debug output for troubleshooting')
    .option('--token <token>', 'Manually provide a token (bypasses auto-extraction)')
    .option('--browser-profile <path>', 'Additional Chromium profile/user-data directory to scan (repeatable, comma-separated supported)', collectBrowserProfileOption, [])
    .action(extractAction))
    .addCommand(new Command('logout')
    .description('Logout from Microsoft Teams')
    .option('--pretty', 'Pretty print JSON output')
    .action(logoutAction))
    .addCommand(new Command('status')
    .description('Show authentication status')
    .option('--pretty', 'Pretty print JSON output')
    .action(statusAction))
    .addCommand(new Command('switch-account')
    .description('Switch active account (work or personal)')
    .argument('<account-type>', 'Account type: work or personal')
    .option('--pretty', 'Pretty print JSON output')
    .action(switchAccountAction));
//# sourceMappingURL=auth.js.map