import { Long } from 'bson';
import type { KakaoDeviceType } from '../types.js';
import type { LocoPacket } from './types.js';
export interface UploadToLocoOptions {
    shipToken: string;
    shipHost: string;
    shipPort: number;
    chatId: Long;
    msgType: number;
    userId: string;
    filename: string;
    data: Uint8Array;
    width?: number;
    height?: number;
    deviceType: KakaoDeviceType;
    onProgress?: (sent: number, total: number) => void;
}
export interface UploadToLocoResult {
    completePacket: LocoPacket | null;
    postStatusCode: number;
    postOffset: number;
}
export declare function uploadMediaToLoco(opts: UploadToLocoOptions): Promise<UploadToLocoResult>;
export declare function uploadMultiMediaEntry(opts: UploadToLocoOptions): Promise<UploadToLocoResult>;
//# sourceMappingURL=media-uploader.d.ts.map