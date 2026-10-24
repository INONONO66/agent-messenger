import { DeviceManager, KmsClient, MercurySocket, noopLogger } from 'webex-message-handler';
import WebSocket from 'ws';
export class KmsKeyProvider {
    token;
    logger;
    mercury = null;
    kms = null;
    readyPromise = null;
    constructor(options) {
        this.token = options.token;
        this.logger = options.logger;
    }
    async fetchKey(keyUri) {
        try {
            await this.ensureReady();
            const key = await this.kms?.getKey(keyUri);
            if (!key)
                return null;
            return JSON.stringify({ uri: keyUri, jwk: key.toJSON(true) });
        }
        catch (error) {
            this.logger?.debug(`Webex KMS key fetch failed: ${error instanceof Error ? error.message : String(error)}`);
            await this.close();
            this.readyPromise = null;
            return null;
        }
    }
    async close() {
        await this.mercury?.disconnect().catch(() => undefined);
        this.mercury = null;
        this.kms = null;
        this.readyPromise = null;
    }
    async ensureReady() {
        this.readyPromise ??= this.initialize();
        await this.readyPromise;
    }
    async initialize() {
        const httpDo = async (req) => {
            const res = await fetch(req.url, {
                method: req.method,
                headers: req.headers,
                body: req.body,
            });
            return {
                status: res.status,
                ok: res.ok,
                json: () => res.json(),
                text: () => res.text(),
            };
        };
        const wsFactory = (url) => new WebSocket(url);
        const dm = new DeviceManager({ logger: noopLogger, httpDo });
        const reg = (await dm.register(this.token));
        const mercury = new MercurySocket({ logger: noopLogger, wsFactory });
        const kms = new KmsClient({
            token: this.token,
            deviceUrl: reg.deviceUrl,
            userId: reg.userId,
            encryptionServiceUrl: reg.encryptionServiceUrl,
            logger: noopLogger,
            httpDo,
        });
        mercury.on('kms:response', (data) => kms.handleKmsMessage(data));
        await mercury.connect(reg.webSocketUrl, this.token);
        this.mercury = mercury;
        try {
            await kms.initialize();
        }
        catch (error) {
            await mercury.disconnect().catch(() => undefined);
            this.mercury = null;
            throw error;
        }
        this.kms = kms;
    }
}
//# sourceMappingURL=kms-key-provider.js.map