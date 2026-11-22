import { formatOutput } from '../../shared/utils/output.js';
import { IMessageCredentialManager } from './credential-manager.js';
export async function ensureIMessageAuth() {
    const resolved = await new IMessageCredentialManager().resolveAccount();
    if (!resolved) {
        console.log(formatOutput({
            error: 'Not configured. iMessage runs on this Mac via the "imsg" tool. Run "agent-imessage setup" for a guided walkthrough, or "agent-imessage doctor" to check requirements.',
            code: 'not_authenticated',
        }));
        process.exit(1);
    }
}
//# sourceMappingURL=ensure-auth.js.map