#!/usr/bin/env node
import { Command } from 'commander';
import pkg from '../../../package.json' with { type: 'json' };
import { authCommand, fileCommand, memberCommand, messageCommand, snapshotCommand, spaceCommand, whoamiCommand, } from './commands/index.js';
import { ensureWebexAuth } from './ensure-auth.js';
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
program.name('agent-webex').description('CLI tool for Cisco Webex communication').version(pkg.version);
program.hook('preAction', async (_thisCommand, actionCommand) => {
    if (isAuthCommand(actionCommand))
        return;
    await ensureWebexAuth();
});
program.addCommand(authCommand);
program.addCommand(fileCommand);
program.addCommand(memberCommand);
program.addCommand(messageCommand);
program.addCommand(snapshotCommand);
program.addCommand(spaceCommand);
program.addCommand(whoamiCommand);
program.parse(process.argv);
export default program;
//# sourceMappingURL=cli.js.map