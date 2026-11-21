import { Command } from 'commander';
import { formatOutput } from '../../../shared/utils/output.js';
import { ChannelClient } from '../client.js';
import { getClient, getCurrentWorkspaceId } from './shared.js';
export async function snapshotAction(options = {}) {
    try {
        const client = await getClient(options);
        const workspaceId = await getCurrentWorkspaceId(options);
        const channel = await client.getChannel(workspaceId);
        const workspace = {
            id: channel.id,
            name: channel.name,
        };
        if (options.full) {
            return buildFullSnapshot(client, workspaceId, workspace, options);
        }
        return buildBriefSnapshot(client, workspaceId, workspace, options);
    }
    catch (error) {
        return { error: error.message };
    }
}
async function buildBriefSnapshot(client, workspaceId, workspace, options) {
    if (options.groupsOnly) {
        const groups = await client.listGroups(workspaceId, { limit: 20 });
        return {
            workspace,
            groups: groups.map((g) => ({ id: g.id, name: g.name })),
            hint: "Use 'group messages <group>' for messages.",
        };
    }
    if (options.chatsOnly) {
        const [openedChats, snoozedChats, closedChats] = await Promise.all([
            client.listUserChats(workspaceId, { state: 'opened', limit: 100 }),
            client.listUserChats(workspaceId, { state: 'snoozed', limit: 100 }),
            client.listUserChats(workspaceId, { state: 'closed', limit: 100 }),
        ]);
        return {
            workspace,
            user_chats: {
                total: openedChats.length + snoozedChats.length + closedChats.length,
                by_state: {
                    opened: openedChats.length,
                    snoozed: snoozedChats.length,
                    closed: closedChats.length,
                },
            },
            hint: "Use 'chat list --state opened' for chat details, 'chat messages <chat>' for messages.",
        };
    }
    const [groups, openedChats, snoozedChats, closedChats] = await Promise.all([
        client.listGroups(workspaceId, { limit: 20 }),
        client.listUserChats(workspaceId, { state: 'opened', limit: 100 }),
        client.listUserChats(workspaceId, { state: 'snoozed', limit: 100 }),
        client.listUserChats(workspaceId, { state: 'closed', limit: 100 }),
    ]);
    return {
        workspace,
        groups: groups.map((g) => ({ id: g.id, name: g.name })),
        user_chats: {
            total: openedChats.length + snoozedChats.length + closedChats.length,
            by_state: {
                opened: openedChats.length,
                snoozed: snoozedChats.length,
                closed: closedChats.length,
            },
        },
        hint: "Use 'group messages <group>' for group messages, 'chat list --state opened' for chats, 'manager list' for managers.",
    };
}
async function buildFullSnapshot(client, workspaceId, workspace, options) {
    const limit = parseLimit(options.limit);
    if (options.groupsOnly) {
        const groups = await buildGroupsSnapshot(client, workspaceId, limit);
        return { workspace, groups };
    }
    if (options.chatsOnly) {
        const userChats = await buildUserChatsSnapshot(client, workspaceId, limit);
        return { workspace, user_chats: userChats };
    }
    const [managers, bots, groups, userChats] = await Promise.all([
        client.listManagers(workspaceId, { limit: 50 }),
        client.listBots(workspaceId, { limit: 50 }),
        buildGroupsSnapshot(client, workspaceId, limit),
        buildUserChatsSnapshot(client, workspaceId, limit),
    ]);
    return {
        workspace,
        managers: managers.map((manager) => ({
            id: manager.id,
            name: manager.name,
            email: manager.email,
            account_id: manager.accountId,
            role_id: manager.roleId,
        })),
        bots: bots.map((bot) => ({
            id: bot.id,
            name: bot.name,
            avatar_url: bot.avatarUrl,
        })),
        groups,
        user_chats: userChats,
    };
}
function parseLimit(limit) {
    if (typeof limit === 'number') {
        if (!Number.isInteger(limit) || limit < 1) {
            throw new Error('Invalid --limit value. Must be a positive integer.');
        }
        return limit;
    }
    const parsed = limit ? Number(limit) : 5;
    if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error('Invalid --limit value. Must be a positive integer.');
    }
    return parsed;
}
async function buildGroupsSnapshot(client, workspaceId, limit) {
    const groups = await client.listGroups(workspaceId, { limit: 20 });
    return Promise.all(groups.map(async (group) => {
        const messages = await client.getGroupMessages(workspaceId, group.id, { limit, sortOrder: 'desc' });
        return {
            id: group.id,
            name: group.name,
            recent_messages: messages.map((message) => ({
                id: message.id,
                person_type: message.personType,
                plain_text: ChannelClient.extractText(message),
                created_at: message.createdAt,
            })),
        };
    }));
}
async function buildUserChatsSnapshot(client, workspaceId, limit) {
    const [openedChats, snoozedChats, closedChats] = await Promise.all([
        client.listUserChats(workspaceId, { state: 'opened', limit: 100 }),
        client.listUserChats(workspaceId, { state: 'snoozed', limit: 100 }),
        client.listUserChats(workspaceId, { state: 'closed', limit: 100 }),
    ]);
    return {
        total: openedChats.length + snoozedChats.length + closedChats.length,
        by_state: {
            opened: openedChats.length,
            snoozed: snoozedChats.length,
            closed: closedChats.length,
        },
        recent: openedChats.slice(0, limit).map((chat) => ({
            id: chat.id,
            state: chat.state,
            assignee_id: chat.assigneeId,
            created_at: chat.createdAt,
            updated_at: chat.updatedAt,
        })),
    };
}
function cliOutput(result, pretty) {
    console.log(formatOutput(result, pretty));
    if (result.error) {
        process.exit(1);
    }
}
export function createSnapshotCommand() {
    return new Command('snapshot')
        .description('Workspace overview for AI agents (brief by default, use --full for comprehensive data)')
        .option('--full', 'Include messages, managers, and bots (verbose)')
        .option('--groups-only', 'List groups only, skip user chats')
        .option('--chats-only', 'List user chats only, skip groups')
        .option('--limit <n>', 'Messages per group and recent opened chats with --full', '5')
        .option('--workspace <id>', 'Workspace ID')
        .option('--pretty', 'Pretty print JSON output')
        .action(async (options) => {
        cliOutput(await snapshotAction(options), options.pretty);
    });
}
export const snapshotCommand = createSnapshotCommand();
//# sourceMappingURL=snapshot.js.map