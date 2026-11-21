import { Command } from 'commander';
import type { BotOption } from './shared.js';
interface UserResult {
    id?: string;
    ref?: string;
    emails?: string[];
    displayName?: string;
    nickName?: string;
    firstName?: string;
    lastName?: string;
    avatar?: string;
    orgId?: string;
    orgRef?: string;
    type?: 'person' | 'bot';
    created?: string;
    users?: Array<{
        id: string;
        ref: string;
        emails: string[];
        displayName: string;
        type: 'person' | 'bot';
    }>;
    error?: string;
}
export declare function listAction(options: BotOption & {
    email?: string;
    displayName?: string;
    max?: string;
}): Promise<UserResult>;
export declare function infoAction(personId: string, options: BotOption): Promise<UserResult>;
export declare const userCommand: Command;
export {};
//# sourceMappingURL=user.d.ts.map