import { resolve } from 'node:path';
import { Command } from 'commander';
import { handleError } from '../../../shared/utils/error-handler.js';
import { formatOutput } from '../../../shared/utils/output.js';
import { getClient, getCurrentServer, resolveSendTarget, toAttachmentOutput } from './shared.js';
export async function uploadAction(channel, filePaths, options) {
    try {
        if (options.filename !== undefined && filePaths.length > 1) {
            return { error: '--filename requires exactly one file' };
        }
        const serverId = await getCurrentServer(options);
        const client = await getClient(options);
        const { channelId, threadId } = await resolveSendTarget(client, serverId, channel, options.thread);
        const message = await client.createMessage(threadId ?? channelId, {
            content: options.text,
            files: filePaths.map((filePath) => ({ path: resolve(filePath), filename: options.filename })),
            reply_to: options.reply,
        });
        const files = toAttachmentOutput(message.attachments);
        return {
            success: true,
            file: files[0],
            files,
            message_id: message.id,
            channel_id: message.channel_id,
        };
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function listAction(channel, options) {
    try {
        const serverId = await getCurrentServer(options);
        const client = await getClient(options);
        const channelId = await client.resolveChannel(serverId, channel);
        const files = await client.listFiles(channelId);
        return { success: true, files: toAttachmentOutput(files) };
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function infoAction(channel, fileId, options) {
    try {
        const serverId = await getCurrentServer(options);
        const client = await getClient(options);
        const channelId = await client.resolveChannel(serverId, channel);
        const file = await client.findFile(channelId, fileId);
        if (!file) {
            return { error: `File not found: ${fileId}` };
        }
        return toAttachmentOutput([file])[0];
    }
    catch (error) {
        return { error: error.message };
    }
}
export const fileCommand = new Command('file')
    .description('File commands')
    .addCommand(new Command('upload')
    .description('Upload one or more files to channel')
    .argument('<channel>', 'Channel ID or name')
    .argument('<file-path...>', 'One or more file paths (max 10)')
    .option('--text <text>', 'Message text sent with the file(s)')
    .option('--thread <id|name>', 'Post into this thread')
    .option('--reply <message-id>', 'Reply to a message')
    .option('--filename <name>', 'Override the filename (single file only)')
    .option('--server <id>', 'Use specific server')
    .option('--bot <id>', 'Use specific bot')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (channelArg, filePathArgs, opts) => {
    try {
        const result = await uploadAction(channelArg, filePathArgs, opts);
        console.log(formatOutput(result, opts.pretty));
    }
    catch (error) {
        handleError(error);
    }
}))
    .addCommand(new Command('info')
    .description('Get file info')
    .argument('<channel>', 'Channel ID or name')
    .argument('<file-id>', 'File ID')
    .option('--server <id>', 'Use specific server')
    .option('--bot <id>', 'Use specific bot')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (channelArg, fileIdArg, options) => {
    try {
        const result = await infoAction(channelArg, fileIdArg, options);
        console.log(formatOutput(result, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}))
    .addCommand(new Command('list')
    .description('List files in channel')
    .argument('<channel>', 'Channel ID or name')
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
}));
//# sourceMappingURL=file.js.map