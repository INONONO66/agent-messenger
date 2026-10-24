import { Command } from 'commander';
import { parallelMap } from '../../../shared/utils/concurrency.js';
import { handleError } from '../../../shared/utils/error-handler.js';
import { formatOutput } from '../../../shared/utils/output.js';
import { SlackClient } from '../client.js';
import { CredentialManager } from '../credential-manager.js';
async function snapshotAction(options) {
    try {
        const credManager = new CredentialManager();
        const workspace = await credManager.getWorkspace();
        if (!workspace) {
            console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty));
            process.exit(1);
        }
        const client = await new SlackClient().login({ token: workspace.token, cookie: workspace.cookie });
        const auth = await client.testAuth();
        const snapshot = {
            workspace: {
                id: auth.team_id,
                name: auth.team,
            },
        };
        const isFull = options.full || options.channelsOnly || options.usersOnly;
        if (isFull) {
            await buildFullSnapshot(client, snapshot, options);
        }
        else {
            await buildBriefSnapshot(client, snapshot, options);
        }
        console.log(formatOutput(snapshot, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}
async function buildBriefSnapshot(client, snapshot, options) {
    if (!options.usersOnly) {
        const channels = await client.listChannels();
        const active = channels.filter((ch) => !ch.is_archived);
        snapshot.channels = active.map((ch) => ({ id: ch.id, name: ch.name }));
    }
    snapshot.hint =
        "Use 'message list <channel>' for messages, 'channel info <channel>' for channel details, 'user list' for users, 'usergroup list' for groups.";
}
async function buildFullSnapshot(client, snapshot, options) {
    const messageLimit = options.limit || 20;
    if (!options.usersOnly) {
        const channels = await client.listChannels();
        snapshot.channels = channels.map((ch) => ({
            id: ch.id,
            name: ch.name,
            is_private: ch.is_private,
            is_archived: ch.is_archived,
            created: ch.created,
            topic: ch.topic?.value,
            purpose: ch.purpose?.value,
        }));
        if (!options.channelsOnly) {
            const activeChannels = channels.filter((ch) => !ch.is_archived);
            const channelMessages = await parallelMap(activeChannels, async (channel) => {
                const messages = await client.getMessages(channel.id, messageLimit);
                return messages.map((msg) => ({
                    ...msg,
                    channel_id: channel.id,
                    channel_name: channel.name,
                }));
            }, 5);
            snapshot.recent_messages = channelMessages.flat().map((msg) => ({
                channel_id: msg.channel_id,
                channel_name: msg.channel_name,
                ts: msg.ts,
                text: msg.text,
                user: msg.user,
                username: msg.username,
                thread_ts: msg.thread_ts,
            }));
        }
    }
    if (!options.channelsOnly) {
        const users = await client.listUsers();
        snapshot.users = users.map((u) => ({
            id: u.id,
            name: u.name,
            real_name: u.real_name,
            is_admin: u.is_admin,
            is_bot: u.is_bot,
            profile: u.profile,
        }));
    }
    if (!options.channelsOnly && !options.usersOnly) {
        const usergroups = await client.listUsergroups({ includeUsers: true, includeCount: true });
        snapshot.usergroups = usergroups.map((ug) => ({
            id: ug.id,
            name: ug.name,
            handle: ug.handle,
            description: ug.description,
            user_count: ug.user_count,
            users: ug.users,
        }));
    }
}
export const snapshotCommand = new Command('snapshot')
    .description('Get workspace overview for AI agents (brief by default, use --full for comprehensive data)')
    .option('--full', 'Include messages, users, and user groups (verbose)')
    .option('--channels-only', 'Include only channels (exclude messages and users)')
    .option('--users-only', 'Include only users (exclude channels and messages)')
    .option('--limit <n>', 'Number of recent messages per channel with --full (default: 20)', '20')
    .action(async (options) => {
    await snapshotAction({
        channelsOnly: options.channelsOnly,
        usersOnly: options.usersOnly,
        full: options.full,
        limit: parseInt(options.limit, 10),
        pretty: options.pretty,
    });
});
//# sourceMappingURL=snapshot.js.map