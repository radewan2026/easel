import { render, screen } from '@testing-library/react'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../Card'

describe('Card', () => {
  it('renders children', () => {
    render(<Card><p>Content</p></Card>)
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('applies base classes', () => {
    const { container } = render(<Card>Card</Card>)
    expect(container.firstChild).toHaveClass('rounded-xl', 'shadow-sm', 'border', 'overflow-hidden')
  })

  it('applies CSS variable styles', () => {
    const { container } = render(<Card>Styled</Card>)
    expect(container.firstChild).toHaveStyle({ backgroundColor: 'var(--card-bg)' })
  })
})

describe('CardHeader', () => {
  it('renders children', () => {
    render(<CardHeader><h2>Header</h2></CardHeader>)
    expect(screen.getByText('Header')).toBeInTheDocument()
  })
})

describe('CardTitle', () => {
  it('renders as h3', () => {
    render(<CardTitle>Title</CardTitle>)
    const el = screen.getByText('Title')
    expect(el.tagName).toBe('H3')
    expect(el).toHaveClass('text-lg', 'font-semibold')
  })
})

describe('CardContent', () => {
  it('renders children', () => {
    render(<CardContent><span>Body</span></CardContent>)
    expect(screen.getByText('Body')).toBeInTheDocument()
  })
})

describe('CardFooter', () => {
  it('renders children', () => {
    render(<CardFooter><button>Action</button></CardFooter>)
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument()
  })
})
