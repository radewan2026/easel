import { render, screen } from '@testing-library/react'
import { Badge } from '../Badge'

describe('Badge', () => {
  it('renders children', () => {
    render(<Badge>Active</Badge>)
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('applies primary variant by default', () => {
    const { container } = render(<Badge>Default</Badge>)
    expect(container.firstChild).toHaveClass('bg-primary-100', 'text-primary-800')
  })

  it('applies success variant', () => {
    const { container } = render(<Badge variant="success">Done</Badge>)
    expect(container.firstChild).toHaveClass('bg-green-100', 'text-green-800')
  })

  it('applies danger variant', () => {
    const { container } = render(<Badge variant="danger">Error</Badge>)
    expect(container.firstChild).toHaveClass('bg-red-100', 'text-red-800')
  })

  it('applies gray variant with CSS variable styles', () => {
    const { container } = render(<Badge variant="gray">Gray</Badge>)
    expect(container.firstChild).toHaveStyle({
      backgroundColor: 'var(--bg-tertiary)',
      color: 'var(--text-secondary)',
    })
  })

  it('forwards className', () => {
    const { container } = render(<Badge className="extra-class">Styled</Badge>)
    expect(container.firstChild).toHaveClass('extra-class')
  })
})
