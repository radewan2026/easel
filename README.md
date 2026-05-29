# Paint & Sip - Event Website

A full-stack Paint & Sip event website with both a public site and an admin dashboard.

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS 4
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **State Management**: TanStack Query (React Query)
- **Routing**: React Router v7
- **Charts**: Recharts
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account

### Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Copy the environment file:

```bash
cp .env.example .env
```

4. Update `.env` with your Supabase credentials:

```
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

### Setting Up Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)

2. Run the SQL migration script:

```bash
# In Supabase SQL Editor, run:
# supabase/migrations/001_initial_schema.sql
```

3. (Optional) Run the seed data script:

```bash
# In Supabase SQL Editor, run:
# supabase/seed.sql
```

### Development

Start the development server:

```bash
npm run dev
```

The site will be available at:
- Public site: http://localhost:5173
- Admin dashboard: http://localhost:5173/admin

### Building for Production

```bash
npm run build
```

## Project Structure

```
src/
├── components/
│   ├── layout/          # Layout components
│   │   ├── AdminLayout.tsx
│   │   └── PublicLayout.tsx
│   └── ui/              # Reusable UI components
│       ├── Badge.tsx
│       ├── Button.tsx
│       ├── Card.tsx
│       ├── Input.tsx
│       ├── LoadingSpinner.tsx
│       ├── Modal.tsx
│       ├── Select.tsx
│       └── Textarea.tsx
├── hooks/
│   ├── useAdmin.ts      # Admin-specific hooks
│   ├── useBlog.ts      # Blog data hooks
│   └── useEvents.ts    # Events data hooks
├── lib/
│   ├── supabase.ts     # Supabase client
│   └── utils.ts        # Utility functions
├── pages/
│   ├── admin/         # Admin pages
│   │   ├── AccountsPage.tsx
│   │   ├── BlogPage.tsx
│   │   ├── CouponsPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── EventsPage.tsx
│   │   ├── SalesPage.tsx
│   │   ├── SettingsPage.tsx
│   │   └── VenuesPage.tsx
│   └── public/        # Public pages
│       ├── BlogDetailPage.tsx
│       ├── BlogPage.tsx
│       ├── CheckoutPage.tsx
│       ├── CheckoutSuccessPage.tsx
│       ├── EventDetailPage.tsx
│       ├── EventsPage.tsx
│       └── HomePage.tsx
├── types/
│   └── database.ts     # TypeScript types
├── App.tsx           # Main app component
├── main.tsx          # Entry point
└── index.css        # Global styles
```

## Features

### Public Site

- **Home Page**: Hero section, upcoming events with view toggles (card/calendar/list)
- **Events Page**: Full events listing with filters
- **Event Detail**: Image gallery, booking form
- **Checkout**: Multi-attendee forms, coupon validation, simulated payment
- **Blog**: Post listing and detail pages

### Admin Dashboard

- **Dashboard**: Stats cards, sales charts
- **Events CRUD**: Full event management
- **Venues CRUD**: Venue management
- **Coupons CRUD**: Coupon management with bulk import
- **Sales**: Order management and status updates
- **Blog**: Post and category management with AI tools
- **Settings**: Site configuration
- **Accounts**: User management

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable/anonymous key |

## License

MIT