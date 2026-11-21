import { constants as cryptoConstants, createHash, createPrivateKey, createPublicKey, generateKeyPairSync, privateDecrypt, } from 'node:crypto';
import WebSocket from 'ws';
import { DiscordError } from './client.js';
import { getDiscordHeaders } from './super-properties.js';
const REMOTE_AUTH_GATEWAY_URL = 'wss://remote-auth-gateway.discord.gg/?v=2';
const REMOTE_AUTH_ORIGIN = 'https://discord.com';
const REMOTE_AUTH_LOGIN_URL = 'https://discord.com/api/v9/users/@me/remote-auth/login';
const QR_URL_PREFIX = 'https://discord.com/ra/';
const DEFAULT_TIMEOUT_MS = 150_000;
/**
 * Authenticate a Discord user account via the Remote Auth ("scan QR with the mobile app") flow.
 *
 * The desktop side (this function) opens a WebSocket to Discord's remote-auth gateway, performs an
 * RSA-OAEP key exchange, and renders a QR code. Once the user scans it with an authenticated Discord
 * mobile app and confirms, Discord returns an encrypted ticket which is exchanged for the user token.
 */
export function loginWithRemoteAuth(options = {}) {
    const debug = options.debug;
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicExponent: 0x10001,
    });
    const ws = options.createWebSocket
        ? options.createWebSocket(REMOTE_AUTH_GATEWAY_URL)
        : new WebSocket(REMOTE_AUTH_GATEWAY_URL, { headers: { Origin: REMOTE_AUTH_ORIGIN } });
    return new Promise((resolve, reject) => {
        let settled = false;
        let heartbeatTimer = null;
        let pendingUser = null;
        let exchangeStarted = false;
        const cleanup = () => {
            if (heartbeatTimer) {
                clearInterval(heartbeatTimer);
                heartbeatTimer = null;
            }
            clearTimeout(timeoutTimer);
            try {
                ws.close();
            }
            catch { }
        };
        const fail = (error) => {
            if (settled)
                return;
            settled = true;
            cleanup();
            reject(error);
        };
        const succeed = (session) => {
            if (settled)
                return;
            settled = true;
            cleanup();
            resolve(session);
        };
        const timeoutTimer = setTimeout(() => {
            fail(new DiscordError('Remote auth timed out before the QR code was scanned.', 'remote_auth_timeout'));
        }, timeoutMs);
        timeoutTimer.unref?.();
        const send = (payload) => {
            try {
                ws.send(JSON.stringify(payload));
            }
            catch (error) {
                fail(error instanceof Error ? error : new Error(String(error)));
            }
        };
        ws.on('open', () => {
            debug?.('Connected to remote auth gateway');
        });
        ws.on('message', (raw) => {
            let message;
            try {
                message = JSON.parse(raw.toString());
            }
            catch {
                return;
            }
            try {
                handleMessage(message);
            }
            catch (error) {
                fail(error instanceof Error ? error : new Error(String(error)));
            }
        });
        const handleMessage = (message) => {
            switch (message.op) {
                case 'hello': {
                    const interval = message.heartbeat_interval;
                    heartbeatTimer = setInterval(() => send({ op: 'heartbeat' }), interval);
                    heartbeatTimer.unref?.();
                    send({ op: 'init', encoded_public_key: encodePublicKey(publicKey) });
                    debug?.('Sent init with public key');
                    break;
                }
                case 'nonce_proof': {
                    const encrypted = message.encrypted_nonce;
                    const proof = computeNonceProof(privateKey, encrypted);
                    send({ op: 'nonce_proof', proof });
                    debug?.('Sent nonce proof');
                    break;
                }
                case 'pending_remote_init': {
                    const { fingerprint } = message;
                    const qrUrl = `${QR_URL_PREFIX}${fingerprint}`;
                    debug?.('Received fingerprint; QR ready');
                    Promise.resolve(options.onQrUrl?.(qrUrl)).catch((error) => {
                        fail(error instanceof Error ? error : new Error(String(error)));
                    });
                    break;
                }
                case 'pending_ticket': {
                    const payload = decryptPayload(privateKey, message.encrypted_user_payload);
                    pendingUser = parseUserPayload(payload.toString('utf8'));
                    options.onPendingLogin?.(pendingUser);
                    debug?.(`QR scanned by ${pendingUser.username}`);
                    break;
                }
                case 'pending_login': {
                    if (exchangeStarted)
                        break;
                    exchangeStarted = true;
                    const { ticket } = message;
                    debug?.('Exchanging ticket for token');
                    exchangeTicket(ticket, privateKey, options.fetchImpl ?? fetch)
                        .then((token) => succeed({ token, user: pendingUser }))
                        .catch(fail);
                    break;
                }
                case 'cancel': {
                    fail(new DiscordError('Remote auth was cancelled from the mobile device.', 'remote_auth_cancelled'));
                    break;
                }
            }
        };
        ws.on('close', (code) => {
            if (settled)
                return;
            // The gateway closes the socket right after pending_login; the in-flight
            // ticket exchange settles the result, so this close must not preempt it.
            if (exchangeStarted)
                return;
            // 4003 is the gateway's timeout close code.
            if (code === 4003) {
                fail(new DiscordError('Remote auth session expired. Generate a new QR code and try again.', 'remote_auth_timeout'));
                return;
            }
            fail(new DiscordError(`Remote auth connection closed before completion (code ${code}).`, 'remote_auth_closed'));
        });
        ws.on('error', (error) => {
            fail(error instanceof Error ? error : new Error(String(error)));
        });
    });
}
function encodePublicKey(publicKey) {
    const spki = publicKey.export({ type: 'spki', format: 'der' });
    return spki.toString('base64');
}
function decryptPayload(privateKey, encryptedBase64) {
    return privateDecrypt({
        key: privateKey,
        padding: cryptoConstants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
    }, Buffer.from(encryptedBase64, 'base64'));
}
function computeNonceProof(privateKey, encryptedNonce) {
    const nonce = decryptPayload(privateKey, encryptedNonce);
    return base64UrlNoPadding(createHash('sha256').update(nonce).digest());
}
function parseUserPayload(payload) {
    const [id = '', discriminator = '0', avatar = '', username = ''] = payload.split(':');
    return { id, username, discriminator, avatar: avatar || null };
}
async function exchangeTicket(ticket, privateKey, fetchImpl) {
    const { Authorization: _omit, ...headers } = getDiscordHeaders('');
    const response = await fetchImpl(REMOTE_AUTH_LOGIN_URL, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket }),
    });
    if (response.status === 400) {
        const body = (await response.json().catch(() => ({})));
        if (body.captcha_sitekey) {
            throw new DiscordError('Discord requires a captcha to complete this login. Captcha solving is not supported; use `auth extract` instead.', 'remote_auth_captcha');
        }
    }
    if (!response.ok) {
        throw new DiscordError(`Failed to exchange remote auth ticket (HTTP ${response.status}).`, 'remote_auth_login_failed');
    }
    const body = (await response.json());
    if (!body.encrypted_token) {
        throw new DiscordError('Remote auth response did not include a token.', 'remote_auth_login_failed');
    }
    return decryptPayload(privateKey, body.encrypted_token).toString('utf8');
}
function base64UrlNoPadding(buffer) {
    return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export const __test = {
    encodePublicKey,
    computeNonceProof,
    parseUserPayload,
    base64UrlNoPadding,
    createPublicKey,
    createPrivateKey,
};
//# sourceMappingURL=remote-auth.js.map