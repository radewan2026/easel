# Easel Competitive Feedback Product PRD

## Summary

This PRD translates public customer feedback about FareHarbor into product improvements for Easel. FareHarbor is a strong, established booking platform for tours, activities, rentals, and attractions. Its customer feedback shows that operators value online booking, support, and operational coverage, but still struggle with visible booking fees, checkout friction, generic workflows, onboarding mistakes, reporting limitations, and weak marketing automation.

Easel should use this feedback to sharpen its position as the operating system for paint-and-sip studios, not just another booking tool.

## Strategic Positioning

FareHarbor is powerful horizontal experience booking software.

Easel should be the vertical paint-and-sip operating system:

- public event booking
- fast checkout
- private event pipeline
- painting/project gallery commerce
- event operations
- staff and prep workflows
- customer history
- gift cards
- simple shop/add-ons
- marketing automation
- owner-ready reporting

The core product promise should be:

> Easel helps paint-and-sip studios fill classes, convert private parties, run event nights, and bring guests back.

## Customer Feedback Signals

Public reviews and review summaries indicate recurring operator complaints in these areas:

- high or confusing customer-facing booking fees
- checkout friction, especially with add-ons or complex bookings
- reporting that is too limited, complicated, or not visual enough
- generic configuration complexity
- onboarding mistakes with pricing, calendar setup, or launch timing
- inconsistent support and unclear escalation
- payout/refund/offboarding confusion
- weak merchandise, inventory, and POS-adjacent support
- difficult multi-booking or group booking flows
- marketing/distribution promises that do not always translate into revenue

Sources reviewed:

- G2 FareHarbor reviews
- Capterra FareHarbor reviews
- Software Advice FareHarbor reviews
- Trustpilot FareHarbor reviews
- FareHarbor customer/provider/legal pricing terms

## Goals

- Improve Easel in the places where broad booking platforms create operator pain.
- Make Easel visibly more purpose-built for paint-and-sip studios.
- Increase conversion from booking page visit to paid seat.
- Increase private event conversion rate.
- Increase repeat bookings and lapsed-customer reactivation.
- Reduce implementation mistakes and time-to-launch risk.
- Give owners actionable reporting, not just data exports.

## Non-Goals

- Do not copy FareHarbor feature-for-feature.
- Do not build tour, rental, or attraction workflows unless they directly serve paint-and-sip or adjacent studio categories.
- Do not make Easel a generic OTA/channel manager.
- Do not overpromise marketplace demand generation before Easel can prove revenue attribution.
- Do not add complex settings when a studio-specific default would solve the problem.

## Target Users

### Primary

Independent paint-and-sip studio owner or general manager.

Needs:

- fill public classes
- respond to private party leads
- avoid manual admin work
- understand revenue and profitability
- coordinate instructors and prep
- follow up with past guests

### Secondary

Studio staff, instructor, or front desk worker.

Needs:

- see assigned events
- check in attendees
- view event notes
- understand setup requirements
- avoid touching sensitive business settings

## Product Principles

### 1. Transparent Economics

Owners should understand what they pay, what customers pay, and when money arrives.

### 2. Fast Booking First

The public checkout should be short, mobile-friendly, and resilient. Every extra field must justify itself.

### 3. Event Night Is The Center

The most important object is the event, not the calendar slot. Every event should connect roster, painting, instructor, supplies, revenue, messaging, waitlist, and post-event follow-up.

### 4. Paint-And-Sip Defaults Beat Generic Settings

The product should ship with opinionated flows for public classes, private parties, corporate events, fundraisers, offsite events, and gift-card-driven bookings.

### 5. Reports Should Recommend Action

Reports should answer what to do next, not only what happened.

## Requirements

## 1. Transparent Pricing And Guest Cost Clarity

### Problem

Customer-facing booking fees are a recurring source of negative sentiment for FareHarbor. Paint-and-sip guests are price-sensitive and may abandon checkout if the final total feels higher than advertised.

### Requirements

- Show owners a clear pricing settings page that separates:
  - seat price
  - taxes
  - processing fees
  - optional add-ons
  - customer total
  - owner net
- Add a `Preview guest checkout total` tool in event setup.
- Add a `Pricing transparency check` before publishing an event.
- Support owner-facing pricing recommendations:
  - all-in displayed price
  - tax-exclusive price where legally/operationally appropriate
  - add-ons clearly labeled as optional
- Avoid adding a default Easel customer booking fee without explicit pricing strategy approval.

### Acceptance Criteria

- Owner can preview the exact customer total before publishing.
- Event setup warns when public displayed price and checkout total differ materially.
- Checkout clearly labels optional add-ons and mandatory charges.
- Admin order detail shows owner net after fees.

## 2. Fast Mobile Checkout

### Problem

Reviewers complain about slow checkout, especially when add-ons or complex configurations are present. Paint-and-sip checkout should feel simpler than buying event tickets.

### Requirements

- Optimize checkout around the common path:
  - choose event
  - choose seat count
  - add purchaser info
  - pay
- Defer guest names until after purchase unless required.
- Support optional add-ons without making checkout feel heavy.
- Preserve cart across accidental refresh/navigation.
- Add abandoned checkout tracking.
- Add admin-visible checkout conversion metrics.

### Acceptance Criteria

- A guest can complete a simple booking in under one minute on mobile.
- Guest names can be collected after purchase.
- Add-ons do not require page reloads or long blocking waits.
- Abandoned checkout event is recorded with event, seat count, and email when available.

## 3. Group Booking And Shared Planning

### Problem

Generic booking platforms often struggle with group coordination. Paint-and-sip bookings are social: one person often organizes for friends, coworkers, birthdays, showers, or date nights.

### Requirements

- Support multi-seat booking with guest names optional.
- Add `Invite guests` link after purchase.
- Support per-guest notes where useful:
  - name
  - email
  - seating preference
  - accessibility note
  - add-on choice
- Consider future split-pay support.
- Allow one cart to include seats, gift cards, and eligible products.

### Acceptance Criteria

- Purchaser can reserve multiple seats without knowing every guest name.
- Confirmation page includes an invite/share action.
- Admin attendee roster distinguishes purchaser from guests.

## 4. Event Command Center

### Problem

Booking tools often help operators sell seats but do not fully help them run the event. Easel should own the event-night workflow.

### Requirements

Create or enhance an event detail operations view with:

- event date/time/venue
- painting/project image
- capacity and fill rate
- revenue and owner net
- attendee roster
- check-in status
- waitlist
- instructor assignment
- internal prep notes
- supply checklist
- customer messages
- refund/reschedule/cancel actions
- post-event follow-up status

### Acceptance Criteria

- Owner can answer `are we ready for this event?` from one screen.
- Instructor can view only the operational details they need.
- Owner can message attendees from the event view.
- Post-event review/referral follow-up can be triggered or viewed from the event.

## 5. Private Event CRM Pipeline

### Problem

Private events are high-value but often managed through email threads and memory. Broad booking systems may offer private event tools, but paint-and-sip needs a lead-to-deposit-to-event flow.

### Requirements

Pipeline stages:

- New Request
- Contacted
- Proposal Sent
- Deposit Requested
- Deposit Paid
- Scheduled
- Completed
- Lost

Fields:

- contact name
- email
- phone
- occasion
- preferred date
- backup date
- guest count
- budget range
- expected value
- deposit amount
- painting selection type
- selected painting or custom request
- assigned owner/staff
- next follow-up date
- internal notes
- source

Actions:

- draft response
- send proposal
- request deposit
- convert to event
- create invoice
- create corporate account
- mark lost with reason

### Acceptance Criteria

- Owner can see all private leads by stage.
- Every open lead can have a next follow-up date.
- A private request can become a scheduled event without retyping core details.
- Private conversion rate and expected pipeline value are reportable.

## 6. Marketing Automation Engine

### Problem

Review feedback shows operators want more than booking. They want revenue growth. FareHarbor has scale and distribution, but Easel can win with studio-owned marketing automation.

### Requirements

Initial automations:

- abandoned checkout recovery
- low-fill event promotion
- booking confirmation
- event reminder
- post-event review request
- referral prompt
- lapsed guest winback
- private event follow-up
- gift card redemption reminder
- birthday or occasion campaign

Automation requirements:

- owner can preview message before activation
- owner can pause/resume each automation
- messages use studio voice and merge tags
- revenue attribution is tracked where practical
- automations respect unsubscribe preferences

### Acceptance Criteria

- Owner can enable at least three default automations without custom setup.
- Each automation has a clear trigger, audience, message, and goal.
- Admin shows sent count, clicks/bookings where available, and attributed revenue where available.

## 7. Actionable Reporting

### Problem

Reviewers complain about complicated or insufficient reports. Easel should give owners reports that connect directly to decisions.

### Requirements

Reports should include:

- event profitability by date, time, venue, instructor, and painting
- seats sold by lead time
- low-fill event list
- private event conversion rate
- private pipeline value
- repeat customer rate
- lapsed customer list
- campaign revenue attribution
- gift card liability and redemption aging
- refund/cancellation reasons
- instructor utilization and payroll cost per event
- product/add-on sales by event

### Acceptance Criteria

- Reports include visual trend comparisons for weekly/monthly/quarterly periods.
- Each major report includes at least one recommended action.
- Owner can export raw data where appropriate.
- Dashboard surfaces the highest-priority report insights without requiring a reports deep dive.

## 8. Onboarding And Launch Guardrails

### Problem

Negative reviews mention setup delays, wrong pricing, broken calendar setup, rushed training, outdated tutorials, and revenue loss during launch.

### Requirements

Create an onboarding checklist:

- studio profile completed
- payment settings tested
- taxes/pricing checked
- first events imported or created
- checkout tested
- confirmation email tested
- public calendar previewed
- private request form tested
- gift cards configured if enabled
- admin roles created
- go-live approved

Add launch validation warnings:

- event has no price
- event has no capacity
- event has no public image
- event has missing venue
- payment provider not connected
- confirmation email disabled
- private request notification missing

### Acceptance Criteria

- Owner can see onboarding progress.
- Owner can preview public booking flow before go-live.
- System blocks or warns on severe launch issues.
- First-run empty states link to the next setup action.

## 9. Support And Trust Experience

### Problem

Review sentiment often turns negative when there is no clear escalation path for revenue-blocking issues.

### Requirements

- Add in-app support categories:
  - booking/checkout issue
  - payment/payout issue
  - live event issue
  - private event issue
  - import/onboarding issue
  - general question
- Add severity labels:
  - revenue blocker
  - time-sensitive
  - normal
- Add admin-visible support case status, even if manually managed at first.
- Add export/offboarding policy documentation.
- Add owner-accessible data export tools for customers, events, orders, attendees, gift cards, and private requests.

### Acceptance Criteria

- Owner can report a revenue blocker from inside admin.
- Support requests include linked page/object context.
- Owner can export critical business data.
- Help docs are linked from relevant empty/error states.

## 10. Products, Add-Ons, And Lightweight Inventory

### Problem

Operators want merchandise, add-ons, and POS-adjacent functionality without managing another system.

### Requirements

- Support products sold independently and as event add-ons.
- Track inventory counts where relevant.
- Support event-specific add-ons:
  - drinks/snacks
  - upgrade canvas size
  - take-home kit
  - party package extras
  - merchandise
- Show add-on sales on event detail.
- Warn when add-on inventory is insufficient for event capacity.

### Acceptance Criteria

- Owner can attach products/add-ons to an event.
- Checkout displays add-ons as optional.
- Event detail reports add-on units and revenue.
- Low inventory appears on dashboard/action feed.

## Priority Roadmap

### Phase 1: Conversion And Trust

- Transparent guest total preview
- Fast mobile checkout improvements
- onboarding/go-live checklist
- abandoned checkout tracking
- owner net and payout visibility

### Phase 2: Studio Operating Depth

- Event command center
- private event CRM pipeline
- group booking enhancements
- product/add-on inventory per event

### Phase 3: Revenue Growth

- marketing automation engine
- low-fill event campaigns
- post-event review/referral flows
- lapsed guest winback
- campaign attribution

### Phase 4: Advanced Reporting

- event profitability
- painting performance
- instructor/venue/day/time analytics
- private event conversion reports
- visual trend comparison

## Success Metrics

### Booking Conversion

- booking page to checkout start rate
- checkout start to paid booking rate
- average checkout completion time
- abandoned checkout recovery revenue

### Private Events

- private request to contacted rate
- private request to deposit rate
- private request to scheduled event rate
- average private event value
- overdue follow-up count

### Repeat Revenue

- repeat customer rate
- lapsed customer reactivation rate
- post-event review request conversion
- referral bookings
- gift card redemption rate

### Operations

- events with complete readiness checklist
- events missing staff within seven days
- low-fill events promoted
- average support resolution time for revenue blockers
- onboarding time to first live event

## Suggested First Tickets

### Ticket 1: Add Guest Total Preview To Event Setup

Add an admin preview that shows seat price, taxes, fees, add-ons, total guest cost, and estimated owner net before publishing an event.

### Ticket 2: Add Event Readiness Checklist

Add a readiness panel to event detail/editing that checks capacity, price, public image, venue, instructor, payment setup, and confirmation email status.

### Ticket 3: Add Private Event Pipeline Fields

Extend private event requests with next follow-up date, expected value, deposit amount, assigned owner, internal notes, and lost reason.

### Ticket 4: Add Abandoned Checkout Tracking

Record abandoned checkout events with event, seat count, purchaser email when available, and timestamp. Surface abandoned revenue opportunities in admin.

### Ticket 5: Add Low-Fill Event Promotion Recommendation

Detect events below a configurable fill threshold and suggest a promotion or email campaign from the dashboard and events page.

## Open Questions

- Should Easel pricing be monthly subscription only, subscription plus payment processing margin, or tiered by revenue/locations?
- Should split-pay be part of the first group booking release or deferred?
- Should support cases be built inside Easel now or routed to an external helpdesk first?
- Which automation channel launches first: email only, or email plus SMS?
- Should guest names be optional for all public events, or configurable by event type?

