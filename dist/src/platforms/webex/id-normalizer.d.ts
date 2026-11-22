import { fromRestId } from 'webex-message-handler';
import type { AttachmentAction, DecryptedMessage, DeletedMessage, MembershipActivity, RoomActivity } from 'webex-message-handler';
import type { WebexAttachmentActionEvent, WebexDeletedMessageEvent, WebexMembership, WebexMembershipEvent, WebexMessage, WebexMessageEvent, WebexPerson, WebexRoomEvent } from './types.js';
export { fromRestId };
export type WebexRestIdType = 'MESSAGE' | 'PEOPLE' | 'ROOM' | 'ATTACHMENT_ACTION';
export interface DecodedWebexId {
    cluster: string;
    type: string;
    uuid: string;
}
export declare function toRef(id: string): string;
export declare function decodeWebexId(restId: string): DecodedWebexId | null;
/**
 * Encode a raw Mercury UUID as a Webex REST ID. Empty input is returned unchanged
 * so an absent ID never becomes a bogus `ciscospark://us/{TYPE}/` value.
 *
 * Webex REST IDs are unpadded base64url. Padded base64 (trailing `=`) would not
 * equal the ID the REST API returns for the same resource (e.g. the bot's own
 * `/people/me` id), silently breaking equality checks such as mention detection.
 */
export declare function toRestId(uuid: string, type: WebexRestIdType): string;
export declare function normalizeMessage(message: DecryptedMessage): WebexMessageEvent;
export declare function normalizeDeletedMessage(message: DeletedMessage): WebexDeletedMessageEvent;
export declare function normalizeMembership(activity: MembershipActivity): WebexMembershipEvent;
export declare function normalizeAttachmentAction(action: AttachmentAction): WebexAttachmentActionEvent;
export declare function normalizeRoomActivity(activity: RoomActivity): WebexRoomEvent;
export declare function normalizeSdkPerson(person: WebexPerson): WebexPerson;
export declare function normalizeSdkMessage(message: WebexMessage): WebexMessage;
export declare function normalizeSdkMembership(membership: WebexMembership): WebexMembership;
//# sourceMappingURL=id-normalizer.d.ts.map