import { Command } from 'commander';
import { handleError } from '../../../shared/utils/error-handler.js';
import { formatOutput } from '../../../shared/utils/output.js';
import { SlackClient } from '../client.js';
import { CredentialManager } from '../credential-manager.js';
export async function whoamiAction(options) {
    try {
        const credManager = new CredentialManager();
        const workspace = await credManager.getWorkspace();
        if (!workspace) {
            console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty));
            return process.exit(1);
        }
        const client = await new SlackClient().login({ token: workspace.token, cookie: workspace.cookie });
        const authInfo = await client.testAuth();
        const user = await client.getUser(authInfo.user_id);
        const output = {
            id: user.id,
            name: user.name,
            real_name: user.real_name,
            is_admin: user.is_admin,
            is_owner: user.is_owner,
            is_bot: user.is_bot,
            is_app_user: user.is_app_user,
            team_id: authInfo.team_id,
            team: authInfo.team,
            profile: user.profile,
        };
        console.log(formatOutput(output, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}
export const whoamiCommand = new Command('whoami')
    .description('Show current authenticated user')
    .option('--pretty', 'Pretty print JSON output')
    .action(whoamiAction);
//# sourceMappingURL=whoami.js.map