import { Command } from 'commander';
import type { WebexBotListenerEventMap } from '../types.js';
import type { BotOption } from './shared.js';
type ListenEvent = keyof WebexBotListenerEventMap;
interface ListenOptions extends BotOption {
    events?: string;
}
export declare function parseEvents(events?: string): ListenEvent[];
export declare function listenAction(options: ListenOptions): Promise<void>;
export declare const listenCommand: Command;
export {};
//# sourceMappingURL=listen.d.ts.map