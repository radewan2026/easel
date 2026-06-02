import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useCustomerCommunications } from '../useCustomerCommunications'
import { supabase } from '../../lib/supabase'

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

let emailRows: Record<string, unknown>[] = []
let smsRows: Record<string, unknown>[] = []
let emailError: Record<string, string> | null = null
let smsError: Record<string, string> | null = null

beforeEach(() => {
  vi.clearAllMocks()
  emailRows = []
  smsRows = []
  emailError = null
  smsError = null

  ;(supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
    const isEmail = table === 'email_sends'
    const rows = isEmail ? emailRows : smsRows
    const err = isEmail ? emailError : smsError

    const chain: Record<string, unknown> = {
      select: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(err ? { data: null, error: err } : { data: rows, error: null }),
    }
    return chain
  })
})

describe('useCustomerCommunications', () => {
  it('returns empty when no email or phone provided', () => {
    const { result } = renderHook(() => useCustomerCommunications(null, null), {
      wrapper: createWrapper(),
    })
    expect(result.current.data).toBeUndefined()
    expect(result.current.isLoading).toBe(false)
  })

  it('fetches email sends and maps them to entries', async () => {
    emailRows = [
      { id: '1', subject_snapshot: 'Welcome', body_snapshot: '<p>Hello</p>', status: 'delivered', sent_at: '2026-06-01T10:00:00Z', created_at: '2026-06-01T10:00:00Z' },
    ]

    const { result } = renderHook(() => useCustomerCommunications('test@example.com'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data!.entries).toHaveLength(1)
    expect(result.current.data!.entries[0].channel).toBe('email')
    expect(result.current.data!.entries[0].subject).toBe('Welcome')
    expect(result.current.data!.entries[0].preview).toBe('Hello')
    expect(result.current.data!.entries[0].status).toBe('delivered')
    expect(result.current.data!.emailCount).toBe(1)
    expect(result.current.data!.smsCount).toBe(0)
    expect(result.current.data!.backendConnected).toBe(true)
  })

  it('fetches sms messages and maps them to entries', async () => {
    smsRows = [
      { id: '1', body_snapshot: 'Reminder', status: 'sent', sent_at: '2026-06-01T11:00:00Z', created_at: '2026-06-01T11:00:00Z', recipient_phone: '+15551234567' },
    ]

    const { result } = renderHook(() => useCustomerCommunications(null, '+15551234567'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data!.entries).toHaveLength(1)
    expect(result.current.data!.entries[0].channel).toBe('sms')
    expect(result.current.data!.entries[0].subject).toBeNull()
    expect(result.current.data!.entries[0].preview).toBe('Reminder')
    expect(result.current.data!.entries[0].status).toBe('sent')
    expect(result.current.data!.smsCount).toBe(1)
    expect(result.current.data!.backendConnected).toBe(true)
  })

  it('merges email and sms entries sorted by createdAt descending', async () => {
    emailRows = [
      { id: 'e1', subject_snapshot: 'Older', body_snapshot: '', status: 'sent', sent_at: null, created_at: '2026-05-01T10:00:00Z' },
    ]
    smsRows = [
      { id: 's1', body_snapshot: 'Newer', status: 'sent', sent_at: null, created_at: '2026-06-01T10:00:00Z', recipient_phone: '+15551234567' },
    ]

    const { result } = renderHook(() => useCustomerCommunications('test@example.com', '+15551234567'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data!.entries).toHaveLength(2)
    expect(result.current.data!.entries[0].id).toBe('sms-s1')
    expect(result.current.data!.entries[1].id).toBe('email-e1')
  })

  it('sets backendConnected to false when email query fails', async () => {
    emailError = { message: 'relation not found' }

    const { result } = renderHook(() => useCustomerCommunications('test@example.com'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data!.backendConnected).toBe(false)
    expect(result.current.data!.entries).toHaveLength(0)
  })

  it('stripHtml removes HTML tags from preview', async () => {
    emailRows = [
      { id: '1', subject_snapshot: 'Test', body_snapshot: '<h1>Big</h1><p>Hello <b>world</b></p>', status: 'sent', sent_at: null, created_at: '2026-06-01T10:00:00Z' },
    ]

    const { result } = renderHook(() => useCustomerCommunications('test@example.com'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data!.entries[0].preview).toBe('Big Hello world')
  })

  it('normalizes email to lowercase when querying', async () => {
    let capturedEmail: string | undefined
    ;(supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
      const chain: Record<string, unknown> = {
        select: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockImplementation((col: string, val: string) => { capturedEmail = val; return chain }),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      }
      return chain
    })

    renderHook(() => useCustomerCommunications('TEST@EXAMPLE.COM'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(capturedEmail).toBe('test@example.com'))
  })
})
