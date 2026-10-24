import { formatOutput } from '../../../shared/utils/output.js';
import { KakaoTalkClient } from '../client.js';
import { KakaoCredentialManager } from '../credential-manager.js';
export async function withKakaoClient(options, fn) {
    const manager = new KakaoCredentialManager();
    const account = await manager.getAccount(options.account);
    if (!account) {
        console.log(formatOutput({
            error: options.account
                ? `KakaoTalk account "${options.account}" not found. Run "agent-kakaotalk auth list" to see available accounts.`
                : 'No KakaoTalk credentials found. Run:\n  agent-kakaotalk auth login     (recommended — registers as sub-device, desktop app stays running)',
        }, options.pretty));
        process.exit(1);
    }
    const client = new KakaoTalkClient();
    await client.login(undefined, account.account_id);
    try {
        return await fn(client);
    }
    finally {
        client.close();
    }
}
//# sourceMappingURL=shared.js.map