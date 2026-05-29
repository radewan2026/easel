import { callAiGateway, hasAiGateway } from '../aiGateway'

beforeEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('callAiGateway', () => {
  it('returns unconfigured when no endpoint set', async () => {
    vi.stubEnv('VITE_AI_GATEWAY_URL', '')
    const result = await callAiGateway({
      messages: [{ role: 'user', content: 'Hello' }],
    })
    expect(result).toEqual({ content: null, source: 'unconfigured' })
  })

  it('returns content from gateway on success', async () => {
    vi.stubEnv('VITE_AI_GATEWAY_URL', 'https://ai.example.com/chat')
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: 'Hello, world!' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await callAiGateway({
      messages: [{ role: 'user', content: 'Say hello' }],
    })
    expect(result).toEqual({ content: 'Hello, world!', source: 'gateway' })
    expect(mockFetch).toHaveBeenCalledWith(
      'https://ai.example.com/chat',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('Say hello'),
      })
    )
  })

  it('handles non-ok response', async () => {
    vi.stubEnv('VITE_AI_GATEWAY_URL', 'https://ai.example.com/chat')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))

    const result = await callAiGateway({
      messages: [{ role: 'user', content: 'test' }],
    })
    expect(result.source).toBe('error')
    expect(result.error).toContain('500')
  })

  it('handles timeout', async () => {
    vi.stubEnv('VITE_AI_GATEWAY_URL', 'https://ai.example.com/chat')

    const abortError = new DOMException('Aborted', 'AbortError')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError))

    const result = await callAiGateway({
      messages: [{ role: 'user', content: 'test' }],
    })
    expect(result.source).toBe('error')
    expect(result.error).toContain('timed out')
  })

  it('handles network error', async () => {
    vi.stubEnv('VITE_AI_GATEWAY_URL', 'https://ai.example.com/chat')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')))

    const result = await callAiGateway({
      messages: [{ role: 'user', content: 'test' }],
    })
    expect(result.source).toBe('error')
    expect(result.error).toContain('request failed')
  })

  it('extracts content from nested choices format', async () => {
    vi.stubEnv('VITE_AI_GATEWAY_URL', 'https://ai.example.com/chat')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: 'Nested response' } }],
      }),
    }))

    const result = await callAiGateway({
      messages: [{ role: 'user', content: 'test' }],
    })
    expect(result.content).toBe('Nested response')
  })

  it('extracts content from message format', async () => {
    vi.stubEnv('VITE_AI_GATEWAY_URL', 'https://ai.example.com/chat')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: 'Message format response' }),
    }))

    const result = await callAiGateway({
      messages: [{ role: 'user', content: 'test' }],
    })
    expect(result.content).toBe('Message format response')
  })

  it('returns null content when no known field exists', async () => {
    vi.stubEnv('VITE_AI_GATEWAY_URL', 'https://ai.example.com/chat')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ unknown: 'shape' }),
    }))

    const result = await callAiGateway({
      messages: [{ role: 'user', content: 'test' }],
    })
    expect(result.content).toBeNull()
    expect(result.source).toBe('gateway')
  })
})

describe('hasAiGateway', () => {
  it('returns true when endpoint is set', () => {
    vi.stubEnv('VITE_AI_GATEWAY_URL', 'https://ai.example.com')
    expect(hasAiGateway()).toBe(true)
  })

  it('returns false when endpoint is empty', () => {
    vi.stubEnv('VITE_AI_GATEWAY_URL', '')
    expect(hasAiGateway()).toBe(false)
  })
})
