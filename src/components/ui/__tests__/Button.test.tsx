import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '../Button'

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })

  it('applies variant classes', () => {
    const { container } = render(<Button variant="danger">Delete</Button>)
    expect(container.firstChild).toHaveClass('bg-red-600')
  })

  it('applies size classes', () => {
    const { container } = render(<Button size="sm">Small</Button>)
    expect(container.firstChild).toHaveClass('px-3', 'py-1.5', 'text-sm')
  })

  it('disables and shows reduced opacity', () => {
    render(<Button disabled>Disabled</Button>)
    expect(screen.getByRole('button', { name: 'Disabled' })).toBeDisabled()
  })

  it('fires onClick when clicked', async () => {
    const fn = vi.fn()
    render(<Button onClick={fn}>Click</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Click' }))
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('does not fire onClick when disabled', async () => {
    const fn = vi.fn()
    render(<Button onClick={fn} disabled>Click</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Click' }))
    expect(fn).not.toHaveBeenCalled()
  })

  it('forwards ref', () => {
    const ref = vi.fn()
    render(<Button ref={ref}>Ref</Button>)
    expect(ref).toHaveBeenCalled()
  })
})
