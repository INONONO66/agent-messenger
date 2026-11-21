import type { TeamsChannel, TeamsFile, TeamsMessage, TeamsTeam, TeamsUser } from './types.js';
type RecordValue = Record<string, any>;
export declare const segment: (value: string) => string;
export declare function graphMessage(raw: RecordValue, channelId: string, rootId?: string): TeamsMessage;
export declare const graphTeam: (raw: RecordValue) => TeamsTeam;
export declare const graphChannel: (raw: RecordValue, teamId: string) => TeamsChannel;
export declare const graphUser: (raw: RecordValue) => TeamsUser;
export declare const graphFile: (raw: RecordValue, driveId: string) => TeamsFile;
export declare class TeamsGraph {
    private token;
    constructor(token: () => Promise<string>);
    request<T = RecordValue>(method: string, path: string, body?: unknown, binary?: Uint8Array): Promise<T>;
    collection(path: string, limit?: number): Promise<RecordValue[]>;
}
export {};
//# sourceMappingURL=graph.d.ts.map