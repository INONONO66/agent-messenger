import { createAccountClient } from './account'
import type { TelegramAccountClient } from './account-types'

export function createTelegramAccountClient(): TelegramAccountClient {
  return createAccountClient()
}
export { TelegramAccountError } from './account-types'
export type {
  TelegramAccountClient,
  TelegramAccountErrorCode,
  TelegramAccountMessage,
  TelegramAccountState,
  TelegramHistoryPage,
  TelegramLoginAction,
  TelegramSendContent,
  TelegramSendBytes,
} from './account-types'
