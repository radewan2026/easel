import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FeatureGate } from '../FeatureGate'

const mockHasFeature = vi.fn()
const mockUseFeatures = vi.fn()

vi.mock('../../../hooks/useTenantPlan', () => ({
  useFeatures: () => mockUseFeatures(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockUseFeatures.mockReturnValue({
    hasFeature: mockHasFeature,
    isLoading: false,
  })
})

describe('FeatureGate', () => {
  it('renders children when feature is available', () => {
    mockHasFeature.mockReturnValue(true)
    render(<FeatureGate feature="email_marketing"><p>Content</p></FeatureGate>)
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('renders null when feature is unavailable without upgrade card', () => {
    mockHasFeature.mockReturnValue(false)
    const { container } = render(<FeatureGate feature="email_marketing"><p>Content</p></FeatureGate>)
    expect(container.firstChild).toBeNull()
  })

  it('renders upgrade card when feature is unavailable and showUpgradeCard is true', () => {
    mockHasFeature.mockReturnValue(false)
    render(
      <FeatureGate
        feature="email_marketing"
        showUpgradeCard
        upgradeTitle="Upgrade Now"
        upgradeDescription="Get this feature on Pro"
      />
    )
    expect(screen.getByText('Upgrade Now')).toBeInTheDocument()
    expect(screen.getByText('Get this feature on Pro')).toBeInTheDocument()
    expect(screen.getByText('View Plans')).toBeInTheDocument()
  })

  it('renders fallback instead of null when provided', () => {
    mockHasFeature.mockReturnValue(false)
    render(
      <FeatureGate feature="email_marketing" fallback={<p>Fallback</p>}>
        <p>Content</p>
      </FeatureGate>
    )
    expect(screen.getByText('Fallback')).toBeInTheDocument()
    expect(screen.queryByText('Content')).not.toBeInTheDocument()
  })

  it('shows loading skeleton when isLoading is true', () => {
    mockUseFeatures.mockReturnValue({
      hasFeature: mockHasFeature,
      isLoading: true,
    })
    const { container } = render(<FeatureGate feature="email_marketing"><p>Content</p></FeatureGate>)
    const pulseElements = container.querySelectorAll('.animate-pulse')
    expect(pulseElements.length).toBeGreaterThanOrEqual(3)
  })

  it('redirects to billing when View Plans is clicked', async () => {
    const originalLocation = window.location
    const assignMock = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, href: '' },
      writable: true,
    })

    mockHasFeature.mockReturnValue(false)
    render(<FeatureGate feature="email_marketing" showUpgradeCard />)
    const viewPlansBtn = screen.getByText('View Plans')
    await userEvent.click(viewPlansBtn)

    expect(window.location.href).toBe('/admin/settings?tab=billing')
  })
})
