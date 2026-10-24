#!/usr/bin/env node
import './suppress-ws-warnings.js';
import { Command } from 'commander';
import pkg from '../../../package.json' with { type: 'json' };
import { authCommand, chatCommand, messageCommand, whoamiCommand } from './commands/index.js';
import { ensureWhatsAppAuth } from './ensure-auth.js';
function isAuthCommand(command) {
    let cmd = command;
    while (cmd) {
        if (cmd.name() === 'auth')
            return true;
        cmd = cmd.parent;
    }
    return false;
}
const program = new Command();
program.name('agent-whatsapp').description('CLI tool for WhatsApp via Baileys (linked device)').version(pkg.version);
program.hook('preAction', async (_thisCommand, actionCommand) => {
    if (isAuthCommand(actionCommand))
        return;
    await ensureWhatsAppAuth();
});
program.addCommand(authCommand);
program.addCommand(chatCommand);
program.addCommand(messageCommand);
program.addCommand(whoamiCommand);
program.parse(process.argv);
export default program;
//# sourceMappingURL=cli.js.map