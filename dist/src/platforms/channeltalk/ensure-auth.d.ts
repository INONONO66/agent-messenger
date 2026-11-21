import { ChannelClient } from './client.js';
import { ChannelCredentialManager } from './credential-manager.js';
import { ChannelTokenExtractor } from './token-extractor.js';
type ChannelClientLike = Pick<ChannelClient, 'getAccount' | 'listChannels'>;
type ChannelCredentialManagerLike = Pick<ChannelCredentialManager, 'getCredentials' | 'setCredentials' | 'setCurrent'>;
type ChannelTokenExtractorLike = Pick<ChannelTokenExtractor, 'extract'>;
export declare function setEnsureChannelAuthDependenciesForTesting(deps: {
    createClient?: (accountCookie: string, sessionCookie?: string) => ChannelClientLike | Promise<ChannelClientLike>;
    createCredentialManager?: () => ChannelCredentialManagerLike;
    createTokenExtractor?: () => ChannelTokenExtractorLike;
}): void;
export declare function resetEnsureChannelAuthDependenciesForTesting(): void;
export declare const setEnsureChannelAuthClientFactoryForTesting: (factory: (accountCookie: string, sessionCookie?: string) => ChannelClientLike | Promise<ChannelClientLike>) => void;
export declare const resetEnsureChannelAuthClientFactoryForTesting: () => void;
export declare function ensureChannelAuth(): Promise<void>;
export {};
//# sourceMappingURL=ensure-auth.d.ts.map