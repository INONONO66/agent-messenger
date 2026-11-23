export type SlackRichTextBlock = {
    readonly type: string;
    readonly [key: string]: unknown;
};
export type SlackListFieldInput = {
    readonly column_id: string;
    readonly rich_text?: readonly SlackRichTextBlock[];
    readonly user?: readonly string[];
    readonly date?: readonly string[];
    readonly select?: readonly string[];
    readonly checkbox?: boolean;
    readonly number?: readonly number[];
    readonly email?: readonly string[];
    readonly phone?: readonly string[];
    readonly attachment?: readonly string[];
    readonly message?: readonly string[];
    readonly rating?: readonly number[];
    readonly timestamp?: readonly number[];
    readonly channel?: readonly string[];
    readonly link?: readonly {
        readonly original_url: string;
        readonly display_as_url?: boolean;
        readonly display_name?: string;
    }[];
    readonly reference?: readonly {
        readonly file?: {
            readonly file_id: string;
        };
        readonly message?: {
            readonly channel_id: string;
            readonly ts: string;
            readonly thread_ts?: string;
        };
        readonly list_record?: {
            readonly list_id: string;
            readonly row_id: string;
        };
        readonly canvas_section?: {
            readonly file_id: string;
            readonly section_id: string;
        };
    }[];
};
export type SlackListCell = SlackListFieldInput & {
    readonly row_id: string;
};
export interface SlackListField {
    readonly columnId?: string;
    readonly key: string;
    readonly text?: string;
    readonly value?: string | number | boolean | null;
}
export interface SlackListItem {
    readonly id: string;
    readonly listId: string;
    readonly fields: readonly SlackListField[];
}
export interface SlackListPage {
    readonly items: readonly SlackListItem[];
    readonly nextCursor?: string;
}
export interface SlackListCreateOptions {
    readonly descriptionBlocks?: readonly SlackRichTextBlock[];
    readonly schema?: readonly {
        readonly key: string;
        readonly name: string;
        readonly type: string;
        readonly is_primary_column?: boolean;
        readonly options?: Readonly<Record<string, unknown>>;
    }[];
    readonly copyFromListId?: string;
    readonly includeCopiedListRecords?: boolean;
    readonly todoMode?: boolean;
}
export type SlackCanvasChange = {
    readonly operation: 'insert_after' | 'insert_before';
    readonly section_id: string;
    readonly document_content: {
        readonly type: 'markdown';
        readonly markdown: string;
    };
} | {
    readonly operation: 'insert_at_start' | 'insert_at_end';
    readonly document_content: {
        readonly type: 'markdown';
        readonly markdown: string;
    };
} | {
    readonly operation: 'replace';
    readonly section_id?: string;
    readonly document_content: {
        readonly type: 'markdown';
        readonly markdown: string;
    };
} | {
    readonly operation: 'delete';
    readonly section_id: string;
} | {
    readonly operation: 'rename';
    readonly title_content: {
        readonly type: 'markdown';
        readonly markdown: string;
    };
};
export declare function mapSlackListItem(input: unknown): SlackListItem;
//# sourceMappingURL=slack-api-types.d.ts.map