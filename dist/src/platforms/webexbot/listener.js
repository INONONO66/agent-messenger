import { WebexListener } from '../webex/listener.js';
import { WebexError } from '../webex/types.js';
import { WebexBotError } from './types.js';
export class WebexBotListener extends WebexListener {
    // Preserve the bot error contract: WDM discovery (shared with the user platform)
    // throws WebexError, but existing bot callers catch WebexBotError.
    async start() {
        try {
            await super.start();
        }
        catch (error) {
            if (error instanceof WebexError) {
                throw new WebexBotError(error.message, error.code);
            }
            throw error;
        }
    }
}
//# sourceMappingURL=listener.js.map