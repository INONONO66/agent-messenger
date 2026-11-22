import { Command } from 'commander';
import type { BotOption } from './shared.js';
interface SpaceResult {
    id?: string;
    ref?: string;
    title?: string;
    type?: 'group' | 'direct';
    isLocked?: boolean;
    teamId?: string | null;
    teamRef?: string | null;
    lastActivity?: string;
    created?: string;
    creatorId?: string;
    creatorRef?: string;
    spaces?: Array<{
        id: string;
        ref: string;
        title: string;
        type: 'group' | 'direct';
        lastActivity: string;
        created: string;
    }>;
    error?: string;
}
export declare function listAction(options: BotOption & {
    max?: string;
    type?: string;
}): Promise<SpaceResult>;
export declare function infoAction(spaceId: string, options: BotOption): Promise<SpaceResult>;
export declare const spaceCommand: Command;
export {};
//# sourceMappingURL=space.d.ts.map