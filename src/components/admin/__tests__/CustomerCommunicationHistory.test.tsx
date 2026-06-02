import { render, screen } from '@testing-library/react'
import { CustomerCommunicationHistory } from '../CustomerCommunicationHistory'

const mockUseCommunications = vi.fn()

vi.mock('../../../hooks/useCustomerCommunications', () => ({
  useCustomerCommunications: () => mockUseCommunications(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('CustomerCommunicationHistory', () => {
  it('shows loading state', () => {
    mockUseCommunications.mockReturnValue({ data: undefined, isLoading: true })
    render(<CustomerCommunicationHistory email="test@example.com" />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('shows not-connected state when backend is down', () => {
    mockUseCommunications.mockReturnValue({
      data: { entries: [], emailCount: 0, smsCount: 0, backendConnected: false },
      isLoading: false,
    })
    render(<CustomerCommunicationHistory email="test@example.com" />)
    expect(screen.getByText(/Communication tables not connected/)).toBeInTheDocument()
  })

  it('shows empty state when no entries exist', () => {
    mockUseCommunications.mockReturnValue({
      data: { entries: [], emailCount: 0, smsCount: 0, backendConnected: true },
      isLoading: false,
    })
    render(<CustomerCommunicationHistory email="test@example.com" />)
    expect(screen.getByText(/No emails or texts sent/)).toBeInTheDocument()
  })

  it('shows email and SMS counts in header', () => {
    mockUseCommunications.mockReturnValue({
      data: { entries: [], emailCount: 3, smsCount: 2, backendConnected: true },
      isLoading: false,
    })
    render(<CustomerCommunicationHistory email="test@example.com" />)
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('renders an email entry with subject, status, and preview', () => {
    mockUseCommunications.mockReturnValue({
      data: {
        entries: [
          {
            id: 'email-1',
            channel: 'email',
            subject: 'Welcome to Easel',
            preview: 'Thanks for joining',
            status: 'delivered',
            sentAt: '2026-06-01T10:00:00Z',
            createdAt: '2026-06-01T10:00:00Z',
          },
        ],
        emailCount: 1,
        smsCount: 0,
        backendConnected: true,
      },
      isLoading: false,
    })
    render(<CustomerCommunicationHistory email="test@example.com" />)
    expect(screen.getByText('Welcome to Easel')).toBeInTheDocument()
    expect(screen.getByText('delivered')).toBeInTheDocument()
    expect(screen.getByText('Thanks for joining')).toBeInTheDocument()
  })

  it('renders an SMS entry with status and preview but no subject', () => {
    mockUseCommunications.mockReturnValue({
      data: {
        entries: [
          {
            id: 'sms-1',
            channel: 'sms',
            subject: null,
            preview: 'Your event is tomorrow',
            status: 'sent',
            sentAt: '2026-06-01T11:00:00Z',
            createdAt: '2026-06-01T11:00:00Z',
          },
        ],
        emailCount: 0,
        smsCount: 1,
        backendConnected: true,
      },
      isLoading: false,
    })
    render(<CustomerCommunicationHistory phone="+15551234567" />)
    expect(screen.getByText('SMS message')).toBeInTheDocument()
    expect(screen.getByText('sent')).toBeInTheDocument()
    expect(screen.getByText('Your event is tomorrow')).toBeInTheDocument()
  })

  it('applies correct status variant colors', () => {
    mockUseCommunications.mockReturnValue({
      data: {
        entries: [
          { id: 'email-1', channel: 'email', subject: 'Test', preview: '', status: 'bounced', sentAt: null, createdAt: '2026-06-01T10:00:00Z' },
          { id: 'email-2', channel: 'email', subject: 'Test 2', preview: '', status: 'opened', sentAt: null, createdAt: '2026-06-01T11:00:00Z' },
          { id: 'email-3', channel: 'email', subject: 'Test 3', preview: '', status: 'suppressed', sentAt: null, createdAt: '2026-06-01T12:00:00Z' },
        ],
        emailCount: 3,
        smsCount: 0,
        backendConnected: true,
      },
      isLoading: false,
    })
    render(<CustomerCommunicationHistory email="test@example.com" />)
    const badges = screen.getAllByText(/bounced|opened|suppressed/)
    expect(badges).toHaveLength(3)
  })
})
