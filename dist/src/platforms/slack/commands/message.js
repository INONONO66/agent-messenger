import { Command } from 'commander';
import { handleError } from '../../../shared/utils/error-handler.js';
import { formatOutput } from '../../../shared/utils/output.js';
import { SlackClient } from '../client.js';
import { CredentialManager } from '../credential-manager.js';
async function sendAction(channelInput, text, options) {
    try {
        const credManager = new CredentialManager();
        const workspace = await credManager.getWorkspace();
        if (!workspace) {
            console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty));
            process.exit(1);
        }
        const client = await new SlackClient().login({ token: workspace.token, cookie: workspace.cookie });
        const channel = await client.resolveChannel(channelInput);
        const message = await client.sendMessage(channel, text, options.thread);
        const output = {
            ts: message.ts,
            text: message.text,
            type: message.type,
            user: message.user,
            thread_ts: message.thread_ts,
        };
        console.log(formatOutput(output, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}
async function listAction(channelInput, options) {
    try {
        const credManager = new CredentialManager();
        const workspace = await credManager.getWorkspace();
        if (!workspace) {
            console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty));
            process.exit(1);
        }
        const client = await new SlackClient().login({ token: workspace.token, cookie: workspace.cookie });
        const channel = await client.resolveChannel(channelInput);
        const limit = options.limit || 20;
        const messages = await client.getMessages(channel, limit);
        const output = messages.map((msg) => ({
            ts: msg.ts,
            text: msg.text,
            type: msg.type,
            user: msg.user,
            username: msg.username,
            thread_ts: msg.thread_ts,
            reply_count: msg.reply_count,
            edited: msg.edited,
            reactions: msg.reactions,
            files: msg.files,
        }));
        console.log(formatOutput(output, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}
async function getAction(channelInput, ts, options) {
    try {
        const credManager = new CredentialManager();
        const workspace = await credManager.getWorkspace();
        if (!workspace) {
            console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty));
            process.exit(1);
        }
        const client = await new SlackClient().login({ token: workspace.token, cookie: workspace.cookie });
        const channel = await client.resolveChannel(channelInput);
        const message = await client.getMessage(channel, ts);
        if (!message) {
            console.log(formatOutput({ error: `Message not found: ${ts}` }, options.pretty));
            process.exit(1);
        }
        const output = {
            ts: message.ts,
            text: message.text,
            type: message.type,
            user: message.user,
            username: message.username,
            thread_ts: message.thread_ts,
            reply_count: message.reply_count,
            edited: message.edited,
            reactions: message.reactions,
            files: message.files,
        };
        console.log(formatOutput(output, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}
async function editAction(channelInput, ts, text, options) {
    try {
        const credManager = new CredentialManager();
        const workspace = await credManager.getWorkspace();
        if (!workspace) {
            console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty));
            process.exit(1);
        }
        const client = await new SlackClient().login({ token: workspace.token, cookie: workspace.cookie });
        const channel = await client.resolveChannel(channelInput);
        const message = await client.updateMessage(channel, ts, text);
        const output = {
            ts: message.ts,
            text: message.text,
            type: message.type,
            user: message.user,
        };
        console.log(formatOutput(output, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}
async function deleteAction(channelInput, ts, options) {
    try {
        const credManager = new CredentialManager();
        const workspace = await credManager.getWorkspace();
        if (!workspace) {
            console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty));
            process.exit(1);
        }
        if (!options.force) {
            console.log(formatOutput({ warning: 'Use --force to confirm deletion', ts }, options.pretty));
            process.exit(0);
        }
        const client = await new SlackClient().login({ token: workspace.token, cookie: workspace.cookie });
        const channel = await client.resolveChannel(channelInput);
        await client.deleteMessage(channel, ts);
        console.log(formatOutput({ deleted: ts }, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}
async function searchAction(query, options) {
    try {
        const credManager = new CredentialManager();
        const workspace = await credManager.getWorkspace();
        if (!workspace) {
            console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty));
            process.exit(1);
        }
        const client = await new SlackClient().login({ token: workspace.token, cookie: workspace.cookie });
        const results = await client.searchMessages(query, {
            sort: options.sort,
            sortDir: options.sortDir,
            count: options.limit || 20,
        });
        const output = results.map((result) => ({
            ts: result.ts,
            text: result.text,
            user: result.user,
            username: result.username,
            channel_id: result.channel.id,
            channel_name: result.channel.name,
            permalink: result.permalink,
        }));
        console.log(formatOutput(output, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}
async function repliesAction(channelInput, threadTs, options) {
    try {
        const credManager = new CredentialManager();
        const workspace = await credManager.getWorkspace();
        if (!workspace) {
            console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty));
            process.exit(1);
        }
        const client = await new SlackClient().login({ token: workspace.token, cookie: workspace.cookie });
        const channel = await client.resolveChannel(channelInput);
        const result = await client.getThreadReplies(channel, threadTs, {
            limit: options.limit,
            oldest: options.oldest,
            latest: options.latest,
            cursor: options.cursor,
        });
        const output = result.messages.map((msg) => ({
            ts: msg.ts,
            text: msg.text,
            type: msg.type,
            user: msg.user,
            username: msg.username,
            thread_ts: msg.thread_ts,
            reply_count: msg.reply_count,
            edited: msg.edited,
            reactions: msg.reactions,
            files: msg.files,
        }));
        console.log(formatOutput(output, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}
async function scheduleAction(channelInput, text, postAt, options) {
    try {
        const credManager = new CredentialManager();
        const workspace = await credManager.getWorkspace();
        if (!workspace) {
            console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty));
            process.exit(1);
        }
        const postAtTimestamp = Number(postAt);
        if (!Number.isInteger(postAtTimestamp) || postAtTimestamp <= 0) {
            console.log(formatOutput({ error: 'Invalid post-at value. Use a Unix timestamp in seconds (e.g. 1700000000).' }, options.pretty));
            process.exit(1);
        }
        const client = await new SlackClient().login({ token: workspace.token, cookie: workspace.cookie });
        const channel = await client.resolveChannel(channelInput);
        const scheduled = await client.scheduleMessage(channel, text, postAtTimestamp, options.thread);
        console.log(formatOutput(scheduled, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}
async function scheduledListAction(options) {
    try {
        const credManager = new CredentialManager();
        const workspace = await credManager.getWorkspace();
        if (!workspace) {
            console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty));
            process.exit(1);
        }
        const client = await new SlackClient().login({ token: workspace.token, cookie: workspace.cookie });
        const channel = options.channel ? await client.resolveChannel(options.channel) : undefined;
        const messages = await client.listScheduledMessages(channel);
        console.log(formatOutput(messages, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}
async function scheduledDeleteAction(channelInput, scheduledMessageId, options) {
    try {
        const credManager = new CredentialManager();
        const workspace = await credManager.getWorkspace();
        if (!workspace) {
            console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty));
            process.exit(1);
        }
        const client = await new SlackClient().login({ token: workspace.token, cookie: workspace.cookie });
        const channel = await client.resolveChannel(channelInput);
        await client.deleteScheduledMessage(channel, scheduledMessageId);
        console.log(formatOutput({ success: true, channel, scheduled_message_id: scheduledMessageId }, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}
async function ephemeralAction(channelInput, user, text, options) {
    try {
        const credManager = new CredentialManager();
        const workspace = await credManager.getWorkspace();
        if (!workspace) {
            console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty));
            process.exit(1);
        }
        const client = await new SlackClient().login({ token: workspace.token, cookie: workspace.cookie });
        const channel = await client.resolveChannel(channelInput);
        const messageTs = await client.postEphemeral(channel, user, text);
        console.log(formatOutput({ message_ts: messageTs, channel, user }, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}
async function permalinkAction(channelInput, ts, options) {
    try {
        const credManager = new CredentialManager();
        const workspace = await credManager.getWorkspace();
        if (!workspace) {
            console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty));
            process.exit(1);
        }
        const client = await new SlackClient().login({ token: workspace.token, cookie: workspace.cookie });
        const channel = await client.resolveChannel(channelInput);
        const permalink = await client.getPermalink(channel, ts);
        console.log(formatOutput({ channel, ts, permalink }, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}
export const messageCommand = new Command('message')
    .description('Message commands')
    .addCommand(new Command('send')
    .description('Send message to channel')
    .argument('<channel>', 'Channel ID or name')
    .argument('<text>', 'Message text')
    .option('--thread <ts>', 'Thread timestamp for replies')
    .option('--pretty', 'Pretty print JSON output')
    .action(sendAction))
    .addCommand(new Command('list')
    .description('List messages from channel')
    .argument('<channel>', 'Channel ID or name')
    .option('--limit <n>', 'Number of messages to retrieve', '20')
    .option('--thread <ts>', 'Filter by thread timestamp')
    .option('--pretty', 'Pretty print JSON output')
    .action((channel, options) => {
    listAction(channel, {
        limit: parseInt(options.limit, 10),
        thread: options.thread,
        pretty: options.pretty,
    });
}))
    .addCommand(new Command('get')
    .description('Get a single message by timestamp')
    .argument('<channel>', 'Channel ID or name')
    .argument('<ts>', 'Message timestamp')
    .option('--pretty', 'Pretty print JSON output')
    .action(getAction))
    .addCommand(new Command('edit')
    .description('Edit message text')
    .argument('<channel>', 'Channel ID or name')
    .argument('<ts>', 'Message timestamp')
    .argument('<text>', 'New message text')
    .option('--pretty', 'Pretty print JSON output')
    .action(editAction))
    .addCommand(new Command('delete')
    .description('Delete message')
    .argument('<channel>', 'Channel ID or name')
    .argument('<ts>', 'Message timestamp')
    .option('--force', 'Skip confirmation')
    .option('--pretty', 'Pretty print JSON output')
    .action(deleteAction))
    .addCommand(new Command('search')
    .description('Search messages across workspace')
    .argument('<query>', 'Search query')
    .option('--sort <type>', 'Sort by: score, timestamp (default: timestamp)')
    .option('--sort-dir <dir>', 'Sort direction: asc, desc (default: desc)')
    .option('--limit <n>', 'Number of results', '20')
    .option('--pretty', 'Pretty print JSON output')
    .action((query, options) => {
    searchAction(query, {
        sort: options.sort,
        sortDir: options.sortDir,
        limit: parseInt(options.limit, 10),
        pretty: options.pretty,
    });
}))
    .addCommand(new Command('replies')
    .description('Get thread replies')
    .argument('<channel>', 'Channel ID or name')
    .argument('<thread_ts>', 'Thread timestamp')
    .option('--limit <n>', 'Number of replies to retrieve', '100')
    .option('--oldest <ts>', 'Only messages after this timestamp')
    .option('--latest <ts>', 'Only messages before this timestamp')
    .option('--cursor <cursor>', 'Pagination cursor for next page')
    .option('--pretty', 'Pretty print JSON output')
    .action((channel, threadTs, options) => {
    repliesAction(channel, threadTs, {
        limit: options.limit ? parseInt(options.limit, 10) : undefined,
        oldest: options.oldest,
        latest: options.latest,
        cursor: options.cursor,
        pretty: options.pretty,
    });
}))
    .addCommand(new Command('schedule')
    .description('Schedule a message to be sent later')
    .argument('<channel>', 'Channel ID or name')
    .argument('<text>', 'Message text')
    .argument('<post-at>', 'Unix timestamp for when to send')
    .option('--thread <ts>', 'Thread timestamp for replies')
    .option('--pretty', 'Pretty print JSON output')
    .action((channel, text, postAt, options) => {
    scheduleAction(channel, text, postAt, { thread: options.thread, pretty: options.pretty });
}))
    .addCommand(new Command('scheduled-list')
    .description('List scheduled messages')
    .option('--channel <channel>', 'Filter by channel')
    .option('--pretty', 'Pretty print JSON output')
    .action((options) => {
    scheduledListAction({ channel: options.channel, pretty: options.pretty });
}))
    .addCommand(new Command('scheduled-delete')
    .description('Delete a scheduled message')
    .argument('<channel>', 'Channel ID or name')
    .argument('<scheduled-message-id>', 'Scheduled message ID')
    .option('--pretty', 'Pretty print JSON output')
    .action(scheduledDeleteAction))
    .addCommand(new Command('ephemeral')
    .description('Post an ephemeral message visible only to a specific user')
    .argument('<channel>', 'Channel ID or name')
    .argument('<user>', 'User ID to show message to')
    .argument('<text>', 'Message text')
    .option('--pretty', 'Pretty print JSON output')
    .action(ephemeralAction))
    .addCommand(new Command('permalink')
    .description('Get a permanent link to a message')
    .argument('<channel>', 'Channel ID or name')
    .argument('<ts>', 'Message timestamp')
    .option('--pretty', 'Pretty print JSON output')
    .action(permalinkAction));
//# sourceMappingURL=message.js.map