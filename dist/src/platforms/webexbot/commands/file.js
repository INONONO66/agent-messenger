import { readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { Command } from 'commander';
import { cliOutput } from '../../../shared/utils/cli-output.js';
import { getClient } from './shared.js';
export async function uploadAction(space, path, options) {
    try {
        const client = await getClient(options);
        const filePath = resolve(path);
        const content = await readFile(filePath);
        const message = await client.uploadFile(space, { content: new Blob([content]), filename: basename(filePath) }, { text: options.text, markdown: options.markdown, parentId: options.parent });
        return {
            id: message.id,
            ref: message.ref,
            roomId: message.roomId,
            roomRef: message.roomRef,
            files: message.files,
            created: message.created,
        };
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function downloadAction(contentRef, output, options) {
    try {
        const client = await getClient(options);
        const { data, filename, contentType } = await client.downloadContent(contentRef);
        // When no explicit output is given, confine the server-provided name to cwd.
        const outputPath = output ? resolve(output) : resolve(process.cwd(), basename(filename));
        await writeFile(outputPath, Buffer.from(data));
        return {
            downloaded: outputPath,
            filename,
            contentType,
            size: data.byteLength,
        };
    }
    catch (error) {
        return { error: error.message };
    }
}
export const fileCommand = new Command('file')
    .description('File commands')
    .addCommand(new Command('upload')
    .description('Upload a local file to a space')
    .argument('<space>', 'Space/Room ID')
    .argument('<path>', 'Local file path')
    .option('--text <text>', 'Optional message to send with the file')
    .option('--markdown', 'Treat --text as markdown')
    .option('--parent <id>', 'Reply within a thread (parent message ID)')
    .option('--bot <id>', 'Use specific bot')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (space, path, opts) => {
    cliOutput(await uploadAction(space, path, opts), opts.pretty);
}))
    .addCommand(new Command('download')
    .description('Download a file attachment by content URL or ID')
    .argument('<content>', 'File content URL (from message.files) or content ID')
    .argument('[output]', 'Output path (defaults to original filename)')
    .option('--bot <id>', 'Use specific bot')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (content, output, opts) => {
    cliOutput(await downloadAction(content, output, opts), opts.pretty);
}));
//# sourceMappingURL=file.js.map