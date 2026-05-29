import { Link } from 'react-router-dom';
import { ArrowRight, Calendar, ClipboardList, Gift, LogOut, Mail, Settings, ShoppingBag, Ticket, UserCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import SEO from '../../components/SEO';
import { SmsPreferencesWidget } from '../../components/public/SmsPreferencesWidget';
import { useCustomerAuth } from '../../hooks/useCustomerAuth';
import { useCustomerAccount } from '../../hooks/useCustomerAccount';
import { useMembershipCredits } from '../../hooks/useMembershipCredits';
import { formatCurrency, formatDate, formatDateTime } from '../../lib/utils';
import type { Order } from '../../types/database';

function StatCard({ icon: Icon, label, value, subtext }: { icon: typeof Calendar; label: string; value: string; subtext: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-secondary/10 text-secondary">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-3 text-sm text-slate-500">{subtext}</p>
    </div>
  );
}

function EmptyState({ title, body, actionLabel, actionTo }: { title: string; body: string; actionLabel?: string; actionTo?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
      <p className="font-semibold text-slate-800">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{body}</p>
      {actionLabel && actionTo && (
        <Link to={actionTo} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-secondary hover:text-secondary/80">
          {actionLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

function EventOrderCard({ order }: { order: Order }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize text-slate-600">{order.status}</span>
            <span className="text-xs font-medium text-slate-500">Order #{order.id.slice(0, 8)}</span>
          </div>
          <h3 className="mt-3 font-serif text-xl font-bold text-slate-950">{order.event?.title || 'Workshop order'}</h3>
          <p className="mt-1 text-sm text-slate-600">
            {order.event?.start_datetime ? formatDateTime(order.event.start_datetime) : formatDate(order.created_at)}
          </p>
          {order.event?.venue?.name && (
            <p className="mt-1 text-sm text-slate-500">{order.event.venue.name}</p>
          )}
        </div>
        <div className="text-left sm:text-right">
          <p className="text-sm text-slate-500">{order.total_seats} seat{order.total_seats === 1 ? '' : 's'}</p>
          <p className="mt-1 text-lg font-bold text-slate-950">{formatCurrency(order.total_amount)}</p>
        </div>
      </div>
      {order.attendees && order.attendees.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Attendees</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {order.attendees.map((attendee) => (
              <span key={attendee.id} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
                {attendee.full_name}
              </span>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

export default function AccountPage() {
  const { customer, logout } = useCustomerAuth();
  const { data, isLoading, error } = useCustomerAccount(customer?.email);
  const membership = useMembershipCredits(customer?.email);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-50 py-16">
        <div className="mx-auto max-w-3xl px-5">
          <div className="rounded-lg border border-red-200 bg-white p-6 text-red-700 shadow-sm">
            We could not load this account yet. The customer tables or row permissions may need to be updated for the portal.
          </div>
        </div>
      </div>
    );
  }

  const account = data!;
  const firstName = customer?.name?.split(' ')[0] || customer?.email.split('@')[0] || 'there';

  return (
    <div className="bg-slate-50 py-10 md:py-14">
      <SEO title="My Account" description="View your Paint & Sip bookings, gift cards, orders, and private event requests." />
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <header className="mb-8 flex flex-col gap-5 rounded-lg border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-secondary/10 px-3 py-1 text-sm font-semibold text-secondary">
              <UserCircle className="h-4 w-4" />
              Customer account
            </div>
            <h1 className="font-serif text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">Welcome back, {firstName}</h1>
            <p className="mt-2 flex items-center gap-2 text-sm text-slate-600">
              <Mail className="h-4 w-4" />
              {customer?.email}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/events" className="inline-flex items-center justify-center rounded-lg bg-secondary px-4 py-2 font-medium text-white transition hover:bg-secondary/90">
              Book a workshop
            </Link>
            <Button variant="outline" className="gap-2" onClick={logout}>
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Calendar} label="Upcoming seats" value={String(account.totals.upcomingSeats)} subtext={`${account.upcomingOrders.length} upcoming booking${account.upcomingOrders.length === 1 ? '' : 's'}`} />
          <StatCard icon={Ticket} label="Event orders" value={String(account.orders.length)} subtext={`${account.pastOrders.length} past order${account.pastOrders.length === 1 ? '' : 's'} on file`} />
          <StatCard icon={Gift} label="Gift cards" value={formatCurrency(account.totals.availableGiftCardValue)} subtext={`${account.giftCards.length} card${account.giftCards.length === 1 ? '' : 's'} connected`} />
          <StatCard icon={ShoppingBag} label="Lifetime spend" value={formatCurrency(account.totals.lifetimeSpend)} subtext="Across events and shop orders" />
        </section>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.35fr_0.85fr]">
          <section className="space-y-8">
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-secondary/10 px-3 py-1 text-sm font-semibold text-secondary">
                    <Ticket className="h-4 w-4" />
                    Membership
                  </div>
                  <h2 className="font-serif text-2xl font-bold text-slate-950">{membership.plan?.name || 'Creative Duo'}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Use credits toward eligible public workshops at checkout. Credits are shown before payment so customers always know what will be applied.
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-4 md:min-w-48">
                  <p className="text-sm font-medium text-slate-500">Available credits</p>
                  <p className="mt-1 text-3xl font-bold text-slate-950">{membership.availableCredits}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {membership.plan?.creditsPerCycle || 2} monthly · renews {membership.plan ? formatDate(membership.plan.renewalDate) : 'monthly'}
                  </p>
                  <p className="mt-2 text-xs font-medium text-slate-400">
                    {membership.source === 'backend' ? 'Synced ledger' : 'Demo ledger'}
                  </p>
                </div>
              </div>
              {membership.redemptions.length > 0 && (
                <div className="mt-5 border-t border-slate-100 pt-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Recent credit use</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {membership.redemptions.slice(0, 4).map((redemption) => (
                      <div key={redemption.id} className="rounded-lg bg-slate-50 p-3">
                        <p className="font-semibold text-slate-900">
                          {redemption.creditsUsed} credit{redemption.creditsUsed === 1 ? '' : 's'} used
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {formatDate(redemption.redeemedAt)} · {formatCurrency(redemption.amountCovered)} covered
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className="mb-4 flex items-center justify-between gap-4">
                <h2 className="font-serif text-2xl font-bold text-slate-950">Upcoming Events</h2>
                <Link to="/events" className="text-sm font-semibold text-secondary hover:text-secondary/80">Browse events</Link>
              </div>
              <div className="space-y-4">
                {account.upcomingOrders.length > 0 ? (
                  account.upcomingOrders.map((order) => <EventOrderCard key={order.id} order={order} />)
                ) : (
                  <EmptyState title="No upcoming events yet" body="When you reserve seats, your event details and attendee names will appear here." actionLabel="Find a workshop" actionTo="/events" />
                )}
              </div>
            </div>

            <div>
              <h2 className="mb-4 font-serif text-2xl font-bold text-slate-950">Recent Event Orders</h2>
              <div className="space-y-4">
                {account.orders.length > 0 ? (
                  account.orders.slice(0, 5).map((order) => <EventOrderCard key={order.id} order={order} />)
                ) : (
                  <EmptyState title="No event orders found" body="Use the email address from checkout so we can connect your purchase history." />
                )}
              </div>
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 font-serif text-xl font-bold text-slate-950">
                <Gift className="h-5 w-5 text-secondary" />
                Gift Cards
              </h2>
              <div className="mt-4 space-y-3">
                {account.giftCards.length > 0 ? account.giftCards.slice(0, 4).map((card) => (
                  <div key={card.id} className="rounded-lg bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{formatCurrency(card.amount)}</p>
                        <p className="mt-1 text-xs text-slate-500">{card.code}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${card.is_redeemed ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-700'}`}>
                        {card.is_redeemed ? 'Redeemed' : 'Available'}
                      </span>
                    </div>
                  </div>
                )) : (
                  <EmptyState title="No gift cards" body="Purchased and received gift cards will show here." actionLabel="Buy a gift card" actionTo="/gift-cards" />
                )}
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 font-serif text-xl font-bold text-slate-950">
                <ClipboardList className="h-5 w-5 text-secondary" />
                Requests & Waitlists
              </h2>
              <div className="mt-4 space-y-3">
                {account.privateRequests.slice(0, 3).map((request) => (
                  <div key={request.id} className="rounded-lg bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold capitalize text-slate-900">{request.event_type.replaceAll('_', ' ')}</p>
                        <p className="mt-1 text-sm text-slate-500">{formatDate(request.preferred_date)} · {request.guest_count} guests</p>
                      </div>
                      <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold capitalize text-slate-600">{request.status.replaceAll('_', ' ')}</span>
                    </div>
                  </div>
                ))}
                {account.waitlistEntries.slice(0, 3).map((entry) => (
                  <div key={entry.id} className="rounded-lg bg-slate-50 p-4">
                    <p className="font-semibold text-slate-900">{entry.event?.title || 'Waitlist spot'}</p>
                    <p className="mt-1 text-sm text-slate-500">{entry.seats_desired} seat{entry.seats_desired === 1 ? '' : 's'} requested</p>
                  </div>
                ))}
                {account.privateRequests.length === 0 && account.waitlistEntries.length === 0 && (
                  <EmptyState title="No open requests" body="Private event inquiries and waitlist spots will appear here." actionLabel="Plan a private event" actionTo="/private-events" />
                )}
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 font-serif text-xl font-bold text-slate-950">
                <Settings className="h-5 w-5 text-secondary" />
                Email Preferences
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Manage marketing, private event, and membership updates connected to this email address.
              </p>
              <Link
                to={`/unsubscribe?email=${encodeURIComponent(customer?.email || '')}`}
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-secondary hover:text-secondary/80"
              >
                Manage preferences
                <ArrowRight className="h-4 w-4" />
              </Link>
            </section>

            <SmsPreferencesWidget />

            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 font-serif text-xl font-bold text-slate-950">
                <ShoppingBag className="h-5 w-5 text-secondary" />
                Shop Orders
              </h2>
              <div className="mt-4 space-y-3">
                {account.productOrders.length > 0 ? account.productOrders.slice(0, 4).map((order) => (
                  <div key={order.id} className="rounded-lg bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{order.product?.name || 'Shop order'}</p>
                        <p className="mt-1 text-sm text-slate-500">Qty {order.quantity} · {formatDate(order.created_at)}</p>
                      </div>
                      <p className="font-bold text-slate-950">{formatCurrency(order.total_price)}</p>
                    </div>
                  </div>
                )) : (
                  <EmptyState title="No shop orders" body="Retail purchases will show tracking and status here." actionLabel="Visit the shop" actionTo="/shop" />
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
