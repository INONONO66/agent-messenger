import type { SlackBookmark, SlackChannel, SlackDM, SlackFile, SlackMessage, SlackPin, SlackReminder, SlackSavedItem, SlackScheduledMessage, SlackUser, SlackUserProfile, SlackUsergroup } from './types.js';
export declare function mapChannel(channel: unknown, defaults?: Partial<Pick<SlackChannel, 'id' | 'name'>>): SlackChannel;
export declare function mapDM(channel: unknown): SlackDM;
export declare function mapFile(file: unknown, defaults?: Partial<Pick<SlackFile, 'id' | 'name' | 'title' | 'url_private'>>): SlackFile;
export declare function mapMessage(message: unknown, defaults?: Partial<Pick<SlackMessage, 'ts' | 'text' | 'type'>>): SlackMessage;
export declare function mapUser(user: unknown): SlackUser;
export declare function mapUserProfile(profile: unknown): SlackUserProfile;
export declare function mapSavedItem(item: unknown): SlackSavedItem;
export declare function mapPin(item: unknown, channel: string): SlackPin;
export declare function mapBookmark(bookmark: unknown, defaults?: Partial<Pick<SlackBookmark, 'id' | 'channel_id' | 'title' | 'link' | 'type'>>): SlackBookmark;
export declare function mapScheduledMessage(message: unknown, defaults?: Partial<Pick<SlackScheduledMessage, 'channel_id' | 'post_at' | 'date_created' | 'text'>>): SlackScheduledMessage;
export declare function mapReminder(reminder: unknown, defaults?: Partial<Pick<SlackReminder, 'text' | 'time'>>): SlackReminder;
export declare function mapUsergroup(usergroup: unknown): SlackUsergroup;
//# sourceMappingURL=client-mappers.d.ts.map