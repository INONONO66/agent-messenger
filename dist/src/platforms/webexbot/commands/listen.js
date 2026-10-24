import { Command } from 'commander';
import { cliOutput } from '../../../shared/utils/cli-output.js';
import { WebexBotListener } from '../listener.js';
import { getClient } from './shared.js';
const SUPPORTED_EVENTS = new Set([
    'message_created',
    'message_updated',
    'message_deleted',
    'membership_created',
    'attachment_action',
    'room_created',
    'room_updated',
    'webex_event',
    'connected',
    'reconnecting',
    'disconnected',
    'error',
]);
const DEFAULT_EVENTS = [
    'message_created',
    'message_updated',
    'message_deleted',
    'membership_created',
    'attachment_action',
    'connected',
    'reconnecting',
    'disconnected',
    'error',
];
function printEvent(type, payload, pretty) {
    const line = payload === undefined ? { type } : { type, payload };
    console.log(JSON.stringify(line, null, pretty ? 2 : undefined));
}
export function parseEvents(events) {
    if (!events)
        return DEFAULT_EVENTS;
    const tokens = events
        .split(',')
        .map((event) => event.trim())
        .filter((event) => event.length > 0);
    const unknown = tokens.filter((event) => !SUPPORTED_EVENTS.has(event));
    if (unknown.length > 0) {
        const supported = [...SUPPORTED_EVENTS].join(', ');
        throw new Error(`Unknown event(s): ${unknown.join(', ')}. Supported events: ${supported}`);
    }
    return tokens;
}
export async function listenAction(options) {
    let events;
    try {
        events = parseEvents(options.events);
    }
    catch (error) {
        cliOutput({ error: error.message }, options.pretty, true);
        return;
    }
    const client = await getClient(options);
    const listener = new WebexBotListener(client);
    for (const event of events) {
        if (event === 'error') {
            listener.on(event, (error) => printEvent(event, { message: error.message, name: error.name }, options.pretty));
            continue;
        }
        listener.on(event, (payload) => printEvent(event, payload, options.pretty));
    }
    process.once('SIGINT', () => {
        void listener.stop().finally(() => process.exit(0));
    });
    try {
        await listener.start();
    }
    catch (error) {
        printEvent('error', { message: error.message, name: error.name }, options.pretty);
        process.exit(1);
    }
}
export const listenCommand = new Command('listen')
    .description('Listen for real-time Webex bot events')
    .option('--events <list>', 'Comma-separated event filter')
    .option('--bot <id>', 'Use specific bot')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (opts) => {
    await listenAction(opts);
});
//# sourceMappingURL=listen.js.map