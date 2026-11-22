import { exec } from 'node:child_process';
import { getWebexAppCredentials } from '../../platforms/webex/app-config.js';
import { WebexClient } from '../../platforms/webex/client.js';
import { WebexCredentialManager } from '../../platforms/webex/credential-manager.js';
import { toRef } from '../../platforms/webex/id-normalizer.js';
export class WebexAdapter {
    name = 'Webex';
    client = null;
    personEmail = null;
    async login() {
        const client = new WebexClient();
        await client.login();
        const me = await client.testAuth();
        this.client = client;
        this.personEmail = me.emails[0] ?? null;
    }
    async getChannels() {
        this.ensureClient();
        const spaces = await this.client.listSpaces();
        return spaces.map((space) => ({
            id: space.id,
            ref: toRef(space.id),
            name: space.title,
        }));
    }
    async getMessages(channelId, limit = 50) {
        this.ensureClient();
        const messages = await this.client.listMessages(channelId, { max: limit });
        return messages
            .map((msg) => ({
            id: msg.id,
            ref: msg.ref,
            channelId: msg.roomId,
            channelRef: msg.roomRef,
            author: msg.personEmail,
            content: msg.text ?? '',
            timestamp: msg.created,
        }))
            .reverse();
    }
    async sendMessage(channelId, text) {
        this.ensureClient();
        await this.client.sendMessage(channelId, text);
    }
    getAuthHint() {
        return {
            command: 'agent-webex auth login',
            description: 'Authenticate with Cisco Webex using OAuth Device Grant. Run the command below to start.',
        };
    }
    async authenticate(io) {
        const credManager = new WebexCredentialManager();
        const { clientId, clientSecret } = getWebexAppCredentials();
        io.print('Starting Webex OAuth Device Grant flow...');
        const device = await credManager.requestDeviceCode(clientId);
        io.print(`\nOpen this URL in your browser:\n  ${device.verificationUriComplete}`);
        io.print(`\nOr go to ${device.verificationUri} and enter code: ${device.userCode}`);
        openBrowser(device.verificationUriComplete);
        io.print('\nWaiting for authorization...');
        const config = await credManager.pollDeviceToken(device.deviceCode, device.interval, device.expiresIn, clientId, clientSecret);
        await credManager.saveConfig(config);
        const client = new WebexClient();
        await client.login({ token: config.accessToken });
        const me = await client.testAuth();
        this.client = client;
        this.personEmail = me.emails[0] ?? null;
        io.print(`\nAuthenticated as ${me.displayName} (${this.personEmail})`);
    }
    ensureClient() {
        if (!this.client) {
            throw new Error('Not logged in. Call login() first.');
        }
    }
}
function openBrowser(url) {
    const command = process.platform === 'darwin'
        ? `open "${url}"`
        : process.platform === 'win32'
            ? `start "" "${url}"`
            : `xdg-open "${url}"`;
    exec(command);
}
//# sourceMappingURL=webex-adapter.js.map