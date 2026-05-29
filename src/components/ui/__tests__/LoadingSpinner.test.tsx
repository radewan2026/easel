import { render } from '@testing-library/react'
import { LoadingSpinner, LoadingOverlay } from '../LoadingSpinner'

describe('LoadingSpinner', () => {
  it('renders default spinner', () => {
    const { container } = render(<LoadingSpinner />)
    const spinner = container.firstChild as HTMLElement
    expect(spinner).toBeInTheDocument()
    expect(spinner.firstChild).toHaveClass('animate-spin')
  })

  it('applies size classes', () => {
    const { container } = render(<LoadingSpinner size="lg" />)
    const inner = container.firstChild?.firstChild as HTMLElement
    expect(inner).toHaveClass('w-12', 'h-12')
  })

  it('accepts className', () => {
    const { container } = render(<LoadingSpinner className="mt-4" />)
    expect(container.firstChild).toHaveClass('mt-4')
  })
})

describe('LoadingOverlay', () => {
  it('renders overlay with spinner', () => {
    const { container } = render(<LoadingOverlay />)
    expect(container.firstChild).toHaveClass('fixed', 'inset-0')
  })
})
