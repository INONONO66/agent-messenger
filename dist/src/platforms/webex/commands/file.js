import { readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { Command } from 'commander';
import { handleError } from '../../../shared/utils/error-handler.js';
import { formatOutput } from '../../../shared/utils/output.js';
import { WebexClient } from '../client.js';
async function withWebexClient(run) {
    const client = new WebexClient();
    try {
        await client.login();
        return await run(client);
    }
    finally {
        await client.dispose();
    }
}
export async function uploadAction(space, path, options) {
    try {
        const filePath = resolve(path);
        const content = await readFile(filePath);
        const message = await withWebexClient((client) => client.uploadFile(space, { content: new Blob([content]), filename: basename(filePath) }, { text: options.text, markdown: options.markdown, parentId: options.parent }));
        const output = {
            id: message.id,
            ref: message.ref,
            roomId: message.roomId,
            roomRef: message.roomRef,
            files: message.files,
            created: message.created,
        };
        console.log(formatOutput(output, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}
export async function downloadAction(content, output, options) {
    try {
        const { data, filename, contentType } = await withWebexClient((client) => client.downloadContent(content));
        const outputPath = output ? resolve(output) : resolve(process.cwd(), basename(filename));
        await writeFile(outputPath, Buffer.from(data));
        console.log(formatOutput({ downloaded: outputPath, filename, contentType, size: data.byteLength }, options.pretty));
    }
    catch (error) {
        handleError(error);
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
    .option('--pretty', 'Pretty print JSON output')
    .action(uploadAction))
    .addCommand(new Command('download')
    .description('Download a file attachment by content URL or ID')
    .argument('<content>', 'File content URL (from message.files) or content ID')
    .argument('[output]', 'Output path (defaults to original filename)')
    .option('--pretty', 'Pretty print JSON output')
    .action(downloadAction));
//# sourceMappingURL=file.js.map