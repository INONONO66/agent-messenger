import { Command } from 'commander';
import { handleError } from '../../../shared/utils/error-handler.js';
import { formatOutput } from '../../../shared/utils/output.js';
import { getClient, getCurrentServer } from './shared.js';
export async function listAction(channel, options) {
    try {
        if (options.archived && !channel) {
            return { error: 'thread list --archived requires a channel' };
        }
        const serverId = await getCurrentServer(options);
        const client = await getClient(options);
        const parentId = channel ? await client.resolveChannel(serverId, channel) : undefined;
        const result = await client.listThreads(serverId, { parentId, archived: options.archived });
        return {
            threads: result.threads.map((thread) => ({
                id: thread.id,
                name: thread.name,
                type: thread.type,
                parent_id: thread.parent_id,
                archived: thread.thread_metadata?.archived,
            })),
            has_more: result.has_more,
        };
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function createAction(channel, name, options) {
    try {
        const serverId = await getCurrentServer(options);
        const client = await getClient(options);
        const channelId = await client.resolveChannel(serverId, channel);
        const threadOptions = {};
        if (options.autoArchiveDuration) {
            threadOptions.auto_archive_duration = parseInt(options.autoArchiveDuration, 10);
        }
        const thread = await client.createThread(channelId, name, threadOptions);
        const output = {
            id: thread.id,
            name: thread.name,
            type: thread.type,
            parent_id: thread.parent_id,
        };
        return { success: true, thread: output };
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function archiveAction(threadId, options) {
    try {
        const client = await getClient(options);
        await client.archiveThread(threadId);
        return { success: true, threadId };
    }
    catch (error) {
        return { error: error.message };
    }
}
export const threadCommand = new Command('thread')
    .description('Thread commands')
    .addCommand(new Command('list')
    .description('List threads')
    .argument('[channel]', 'Channel ID or name')
    .option('--archived', 'List archived threads (requires a channel)')
    .option('--server <id>', 'Use specific server')
    .option('--bot <id>', 'Use specific bot')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (channelArg, options) => {
    try {
        const result = await listAction(channelArg, options);
        console.log(formatOutput(result, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}))
    .addCommand(new Command('create')
    .description('Create a thread')
    .argument('<channel>', 'Channel ID or name')
    .argument('<name>', 'Thread name')
    .option('--auto-archive-duration <minutes>', 'Auto archive duration in minutes')
    .option('--server <id>', 'Use specific server')
    .option('--bot <id>', 'Use specific bot')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (channelArg, nameArg, options) => {
    try {
        const result = await createAction(channelArg, nameArg, options);
        console.log(formatOutput(result, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}))
    .addCommand(new Command('archive')
    .description('Archive a thread')
    .argument('<thread-id>', 'Thread ID')
    .option('--bot <id>', 'Use specific bot')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (threadIdArg, options) => {
    try {
        const result = await archiveAction(threadIdArg, options);
        console.log(formatOutput(result, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}));
//# sourceMappingURL=thread.js.map