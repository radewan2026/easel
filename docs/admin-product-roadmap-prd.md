# Easel Admin Product Roadmap PRD

## Summary

Easel already has broad admin coverage for events, sales, customers, shop, staff, payroll, content, settings, and reports. The next product leap is to connect those modules into a guided operating system for paint-and-sip studio owners.

This PRD covers product gaps and feature opportunities across the full admin, beyond the owner dashboard redesign in `docs/owner-dashboard-prd.md`.

## Product Principle

The admin should help owners run the studio, not just manage records.

Every major page should answer:

- What is happening?
- What needs attention?
- What should I do next?
- Can I take that action safely from here?

## Goals

- Make Easel feel like one connected studio operating system.
- Turn raw tables into workflows.
- Help owners increase event fill rate, private event conversion, repeat purchases, and operational confidence.
- Standardize UX patterns across admin pages.
- Add guardrails around high-impact actions.

## Non-Goals

- Do not rebuild every page at once.
- Do not introduce external marketing sends or financial actions without explicit user confirmation flows.
- Do not hide advanced features; organize them behind clearer workflows.
- Do not replace existing reports, staff, shop, or customer pages unless a focused redesign is approved.

## Current Product Areas

The repo currently includes admin areas for:

- Dashboard
- Events
- Venues
- Galleries
- Assignments
- Private Requests
- Sales
- Attendees
- Coupons
- Gift Cards
- Reports
- Corporate Invoices
- Products
- Product Orders
- Customers
- Corporate Accounts
- Waitlist
- Testimonials
- Newsletter
- FAQs
- Blog
- Employees
- Time Clock
- Time Tracking
- Payroll
- Pay Queue
- Settings
- Activity Log
- Bulk Email
- Referrals
- Chat

## Major Gaps

### 1. Owner Action Feed

#### Problem

Important operational events are spread across pages. Owners need one stream of what changed and what needs attention.

#### Requirements

Create a unified action/activity feed that can include:

- new order
- new private event request
- low-fill event
- event missing staff
- gift card purchased
- gift card redeemed
- low product inventory
- pay queue item ready
- employee clocked in/out
- customer joined waitlist
- testimonial submitted
- payment setup warning

#### UX

Show this feed in:

- dashboard right rail
- optional activity page enhancement
- future assistant context

Each item should include:

- type
- timestamp
- plain-English summary
- linked object
- recommended action when applicable

### 2. Event Fill Engine

#### Problem

Events are central to revenue, but event management currently behaves mostly like a record table. Owners need help deciding which events need promotion, staffing, duplication, or follow-up.

#### Requirements

Add event health signals:

- fill rate
- days until event
- revenue booked
- staff assigned/missing
- venue assigned/missing
- low inventory/capacity issue
- waitlist count

Add event statuses:

- Healthy
- Needs Promotion
- Needs Staff
- Almost Sold Out
- At Risk
- Complete

Add recommended actions:

- Promote event
- Duplicate event
- Assign staff
- View attendees
- Email attendees
- Convert waitlist
- Review performance

#### UX

On Events page:

- add health/status column
- add saved filters such as `Needs Promotion`, `Missing Staff`, `This Week`
- add row-level next action

On Event Detail page:

- add event readiness checklist
- add sales/fill snapshot
- add post-event performance panel

### 3. Private Event CRM Pipeline

#### Problem

Private event requests are high-value leads, but the current page is mostly a status summary/list. The workflow should behave like a small sales CRM.

#### Requirements

Support pipeline statuses:

- Submitted
- Contacted
- Proposal Sent
- Confirmed
- Converted
- Declined

Add fields:

- estimated value
- next follow-up date
- assigned owner/staff
- internal notes
- event type
- requested date
- group size
- company name
- source

Add actions:

- mark contacted
- set follow-up
- convert to event
- convert to corporate invoice
- create corporate account
- draft response
- decline with reason

#### UX

Add a pipeline/kanban view plus table view.

Default empty state should explain:

- where public requests come from
- how to test the public form
- how a request becomes an event or invoice

### 4. Customer Segments and CRM Actions

#### Problem

The customer directory has useful data but does not yet guide owners toward meaningful customer actions.

#### Requirements

Add saved segments:

- high-value customers
- repeat customers
- lapsed customers
- gift card holders
- waitlist customers
- shop-only customers
- event attendees
- private event leads
- newsletter subscribers
- corporate contacts

Each segment should support:

- view customers
- export
- create coupon for segment
- draft email campaign
- view revenue contribution

Customer profile should include:

- orders
- attended events
- shop orders
- gift cards
- private requests
- notes
- tags
- last interaction
- lifetime value

### 5. Unified Marketing Center

#### Problem

Marketing features are spread across coupons, newsletter, testimonials, referrals, blog, and bulk email.

#### Requirements

Create a `Marketing` section that groups:

- campaigns
- customer segments
- coupons
- newsletter subscribers
- bulk email
- referrals
- testimonials
- blog/content prompts

Initial version can be navigation and workflow consolidation, not a full campaign engine.

#### Campaign Ideas

- promote low-fill event
- re-engage lapsed customers
- gift card holder reminder
- post-event thank you
- testimonial request
- birthday/private party follow-up

### 6. Staff Readiness and Payroll Flow

#### Problem

Staff features exist, but the workflow across employees, time tracking, payroll, and pay queue needs clearer operational states.

#### Requirements

Define consistent statuses:

- Clocked In
- Complete
- Needs Review
- Approved
- Queued for Pay
- Paid

Add alerts:

- event missing instructor
- time entry missing rate
- unapproved time entry
- employee not connected to Stripe
- payroll ready

Improve pages:

- Employees: show role, access, rate, Stripe state, upcoming assignments.
- Time Tracking: show earned amount consistently when possible.
- Payroll: explain why entries are included/excluded.
- Pay Queue: make approval/payment state explicit.

### 7. Guardrails and Activity Logging

#### Problem

Admin actions can affect payments, records, events, staff, or public site state. Owners need confidence and traceability.

#### Requirements

Add confirmation and reason capture for:

- refund order
- delete event
- delete product
- delete customer/staff record
- change payment settings
- change employee admin access
- mark payroll paid
- cancel/private request decline

Every high-impact action should write to the activity log.

Where possible, add:

- undo
- soft delete
- restore from trash
- before/after state in activity log

### 8. Setup and Onboarding Checklist

#### Problem

New studios need guidance before the system feels complete.

#### Requirements

Add setup checklist:

- configure site settings
- connect Stripe/payment methods
- create first venue
- create first event
- upload gallery/painting images
- add staff
- test checkout
- create first gift card
- configure email/social links

Show until complete on dashboard.

Each item should link directly to the relevant page.

### 9. Page-Aware Admin Assistant

#### Problem

The current admin assistant is visible, but it should become context-aware and useful within each workflow.

#### Requirements

Assistant should understand current page context:

- Events: identify low-fill or missing-staff events
- Sales: summarize orders and refunds
- Customers: suggest segments
- Reports: explain trends
- Payroll: summarize what is ready
- Settings: explain setup status

Initial assistant actions should draft or suggest, not automatically send/change data.

Examples:

- “Which events need promotion?”
- “Find gift card holders who have not booked.”
- “Summarize this week’s revenue.”
- “Draft a follow-up for this private request.”

### 10. Admin UI System Cleanup

#### Problem

The admin is feature-rich, but patterns should become more consistent and modern.

#### Requirements

Standardize:

- page headers
- primary actions
- filters
- saved views
- table density
- sticky actions
- status chips
- empty states
- loading states
- confirmation dialogs
- detail drawers
- pagination

#### Table Requirements

For dense tables:

- sticky right action column
- column visibility menu
- compact/comfortable density toggle
- saved filters
- clear row hover state
- better responsive fallback
- consistent row actions

## Priority Roadmap

### P0

- Owner Action Feed
- Event Fill Engine
- Private Event Pipeline
- Dashboard owner briefing
- Critical action confirmations
- Table UX cleanup for Events, Sales, Customers

### P1

- Customer Segments
- Marketing Center
- Staff/payroll state cleanup
- Setup checklist
- Reports insight cards

### P2

- Page-aware assistant actions
- Saved dashboard layouts
- Campaign workflow builder
- Advanced customer profile timeline
- Deeper revenue forecasting

## Suggested Tickets

### Ticket 1: Add Unified Owner Action Feed

Create computed action feed data for dashboard and activity contexts.

Acceptance criteria:

- Feed includes recent orders, private requests, low-fill events, staff gaps, and inventory warnings.
- Each item links to the relevant admin page.
- Feed supports empty state.
- No write actions are triggered from the feed.

### Ticket 2: Add Event Health Status

Add event health computation and display on Events page.

Acceptance criteria:

- Events show health badge.
- Fill rate and days-until-event influence health.
- Missing staff/venue can trigger warning state.
- Events can be filtered by health state.

### Ticket 3: Redesign Private Requests as Pipeline

Add kanban-style pipeline view for private event requests.

Acceptance criteria:

- Requests grouped by status.
- Owner can switch between pipeline and table.
- Empty state explains public request flow.
- Detail view includes notes, follow-up date, and conversion CTAs.

### Ticket 4: Add Customer Segments

Add saved segment filters to Customers page.

Acceptance criteria:

- Segment tabs or dropdown available.
- At least five segments are implemented.
- Segment results can be exported.
- Segment definitions are documented in code.

### Ticket 5: Improve Critical Action Confirmations

Standardize confirmation dialogs for high-impact actions.

Acceptance criteria:

- Refund/delete/payment/admin-access/payroll actions require confirmation.
- Confirmation copy explains impact.
- Reason capture is supported where relevant.
- Activity log entry is written after success.

### Ticket 6: Staff Payroll State Cleanup

Clarify status flow from time entry to pay queue.

Acceptance criteria:

- Time entries show rate and earned amount when available.
- Payroll explains included/excluded entries.
- Pay queue states are explicit.
- Stripe connection issues are surfaced as actionable warnings.

## Success Metrics

- Owner can identify next action within 10 seconds of opening admin.
- Fewer clicks to find low-fill events and staff gaps.
- Increased private event conversion rate.
- Increased use of customer segments/export/campaign flows.
- Fewer support questions about payroll and payments.
- Higher perceived product polish during demos.

## Implementation Guidance

Start by improving the highest-traffic workflows:

1. Dashboard
2. Events
3. Private Requests
4. Customers
5. Sales
6. Staff/Payroll

Prefer incremental changes that reuse existing hooks, tables, and UI primitives. Add new data fields only when a workflow truly needs them.

## Implementation Status

The local prototype branch now implements the feasible app-layer portions of this PRD:

- Owner briefing dashboard with custom date ranges, priority cards, action feed, setup checklist, and optional widgets.
- Event health engine with saved views, fill bars, staffing state, and deep links into assignment actions.
- Private request pipeline with CRM metadata stored in `settings` until first-class columns are added.
- Customer saved segments and segment export/draft-campaign affordances.
- Marketing Center page with campaign ideas and outreach signals.
- Shared Owner Action Feed used by dashboard, activity log, marketing, and assistant.
- Reason-capture guardrails for event delete, private request decline, time-entry delete, and payroll actions.
- Page-aware admin assistant with context prompts and workflow navigation.
- Staff readiness cards on Employees.
- Reports insight cards.
- Time Tracking summary cards for active entries, completed entries, and estimated earned amount.

Remaining production-complete work requires schema/API support:

- Add first-class private request fields: `estimated_value`, `next_follow_up_date`, `assigned_owner_id`, `proposal_status`, `source`, and `decline_reason`.
- Add activity-log before/after diffs for all high-impact actions.
- Add true campaign records, send drafts, audiences, and send approvals.
- Add complete table system support for column visibility, saved filters, and sticky action columns across every admin table.
- Add payment/email provider verification checks instead of shallow settings/status inference.
- Add assistant action APIs for safe draft generation without automatic sends or payments.
