import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmDialog } from '../ConfirmDialog'

describe('ConfirmDialog', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    message: 'Are you sure?',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders when isOpen is true', () => {
    render(<ConfirmDialog {...defaultProps} />)
    expect(screen.getByText('Are you sure?')).toBeInTheDocument()
    expect(screen.getByText('Confirm')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('does not render when isOpen is false', () => {
    render(<ConfirmDialog {...defaultProps} isOpen={false} />)
    expect(screen.queryByText('Are you sure?')).not.toBeInTheDocument()
  })

  it('renders custom title', () => {
    render(<ConfirmDialog {...defaultProps} title="Delete Item" />)
    expect(screen.getByText('Delete Item')).toBeInTheDocument()
  })

  it('renders custom button labels', () => {
    render(<ConfirmDialog {...defaultProps} confirmLabel="Yes" cancelLabel="No" />)
    expect(screen.getByText('Yes')).toBeInTheDocument()
    expect(screen.getByText('No')).toBeInTheDocument()
  })

  it('calls onConfirm when confirm button clicked', async () => {
    const onConfirm = vi.fn()
    render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />)
    await userEvent.click(screen.getByText('Confirm'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when cancel button clicked', async () => {
    const onClose = vi.fn()
    render(<ConfirmDialog {...defaultProps} onClose={onClose} />)
    await userEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Escape key pressed', async () => {
    const onClose = vi.fn()
    render(<ConfirmDialog {...defaultProps} onClose={onClose} />)
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when overlay clicked', async () => {
    const onClose = vi.fn()
    render(<ConfirmDialog {...defaultProps} onClose={onClose} />)
    const backdrop = document.querySelector('.fixed .inset-0') as HTMLElement
    await userEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows loading state on confirm button', () => {
    render(<ConfirmDialog {...defaultProps} isLoading />)
    expect(screen.getByText('Processing...')).toBeInTheDocument()
    expect(screen.getByText('Processing...').closest('button')).toBeDisabled()
  })

  it('shows warning icon for warning variant', () => {
    const { container } = render(<ConfirmDialog {...defaultProps} variant="warning" />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('shows trash icon when icon is trash', () => {
    const { container } = render(<ConfirmDialog {...defaultProps} icon="trash" />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('renders without icon when icon is none', () => {
    const { container } = render(<ConfirmDialog {...defaultProps} icon="none" />)
    const iconContainer = container.querySelector('.w-10.h-10')
    expect(iconContainer).not.toBeInTheDocument()
  })
})
