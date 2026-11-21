export type AttachmentInput = {
    data: Uint8Array | Buffer;
    filename: string;
    mime?: string;
};
export type SingleAttachmentKind = 'photo' | 'video' | 'audio' | 'file';
export type ResolvedAttachment = {
    kind: SingleAttachmentKind;
    mime: string;
    data: Uint8Array | Buffer;
    filename: string;
};
export type AttachmentPlan = {
    kind: 'single';
    resolved: ResolvedAttachment;
} | {
    kind: 'multiphoto';
    items: readonly AttachmentInput[];
} | {
    kind: 'sequential';
    resolved: readonly ResolvedAttachment[];
};
export declare function resolveAttachment(input: AttachmentInput): ResolvedAttachment;
export declare function planAttachments(items: readonly AttachmentInput[]): AttachmentPlan;
//# sourceMappingURL=attachment-router.d.ts.map