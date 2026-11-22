export interface TeamsMessageContent {
    content: string;
    html?: string;
    files?: string[];
}
export declare function parseTeamsContent(raw: string | undefined, options?: {
    messagetype?: string;
    properties?: unknown;
}): TeamsMessageContent;
export declare function teamsHtmlToText(html: string): string;
//# sourceMappingURL=message-content.d.ts.map