import { ChannelBotClient } from '../client.js';
import { ChannelBotCredentialManager } from '../credential-manager.js';
export interface WorkspaceOption {
    workspace?: string;
    bot?: string;
    pretty?: boolean;
    _credManager?: ChannelBotCredentialManager;
}
export declare function getClient(options: WorkspaceOption): Promise<ChannelBotClient>;
export declare function getCurrentWorkspace(options: WorkspaceOption): Promise<string>;
export declare function getDefaultBotName(options: WorkspaceOption): Promise<string | undefined>;
//# sourceMappingURL=shared.d.ts.map