import { WhatsAppBotError } from './types.js';
const BASE_URL = 'https://graph.facebook.com/v23.0';
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 100;
export class WhatsAppBotClient {
    phoneNumberId = null;
    accessToken = null;
    rateLimitRemaining = null;
    rateLimitResetAt = 0;
    async login(credentials) {
        if (credentials) {
            if (!credentials.phoneNumberId) {
                throw new WhatsAppBotError('Phone number ID is required', 'missing_phone_number_id');
            }
            if (!credentials.accessToken) {
                throw new WhatsAppBotError('Access token is required', 'missing_access_token');
            }
            this.phoneNumberId = credentials.phoneNumberId;
            this.accessToken = credentials.accessToken;
            return this;
        }
        const { WhatsAppBotCredentialManager } = await import('./credential-manager.js');
        const credManager = new WhatsAppBotCredentialManager();
        const creds = await credManager.getCredentials();
        if (!creds) {
            throw new WhatsAppBotError('No WhatsApp Bot credentials found. Run "agent-whatsappbot auth set" first.', 'no_credentials');
        }
        return this.login({ phoneNumberId: creds.phone_number_id, accessToken: creds.access_token });
    }
    ensureAuth() {
        if (this.phoneNumberId === null) {
            throw new WhatsAppBotError('Not authenticated. Call .login() first.', 'not_authenticated');
        }
    }
    async verifyToken() {
        return this.request('GET', `/${this.phoneNumberId}?fields=verified_name`);
    }
    async sendTextMessage(to, text, previewUrl) {
        return this.request('POST', `/${this.phoneNumberId}/messages`, {
            messaging_product: 'whatsapp',
            to,
            type: 'text',
            text: { body: text, preview_url: previewUrl ?? false },
        });
    }
    async sendTemplateMessage(to, templateName, languageCode, components) {
        return this.request('POST', `/${this.phoneNumberId}/messages`, {
            messaging_product: 'whatsapp',
            to,
            type: 'template',
            template: { name: templateName, language: { code: languageCode }, components },
        });
    }
    async sendReaction(to, messageId, emoji) {
        return this.request('POST', `/${this.phoneNumberId}/messages`, {
            messaging_product: 'whatsapp',
            to,
            type: 'reaction',
            reaction: { message_id: messageId, emoji },
        });
    }
    async sendImageMessage(to, imageUrl, caption) {
        return this.request('POST', `/${this.phoneNumberId}/messages`, {
            messaging_product: 'whatsapp',
            to,
            type: 'image',
            image: { link: imageUrl, caption },
        });
    }
    async sendDocumentMessage(to, documentUrl, filename, caption) {
        return this.request('POST', `/${this.phoneNumberId}/messages`, {
            messaging_product: 'whatsapp',
            to,
            type: 'document',
            document: { link: documentUrl, filename, caption },
        });
    }
    async listTemplates(params) {
        return this.request('GET', this.buildPath(`/${this.phoneNumberId}/message_templates`, params), undefined, 'data');
    }
    async getTemplate(templateName) {
        const templates = await this.request('GET', `/${this.phoneNumberId}/message_templates?name=${encodeURIComponent(templateName)}`, undefined, 'data');
        const template = templates[0];
        if (!template) {
            throw new WhatsAppBotError(`Template "${templateName}" not found`, 'not_found');
        }
        return template;
    }
    getHeaders() {
        return {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
        };
    }
    async waitForRateLimit() {
        const now = Date.now();
        if (this.rateLimitRemaining === 0 && this.rateLimitResetAt > now) {
            await this.sleep(this.rateLimitResetAt - now);
        }
    }
    updateRateLimit(response) {
        const usageHeader = response.headers.get('x-business-use-case-usage');
        if (usageHeader) {
            try {
                const usage = JSON.parse(usageHeader);
                for (const entries of Object.values(usage)) {
                    for (const entry of entries) {
                        if (entry.call_count >= 100) {
                            this.rateLimitRemaining = 0;
                            this.rateLimitResetAt = Date.now() + (entry.estimated_time_to_regain_access ?? 60) * 1000;
                        }
                    }
                }
            }
            catch {
                // ignore parse errors
            }
        }
    }
    async request(method, path, body, unwrapKey) {
        this.ensureAuth();
        const url = `${BASE_URL}${path}`;
        let lastError;
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            await this.waitForRateLimit();
            const options = {
                method,
                headers: this.getHeaders(),
            };
            if (body !== undefined) {
                options.body = JSON.stringify(body);
            }
            let response;
            try {
                response = await fetch(url, options);
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                if (attempt < MAX_RETRIES && method === 'GET') {
                    await this.sleep(BASE_BACKOFF_MS * 2 ** attempt);
                    continue;
                }
                throw new WhatsAppBotError(`Network error: ${lastError.message}`, 'network_error');
            }
            this.updateRateLimit(response);
            if (response.status === 429) {
                if (attempt < MAX_RETRIES) {
                    const retryAfter = Number.parseFloat(response.headers.get('Retry-After') || '1');
                    const retryAfterMs = (Number.isNaN(retryAfter) ? 1 : retryAfter) * 1000;
                    await this.sleep(retryAfterMs);
                    continue;
                }
                throw new WhatsAppBotError('Rate limited', 'rate_limited');
            }
            if (response.status >= 500 && response.status <= 599) {
                if (attempt < MAX_RETRIES && method === 'GET') {
                    await this.sleep(BASE_BACKOFF_MS * 2 ** attempt);
                    continue;
                }
                const errorBody = (await response.json().catch(() => ({})));
                const msg = errorBody.error?.message || `HTTP ${response.status}`;
                const code = errorBody.error?.code ? String(errorBody.error.code) : `http_${response.status}`;
                throw new WhatsAppBotError(msg, code);
            }
            if (!response.ok) {
                const errorBody = (await response.json().catch(() => ({})));
                const msg = errorBody.error?.message || `HTTP ${response.status}`;
                const code = errorBody.error?.code ? String(errorBody.error.code) : `http_${response.status}`;
                throw new WhatsAppBotError(msg, code);
            }
            if (response.status === 204) {
                return undefined;
            }
            const data = await response.json();
            if (unwrapKey && data != null && typeof data === 'object' && unwrapKey in data) {
                return data[unwrapKey];
            }
            return data;
        }
        throw lastError || new WhatsAppBotError('Request failed after retries', 'max_retries');
    }
    buildPath(path, params) {
        if (!params) {
            return path;
        }
        const searchParams = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined) {
                searchParams.set(key, String(value));
            }
        }
        const query = searchParams.toString();
        if (!query) {
            return path;
        }
        return `${path}?${query}`;
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
//# sourceMappingURL=client.js.map