import { SlackClient } from './client.js';
import { type SlackSessionCredentials, type SlackHuddleHandle, type HuddleClock } from './huddle-contract.js';
import { type HuddleTransport } from './huddle-session.js';
export { SlackHuddleError } from './huddle-contract.js';
export type { SlackSessionCredentials, SlackHuddleEvent, SlackHuddleHandle, SlackHuddleErrorCode, } from './huddle-contract.js';
export declare function createHuddleJoin(dependencies: {
    readonly client: () => SlackClient;
    readonly transport: () => HuddleTransport;
    readonly clock: HuddleClock;
}): (workspaceId: string, channelId: string, options: {
    readonly credentials: SlackSessionCredentials;
    readonly speakerId: string;
    readonly signal?: AbortSignal;
}) => Promise<SlackHuddleHandle>;
export declare function joinHuddle(workspaceId: string, channelId: string, options: {
    readonly credentials: SlackSessionCredentials;
    readonly speakerId: string;
    readonly signal?: AbortSignal;
}): Promise<SlackHuddleHandle>;
//# sourceMappingURL=huddle.d.ts.map