#!/usr/bin/env node
import { Command } from 'commander';
import pkg from '../../../package.json' with { type: 'json' };
import { authCommand, chatCommand, memberCommand, messageCommand, whoamiCommand } from './commands/index.js';
import { ensureKakaoAuth } from './ensure-auth.js';
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
program
    .name('agent-kakaotalk')
    .description('CLI tool for KakaoTalk with credential extraction from KakaoTalk desktop app')
    .version(pkg.version);
program.hook('preAction', async (_thisCommand, actionCommand) => {
    if (isAuthCommand(actionCommand))
        return;
    await ensureKakaoAuth();
});
program.addCommand(authCommand);
program.addCommand(chatCommand);
program.addCommand(memberCommand);
program.addCommand(messageCommand);
program.addCommand(whoamiCommand);
program.parse(process.argv);
export default program;
//# sourceMappingURL=cli.js.map