# Easel Owner Dashboard PRD

## Summary

Redesign the admin home page from a broad analytics grid into a configurable owner briefing. The first screen should help studio owners understand what needs attention today, then let them drill into operations and performance.

The current code already supports dashboard preferences, active widget selection, and drag-to-reorder widgets in `src/pages/admin/DashboardPage.tsx`, backed by `src/hooks/useAdmin.ts`. This project should build on that foundation instead of replacing it wholesale.

## Goals

- Make the dashboard feel calmer, less busy, and more modern.
- Prioritize daily owner decisions over raw metrics.
- Preserve and improve widget customization.
- Surface operational issues before analytics.
- Make dashboard widgets actionable, not just informational.

## Non-Goals

- Do not rebuild the entire admin app.
- Do not remove existing reports pages.
- Do not replace Supabase data models unless a specific missing field requires it.
- Do not make the dashboard a marketing-style landing page.

## Current State

The admin currently includes:

- Dashboard widgets for revenue, seats sold, average ticket value, repeat rate, sales chart, recent sales, upcoming events, low inventory, gift card liability, coupons, churn risk, subscribers, action items, quick actions, top events, and venue utilization.
- User dashboard preferences stored in the `settings` table using `dashboard_prefs_${userId}`.
- Drag-and-drop widget reorder.
- Widget toggle configuration.
- Admin navigation in `src/components/layout/AdminLayout.tsx`.

## User Problem

Studio owners do not primarily need a wall of metrics. They need a quick morning briefing:

- What needs attention today?
- Which events need promotion or staff?
- Are there new private event leads?
- Is payroll ready?
- Are payments, gift cards, or inventory healthy?
- What should I do next?

## Proposed UX

### Page Structure

1. Header
   - Page title: `Today`
   - Subtitle: studio name and date
   - Controls: date window, `Customize widgets`, optional `Create`

2. Priority Strip
   - Three to four compact action cards.
   - Examples:
     - `2 Events Need Attention`
     - `1 Private Request`
     - `Payroll Ready`
     - `Payment Setup OK`

3. Primary Widget
   - `Upcoming Events This Week`
   - This should be the largest panel.
   - Columns:
     - Event
     - Date
     - Fill
     - Staff
     - Next Step

4. Right Rail
   - `Next Best Actions`
   - `Recent Activity`
   - `Homepage Widgets`

5. Secondary Performance Snapshot
   - Revenue
   - Seats Sold
   - Repeat Rate
   - Gift Card Liability

## Widget Customization Requirements

The user should be able to:

- Toggle homepage widgets on/off.
- Reorder widgets.
- Reset to default.
- Save preferences per admin user.
- See a clear empty state if no widgets are selected.

Recommended default widgets:

- Priority Strip
- Upcoming Events This Week
- Next Best Actions
- Recent Activity
- Performance Snapshot

Optional widgets:

- Private Event Pipeline
- Revenue Trend
- Recent Sales
- Gift Card Liability
- Customer Follow-Up
- Low Inventory
- Payroll Summary
- Top Events
- Venue Utilization

## Implementation Notes

### Primary Files

- `src/pages/admin/DashboardPage.tsx`
  - Main dashboard rendering.
  - Current widget renderer.
  - Current widget customization UI.

- `src/hooks/useAdmin.ts`
  - Current dashboard stats.
  - Current dashboard preferences.
  - Add owner briefing fields here where practical.

- `src/components/layout/AdminLayout.tsx`
  - Optional navigation simplification.
  - Optional top-bar create/customize affordances.

### Suggested Refactor

Split `DashboardPage.tsx` into smaller components:

- `DashboardHeader`
- `PriorityStrip`
- `UpcomingEventsWidget`
- `NextBestActionsWidget`
- `RecentActivityWidget`
- `PerformanceSnapshot`
- `WidgetCustomizer`

Keep the first implementation local to the admin dashboard. Avoid creating a large new abstraction until patterns settle.

### Data Additions

Extend `useDashboardStats` to provide:

- low-fill upcoming events, e.g. fill rate below 35 percent
- upcoming events missing assigned staff
- private request counts by status
- payroll/pay queue summary
- recent activity feed
- recommended next actions

The current hook already pulls upcoming events, orders, gift cards, coupons, subscribers, venues, and products. The likely additions are private requests, assignments, and pay queue/time entry state.

## Acceptance Criteria

- Dashboard opens to a calmer `Today` view.
- Above the fold contains no more than four priority cards.
- `Upcoming Events This Week` is visually dominant.
- Each priority item includes a direct next action.
- Widget customization remains available and understandable.
- User-selected widgets persist per admin user.
- Existing KPI and chart widgets remain available as optional widgets.
- Dashboard has useful empty states for demo or low-data accounts.
- No destructive actions are introduced on the dashboard.

## Suggested First Ticket

### Ticket: Redesign Admin Dashboard Into Owner Briefing

Update `src/pages/admin/DashboardPage.tsx` to introduce:

- `Today` header
- priority strip
- prominent upcoming events widget
- right rail with next best actions and widget controls
- lower performance snapshot

Reuse existing `useDashboardStats`, `useDashboardPreferences`, and `useUpdateDashboardPreferences` hooks where possible.

### Suggested Second Ticket

### Ticket: Add Owner Action Data to Dashboard Stats

Extend `src/hooks/useAdmin.ts` so `useDashboardStats` returns:

- low-fill events
- staff assignment gaps
- private request counts
- payroll/pay queue status
- recent activity
- computed next best actions

### Suggested Third Ticket

### Ticket: Improve Dashboard Widget Customizer

Replace the current large toggle chip area with a cleaner `Customize widgets` panel or drawer:

- grouped widget categories
- enabled/disabled toggles
- drag reorder
- reset default
- save/cancel

## Design Direction

Use a calm, dense SaaS operations style:

- restrained orange accent
- dark compact sidebar
- white cards on light gray background
- 8px card radius
- status chips for urgency
- progress bars for fill rate
- clear action buttons
- no oversized hero sections
- no decorative gradients or marketing imagery

The dashboard should feel like a morning briefing, not an analytics wall.
