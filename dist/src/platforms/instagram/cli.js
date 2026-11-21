#!/usr/bin/env node
import { Command } from 'commander';
import pkg from '../../../package.json' with { type: 'json' };
import { authCommand, chatCommand, messageCommand, whoamiCommand } from './commands/index.js';
import { ensureInstagramAuth } from './ensure-auth.js';
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
program.name('agent-instagram').description('CLI tool for Instagram DMs via private mobile API').version(pkg.version);
program.hook('preAction', async (_thisCommand, actionCommand) => {
    if (isAuthCommand(actionCommand))
        return;
    await ensureInstagramAuth();
});
program.addCommand(authCommand);
program.addCommand(chatCommand);
program.addCommand(messageCommand);
program.addCommand(whoamiCommand);
program.parse(process.argv);
export default program;
//# sourceMappingURL=cli.js.map