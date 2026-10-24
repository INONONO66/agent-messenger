import { readFile } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import { Command } from 'commander';
import { handleError } from '../../../shared/utils/error-handler.js';
import { formatOutput } from '../../../shared/utils/output.js';
import { DiscordClient } from '../client.js';
import { DiscordCredentialManager } from '../credential-manager.js';
import { validateStickerName } from '../expression-names.js';
export async function listAction(serverId, options) {
    try {
        const credManager = new DiscordCredentialManager();
        const config = await credManager.load();
        if (!config.token) {
            console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty));
            process.exit(1);
        }
        const client = await new DiscordClient().login({ token: config.token });
        const stickers = await client.listStickers(serverId);
        console.log(formatOutput({
            server_id: serverId,
            count: stickers.length,
            stickers: stickers.map((sticker) => ({
                id: sticker.id,
                name: sticker.name,
                tags: sticker.tags,
                description: sticker.description ?? null,
            })),
        }, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}
export async function createAction(serverId, path, options) {
    try {
        const credManager = new DiscordCredentialManager();
        const config = await credManager.load();
        if (!config.token) {
            console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty));
            process.exit(1);
        }
        const client = await new DiscordClient().login({ token: config.token });
        const filePath = resolve(path);
        const filename = basename(filePath);
        const name = options.name ?? basename(filename, extname(filename));
        const nameError = validateStickerName(name);
        if (nameError) {
            console.log(formatOutput({ error: nameError }, options.pretty));
            process.exit(1);
        }
        const image = new Uint8Array(await readFile(filePath));
        const sticker = await client.createSticker(serverId, { name, description: options.description ?? '', tags: options.tags }, image, filename);
        console.log(formatOutput({ success: true, server_id: serverId, id: sticker.id, name: sticker.name }, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}
export async function deleteAction(serverId, stickerId, options) {
    try {
        const credManager = new DiscordCredentialManager();
        const config = await credManager.load();
        if (!config.token) {
            console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty));
            process.exit(1);
        }
        const client = await new DiscordClient().login({ token: config.token });
        await client.deleteSticker(serverId, stickerId);
        console.log(formatOutput({ success: true, server_id: serverId, id: stickerId }, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}
export const stickerCommand = new Command('sticker')
    .description('Custom sticker commands')
    .addCommand(new Command('list')
    .description('List custom stickers in a server')
    .argument('<server-id>', 'Server ID')
    .option('--pretty', 'Pretty print JSON output')
    .action(listAction))
    .addCommand(new Command('create')
    .description('Upload a custom sticker to a server')
    .argument('<server-id>', 'Server ID')
    .argument('<file>', 'Image file (PNG, APNG, GIF or Lottie JSON, max 512KB; Discord documents 320x320)')
    .requiredOption('--tags <emoji>', 'Unicode emoji this sticker relates to')
    .option('--name <name>', 'Sticker name (defaults to the filename without extension)')
    .option('--description <text>', 'Sticker description')
    .option('--pretty', 'Pretty print JSON output')
    .action(createAction))
    .addCommand(new Command('delete')
    .description('Delete a custom sticker from a server')
    .argument('<server-id>', 'Server ID')
    .argument('<sticker-id>', 'Sticker ID')
    .option('--pretty', 'Pretty print JSON output')
    .action(deleteAction));
//# sourceMappingURL=sticker.js.map