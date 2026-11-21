import { LineCredentialManager } from './credential-manager.js';
export async function ensureLineAuth(accountId) {
    const credManager = new LineCredentialManager();
    const account = await credManager.getAccount(accountId);
    if (account?.auth_token) {
        return account;
    }
    throw new Error('No LINE credentials found. Run:\n  agent-line auth login');
}
//# sourceMappingURL=ensure-auth.js.map