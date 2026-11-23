import { beforeEach, describe, expect, mock, it } from 'bun:test'

import { SlackBotClient } from './client'
import { SlackBotError } from './types'

// Mock the @slack/web-api module
const mockAuth = {
  test: mock(() =>
    Promise.resolve({
      ok: true,
      user_id: 'U123',
      team_id: 'T456',
      bot_id: 'B789',
      user: 'testbot',
      team: 'Test Team',
    }),
  ),
}
const mockConversations = {
  list: mock(() =>
    Promise.resolve({
      ok: true,
      channels: [
        {
          id: 'C123',
          name: 'general',
          is_private: false,
          is_archived: false,
          created: 1234567890,
          creator: 'U001',
        },
      ],
    }),
  ),
  info: mock(() =>
    Promise.resolve({
      ok: true,
      channel: {
        id: 'C123',
        name: 'general',
        is_private: false,
        is_archived: false,
        created: 1234567890,
        creator: 'U001',
      },
    }),
  ),
  history: mock(() =>
    Promise.resolve({
      ok: true,
      messages: [{ ts: '1234567890.123456', text: 'Hello', type: 'message', user: 'U123' }],
    }),
  ),
  mark: mock(() => Promise.resolve({ ok: true })),
}
const mockChat = {
  postMessage: mock(() =>
    Promise.resolve({
      ok: true,
      ts: '1234567890.123456',
      message: { text: 'Hello', type: 'message' },
    }),
  ),
  scheduleMessage: mock(() =>
    Promise.resolve({
      ok: true,
      scheduled_message_id: 'SM123',
      channel: 'C123',
      post_at: 1700000000,
    }),
  ),
}
const mockReactions = {
  add: mock(() => Promise.resolve({ ok: true })),
  remove: mock(() => Promise.resolve({ ok: true })),
}
const mockAssistant = {
  threads: {
    setStatus: mock(() => Promise.resolve({ ok: true })),
  },
}
const mockPins = {
  add: mock(() => Promise.resolve({ ok: true })),
  remove: mock(() => Promise.resolve({ ok: true })),
}
const mockApiCall = mock((method: string) => {
  if (method === 'bookmarks.add')
    return Promise.resolve({
      ok: true,
      bookmark: {
        id: 'Bm123',
        channel_id: 'C123',
        title: 'Reference',
        link: 'https://example.com/reference',
        type: 'link',
        date_created: 0,
        date_updated: 0,
        created_by: 'U123',
      },
    })
  if (method === 'bookmarks.list')
    return Promise.resolve({
      ok: true,
      bookmarks: [
        {
          id: 'Bm123',
          channel_id: 'C123',
          title: 'Reference',
          link: 'https://example.com/reference',
          type: 'link',
          date_created: 0,
          date_updated: 0,
          created_by: 'U123',
        },
      ],
    })
  if (method === 'slackLists.items.list')
    return Promise.resolve({
      ok: true,
      items: [{ id: 'Rec1', list_id: 'F1', fields: [{ key: 'title', column_id: 'Col1', text: 'Task' }] }],
      response_metadata: { next_cursor: 'next' },
    })
  if (method === 'slackLists.items.create')
    return Promise.resolve({
      ok: true,
      item: { id: 'Rec2', list_id: 'F1', fields: [{ key: 'title', column_id: 'Col1', text: 'New' }] },
    })
  if (method === 'slackLists.create') return Promise.resolve({ ok: true, list_id: 'F1' })
  if (method === 'canvases.create' || method === 'conversations.canvases.create')
    return Promise.resolve({ ok: true, canvas_id: 'Canvas1' })
  return Promise.resolve({ ok: true })
})
const mockFiles = {
  uploadV2: mock(() =>
    Promise.resolve({
      ok: true,
      files: [
        {
          ok: true,
          files: [
            {
              id: 'F123',
              name: 'test.txt',
              title: 'test.txt',
              mimetype: 'text/plain',
              size: 12,
              url_private: 'https://files.slack.com/files-pri/T123-F123/test.txt',
              created: 1234567890,
              user: 'U123',
              channels: ['C123'],
            },
          ],
        },
      ],
    }),
  ),
  list: mock(() =>
    Promise.resolve({
      ok: true,
      files: [
        {
          id: 'F123',
          name: 'test.txt',
          title: 'test.txt',
          mimetype: 'text/plain',
          size: 1024,
          url_private: 'https://files.slack.com/files-pri/T123-F123/test.txt',
          created: 1234567890,
          user: 'U123',
        },
      ],
    }),
  ),
  info: mock(() =>
    Promise.resolve({
      ok: true,
      file: {
        id: 'F123',
        name: 'test.txt',
        title: 'test.txt',
        mimetype: 'text/plain',
        size: 1024,
        url_private: 'https://files.slack.com/files-pri/T123-F123/test.txt',
        created: 1234567890,
        user: 'U123',
        channels: ['C123'],
      },
    }),
  ),
  delete: mock(() => Promise.resolve({ ok: true })),
}
const mockUsers = {
  list: mock(() =>
    Promise.resolve({
      ok: true,
      members: [
        {
          id: 'U123',
          name: 'testuser',
          real_name: 'Test User',
          is_admin: false,
          is_owner: false,
          is_bot: false,
          is_app_user: false,
        },
      ],
    }),
  ),
  info: mock(() =>
    Promise.resolve({
      ok: true,
      user: {
        id: 'U123',
        name: 'testuser',
        real_name: 'Test User',
        is_admin: false,
        is_owner: false,
        is_bot: false,
        is_app_user: false,
      },
    }),
  ),
}

mock.module('@slack/web-api', () => ({
  WebClient: class MockWebClient {
    auth = mockAuth
    conversations = mockConversations
    chat = mockChat
    reactions = mockReactions
    users = mockUsers
    files = mockFiles
    assistant = mockAssistant
    pins = mockPins
    apiCall = mockApiCall
  },
}))

describe('SlackBotClient', () => {
  beforeEach(() => {
    // Reset mocks
    mockAuth.test.mockClear()
    mockConversations.list.mockClear()
    mockConversations.info.mockClear()
    mockConversations.history.mockClear()
    mockConversations.mark.mockClear()
    mockChat.postMessage.mockClear()
    mockChat.scheduleMessage.mockClear()
    mockReactions.add.mockClear()
    mockReactions.remove.mockClear()
    mockUsers.list.mockClear()
    mockUsers.info.mockClear()
    mockFiles.uploadV2.mockClear()
    mockFiles.list.mockClear()
    mockFiles.info.mockClear()
    mockFiles.delete.mockClear()
    mockAssistant.threads.setStatus.mockClear()
    mockPins.add.mockClear()
    mockPins.remove.mockClear()
    mockApiCall.mockClear()
  })

  describe('login', () => {
    it('accepts bot tokens (xoxb-)', async () => {
      // when/then: should not throw
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })
      expect(client).toBeDefined()
    })

    it('rejects user tokens (xoxp-)', async () => {
      // when/then
      await expect(new SlackBotClient().login({ token: 'xoxp-user-token' })).rejects.toThrow(SlackBotError)
    })

    it('rejects empty token', async () => {
      // when/then
      await expect(new SlackBotClient().login({ token: '' })).rejects.toThrow(SlackBotError)
    })

    it('rejects non-bot tokens', async () => {
      // when/then
      await expect(new SlackBotClient().login({ token: 'invalid-token' })).rejects.toThrow(SlackBotError)
    })
  })

  describe('testAuth', () => {
    it('returns auth info for valid token', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      const result = await client.testAuth()

      // then
      expect(result.user_id).toBe('U123')
      expect(result.team_id).toBe('T456')
      expect(result.bot_id).toBe('B789')
    })
  })

  describe('postMessage', () => {
    it('sends message and returns timestamp', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      const result = await client.postMessage('C123', 'Hello')

      // then
      expect(result.ts).toBe('1234567890.123456')
      expect(result.text).toBe('Hello')
    })

    it('does not pass blocks/attachments when omitted', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      await client.postMessage('C123', 'Hello')

      // then
      expect(mockChat.postMessage).toHaveBeenCalledWith({
        channel: 'C123',
        text: 'Hello',
        thread_ts: undefined,
        blocks: undefined,
        attachments: undefined,
        unfurl_links: undefined,
        unfurl_media: undefined,
        mrkdwn: undefined,
      })
    })

    it('forwards blocks to chat.postMessage', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })
      const blocks = [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: '*hello*' },
        },
      ]

      // when
      await client.postMessage('C123', 'Hello', { blocks })

      // then
      expect(mockChat.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ channel: 'C123', text: 'Hello', blocks }),
      )
    })

    it('forwards thread_ts, attachments, and unfurl/mrkdwn flags', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })
      const attachments = [{ text: 'attached' }]

      // when
      await client.postMessage('C123', 'Hello', {
        thread_ts: '1234567890.000001',
        attachments,
        unfurl_links: false,
        unfurl_media: false,
        mrkdwn: true,
      })

      // then
      expect(mockChat.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C123',
          text: 'Hello',
          thread_ts: '1234567890.000001',
          attachments,
          unfurl_links: false,
          unfurl_media: false,
          mrkdwn: true,
        }),
      )
    })
  })

  describe('getConversationHistory', () => {
    it('returns messages', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      const messages = await client.getConversationHistory('C123')

      // then
      expect(messages.length).toBeGreaterThan(0)
      expect(messages[0].ts).toBe('1234567890.123456')
    })

    it('passes through attachments and blocks of integration messages with empty text', async () => {
      // given
      const attachments = [{ fallback: '[FIRING:1] HighLoad', title: '[FIRING:1] HighLoad', text: 'load is 42' }]
      const blocks = [{ type: 'section', text: { type: 'mrkdwn', text: 'details' } }]
      mockConversations.history.mockImplementationOnce(
        () =>
          Promise.resolve({
            ok: true,
            messages: [{ ts: '1234567890.000002', text: '', type: 'message', bot_id: 'B1', attachments, blocks }],
          }) as any,
      )
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      const messages = await client.getConversationHistory('C123')

      // then
      expect(messages[0].attachments).toEqual(attachments)
      expect(messages[0].blocks).toEqual(blocks)
    })
  })

  describe('getMessage', () => {
    it('returns single message', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      const message = await client.getMessage('C123', '1234567890.123456')

      // then
      expect(message).not.toBeNull()
      expect(message?.ts).toBe('1234567890.123456')
    })
  })

  describe('addReaction', () => {
    it('adds reaction to message', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when/then: should not throw
      await client.addReaction('C123', '1234567890.123456', 'thumbsup')
      expect(mockReactions.add).toHaveBeenCalled()
    })
  })

  describe('removeReaction', () => {
    it('removes reaction from message', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when/then: should not throw
      await client.removeReaction('C123', '1234567890.123456', 'thumbsup')
      expect(mockReactions.remove).toHaveBeenCalled()
    })
  })

  describe('bookmarks', () => {
    it('sends exact add, remove, and list requests', async () => {
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      const added = await client.addBookmark('C123', 'Reference', 'https://example.com/reference')
      await client.removeBookmark('C123', 'Bm123')
      const listed = await client.listBookmarks('C123')

      expect(mockApiCall.mock.calls).toEqual([
        [
          'bookmarks.add',
          {
            channel_id: 'C123',
            title: 'Reference',
            link: 'https://example.com/reference',
            type: 'link',
          },
        ],
        ['bookmarks.remove', { channel_id: 'C123', bookmark_id: 'Bm123' }],
        ['bookmarks.list', { channel_id: 'C123' }],
      ])
      expect(added.id).toBe('Bm123')
      expect(listed.map(({ id }) => id)).toEqual(['Bm123'])
    })
  })

  describe('setAssistantStatus', () => {
    it('sets assistant typing status with channel_id and thread_ts', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      await client.setAssistantStatus('C123', '1234567890.123456', 'is typing...')

      // then
      expect(mockAssistant.threads.setStatus).toHaveBeenCalledWith({
        channel_id: 'C123',
        thread_ts: '1234567890.123456',
        status: 'is typing...',
      })
    })

    it('clears status when given empty string', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      await client.setAssistantStatus('C123', '1234567890.123456', '')

      // then
      expect(mockAssistant.threads.setStatus).toHaveBeenCalledWith({
        channel_id: 'C123',
        thread_ts: '1234567890.123456',
        status: '',
      })
    })
  })

  describe('listChannels', () => {
    it('returns list of channels', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      const channels = await client.listChannels()

      // then
      expect(channels.length).toBeGreaterThan(0)
      expect(channels[0].id).toBe('C123')
      expect(channels[0].name).toBe('general')
    })
  })

  describe('getChannelInfo', () => {
    it('returns channel details', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      const channel = await client.getChannelInfo('C123')

      // then
      expect(channel.id).toBe('C123')
      expect(channel.name).toBe('general')
    })
  })

  describe('resolveChannel', () => {
    it('returns channel ID unchanged when it starts with C', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      const channel = await client.resolveChannel('C123ABC')

      // then
      expect(channel).toBe('C123ABC')
      expect(mockConversations.list).not.toHaveBeenCalled()
    })

    it('returns channel ID unchanged when it starts with D', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      const channel = await client.resolveChannel('D123ABC')

      // then
      expect(channel).toBe('D123ABC')
      expect(mockConversations.list).not.toHaveBeenCalled()
    })

    it('returns channel ID unchanged when it starts with G', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      const channel = await client.resolveChannel('G123ABC')

      // then
      expect(channel).toBe('G123ABC')
      expect(mockConversations.list).not.toHaveBeenCalled()
    })

    it('resolves channel name to ID', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      const channel = await client.resolveChannel('general')

      // then
      expect(channel).toBe('C123')
      expect(mockConversations.list).toHaveBeenCalled()
    })

    it('strips leading # from channel name', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      const channel = await client.resolveChannel('#general')

      // then
      expect(channel).toBe('C123')
      expect(mockConversations.list).toHaveBeenCalled()
    })

    it('returns channel ID unchanged when input is #C prefixed ID', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      const channel = await client.resolveChannel('#C123ABC')

      // then
      expect(channel).toBe('C123ABC')
    })

    it('throws channel_not_found error when name is not found', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when/then
      try {
        await client.resolveChannel('does-not-exist')
        throw new Error('Expected resolveChannel to throw')
      } catch (error) {
        expect(error).toBeInstanceOf(SlackBotError)
        expect((error as SlackBotError).code).toBe('channel_not_found')
      }
    })
  })

  describe('listUsers', () => {
    it('returns list of users', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      const users = await client.listUsers()

      // then
      expect(users.length).toBeGreaterThan(0)
      expect(users[0].id).toBe('U123')
    })
  })

  describe('getUserInfo', () => {
    it('returns user details', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      const user = await client.getUserInfo('U123')

      // then
      expect(user.id).toBe('U123')
      expect(user.name).toBe('testuser')
    })
  })

  describe('uploadFile', () => {
    it('uploads file via files.uploadV2 and returns mapped file', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      const file = await client.uploadFile('C123', Buffer.from('test content'), 'test.txt')

      // then
      expect(file.id).toBe('F123')
      expect(file.name).toBe('test.txt')
      expect(file.size).toBe(12)
      expect(mockFiles.uploadV2).toHaveBeenCalledWith(
        expect.objectContaining({ channel_id: 'C123', filename: 'test.txt' }),
      )
    })

    it('forwards thread_ts, title, initial_comment to the SDK', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      await client.uploadFile('C123', Buffer.from('x'), 'test.txt', {
        thread_ts: '1234567890.123456',
        title: 'My Title',
        initial_comment: 'Here you go',
      })

      // then
      expect(mockFiles.uploadV2).toHaveBeenCalledWith(
        expect.objectContaining({
          channel_id: 'C123',
          filename: 'test.txt',
          thread_ts: '1234567890.123456',
          title: 'My Title',
          initial_comment: 'Here you go',
        }),
      )
    })

    it('throws SlackBotError when API responds not ok', async () => {
      // given
      mockFiles.uploadV2.mockResolvedValueOnce({ ok: false, error: 'file_upload_failed' } as any)
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when/then
      await expect(client.uploadFile('C123', Buffer.from('x'), 'test.txt')).rejects.toThrow(SlackBotError)
    })

    it('throws SlackBotError when completion has no inner files', async () => {
      // given
      mockFiles.uploadV2.mockResolvedValueOnce({ ok: true, files: [{ ok: true, files: [] }] } as any)
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when/then
      await expect(client.uploadFile('C123', Buffer.from('x'), 'test.txt')).rejects.toThrow(SlackBotError)
    })
  })

  describe('listFiles', () => {
    it('returns mapped files', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      const files = await client.listFiles()

      // then
      expect(files).toHaveLength(1)
      expect(files[0].id).toBe('F123')
      expect(files[0].mimetype).toBe('text/plain')
    })

    it('forwards channel/user/limit to the SDK', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      await client.listFiles({ channel: 'C123', user: 'U123', limit: 50 })

      // then
      expect(mockFiles.list).toHaveBeenCalledWith({ channel: 'C123', user: 'U123', count: 50 })
    })
  })

  describe('getFileInfo', () => {
    it('returns file metadata', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      const file = await client.getFileInfo('F123')

      // then
      expect(file.id).toBe('F123')
      expect(file.url_private).toBe('https://files.slack.com/files-pri/T123-F123/test.txt')
    })

    it('throws on API failure', async () => {
      // given
      mockFiles.info.mockResolvedValueOnce({ ok: false, error: 'file_not_found' } as any)
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when/then
      await expect(client.getFileInfo('F999')).rejects.toThrow(SlackBotError)
    })
  })

  describe('downloadFile', () => {
    it('downloads file content using the bot token', async () => {
      // given
      const originalFetch = globalThis.fetch
      let capturedAuthHeader: string | null = null
      globalThis.fetch = Object.assign(
        async (url: string | URL | Request, init?: RequestInit) => {
          capturedAuthHeader = new Headers(init?.headers).get('Authorization')
          if (String(url).startsWith('https://slack.com/api/files.info'))
            return Response.json(await mockFiles.info({ file: 'F123' }))
          return new Response(Buffer.from('downloaded content'), { status: 200 })
        },
        { preconnect: originalFetch.preconnect },
      )

      try {
        const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

        // when
        const result = await client.downloadFile('F123')

        // then
        expect(capturedAuthHeader).toBe('Bearer xoxb-test-token')
        expect(result.file.id).toBe('F123')
        expect(result.buffer.toString()).toBe('downloaded content')
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    it('throws SlackBotError when download HTTP response is not ok', async () => {
      // given
      const originalFetch = globalThis.fetch
      globalThis.fetch = async () => new Response('forbidden', { status: 403, statusText: 'Forbidden' })

      try {
        const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

        // when/then
        await expect(client.downloadFile('F123')).rejects.toThrow(SlackBotError)
      } finally {
        globalThis.fetch = originalFetch
      }
    })
  })

  describe('deleteFile', () => {
    it('calls files.delete with the given file ID', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      await client.deleteFile('F123')

      // then
      expect(mockFiles.delete).toHaveBeenCalledWith({ file: 'F123' })
    })

    it('throws on API failure', async () => {
      // given
      mockFiles.delete.mockResolvedValueOnce({ ok: false, error: 'cant_delete_file' } as any)
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when/then
      await expect(client.deleteFile('F123')).rejects.toThrow(SlackBotError)
    })
  })

  describe('message actions', () => {
    it('sends exact pin, schedule, and mark requests', async () => {
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })
      const blocks = [{ type: 'section', text: { type: 'mrkdwn', text: 'Later' } }]

      await client.pinMessage('C123', '123.456')
      await client.unpinMessage('C123', '123.456')
      const scheduled = await client.scheduleMessage('C123', 'Later', 1700000000, '100.200', { blocks })
      await client.markRead('C123', '123.456')

      expect(mockPins.add).toHaveBeenCalledWith({ channel: 'C123', timestamp: '123.456' })
      expect(mockPins.remove).toHaveBeenCalledWith({ channel: 'C123', timestamp: '123.456' })
      expect(mockChat.scheduleMessage).toHaveBeenCalledWith({
        channel: 'C123',
        text: 'Later',
        post_at: 1700000000,
        thread_ts: '100.200',
        blocks,
      })
      expect(scheduled).toEqual({ scheduledMessageId: 'SM123', channelId: 'C123', postAt: 1700000000 })
      expect(mockConversations.mark).toHaveBeenCalledWith({ channel: 'C123', ts: '123.456' })
    })

    it('surfaces a typed SlackBotError refusal', async () => {
      mockPins.add.mockResolvedValueOnce({ ok: false, error: 'not_pinnable' })
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      await expect(client.pinMessage('C123', '123.456')).rejects.toMatchObject({
        name: 'SlackBotError',
        code: 'not_pinnable',
      })
    })
  })

  describe('Lists and Canvas actions', () => {
    it('sends exact Slack Lists requests and maps compact results', async () => {
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })
      const richText = [{ type: 'rich_text', elements: [] }]
      const field = { column_id: 'Col1', rich_text: richText }
      const cell = { row_id: 'Rec1', ...field }

      const page = await client.listListItems('F1', { limit: 10, cursor: 'cursor' })
      const item = await client.createListItem('F1', [field])
      await client.updateListItems('F1', [cell])
      await client.deleteListItem('F1', 'Rec1')
      const list = await client.createList('Tasks', { todoMode: true })

      expect(page).toEqual({
        items: [{ id: 'Rec1', listId: 'F1', fields: [{ key: 'title', columnId: 'Col1', text: 'Task' }] }],
        nextCursor: 'next',
      })
      expect(item.id).toBe('Rec2')
      expect(list).toEqual({ listId: 'F1' })
      expect(mockApiCall).toHaveBeenNthCalledWith(1, 'slackLists.items.list', {
        list_id: 'F1',
        limit: 10,
        cursor: 'cursor',
      })
      expect(mockApiCall).toHaveBeenNthCalledWith(2, 'slackLists.items.create', {
        list_id: 'F1',
        initial_fields: [field],
      })
      expect(mockApiCall).toHaveBeenNthCalledWith(3, 'slackLists.items.update', { list_id: 'F1', cells: [cell] })
      expect(mockApiCall).toHaveBeenNthCalledWith(4, 'slackLists.items.delete', { list_id: 'F1', id: 'Rec1' })
      expect(mockApiCall).toHaveBeenNthCalledWith(5, 'slackLists.create', {
        name: 'Tasks',
        description_blocks: undefined,
        schema: undefined,
        copy_from_list_id: undefined,
        include_copied_list_records: undefined,
        todo_mode: true,
      })
    })

    it('sends exact Canvas requests and surfaces typed refusals', async () => {
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })
      const changes = [
        {
          operation: 'insert_at_end' as const,
          document_content: { type: 'markdown' as const, markdown: 'More' },
        },
      ]

      expect(await client.createCanvas('Plan', '# Plan', { channelId: 'C123' })).toEqual({ canvasId: 'Canvas1' })
      await client.editCanvas('Canvas1', changes)
      expect(await client.createChannelCanvas('C123', '# Home', 'Home')).toEqual({ canvasId: 'Canvas1' })
      expect(mockApiCall).toHaveBeenNthCalledWith(1, 'canvases.create', {
        title: 'Plan',
        document_content: { type: 'markdown', markdown: '# Plan' },
        channel_id: 'C123',
      })
      expect(mockApiCall).toHaveBeenNthCalledWith(2, 'canvases.edit', { canvas_id: 'Canvas1', changes })
      expect(mockApiCall).toHaveBeenNthCalledWith(3, 'conversations.canvases.create', {
        channel_id: 'C123',
        document_content: { type: 'markdown', markdown: '# Home' },
        title: 'Home',
      })

      mockApiCall.mockResolvedValueOnce({ ok: false, error: 'canvas_not_found' })
      await expect(client.editCanvas('missing', changes)).rejects.toMatchObject({
        name: 'SlackBotError',
        code: 'canvas_not_found',
      })
    })
  })
})
