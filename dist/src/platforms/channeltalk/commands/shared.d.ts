import { ChannelClient } from '../client.js';
import { ChannelCredentialManager } from '../credential-manager.js';
interface SharedOptions {
    workspace?: string;
    _credManager?: ChannelCredentialManager;
}
export declare function getClient(options?: SharedOptions): Promise<ChannelClient>;
export declare function getCurrentWorkspaceId(options?: SharedOptions): Promise<string>;
export {};
//# sourceMappingURL=shared.d.ts.map