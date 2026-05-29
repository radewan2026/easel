import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { CheckCircle, CalendarPlus, Download, MapPin } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { formatDateTime, formatCurrency } from '../../lib/utils';
import { generateGoogleCalendarUrl, downloadIcsFile, type CalendarEventInput } from '../../lib/calendar';
import { trackAnalyticsEvent } from '../../lib/analytics';
import SEO from '../../components/SEO';
import EventInvitePanel from '../../components/public/EventInvitePanel';

interface StoredOrder {
  checkoutType: 'event' | 'product';
  event?: {
    title: string;
    slug: string;
    start_datetime: string;
    end_datetime: string | null;
    venue: { name: string; city: string; state: string } | null;
    main_image_url: string | null;
    base_price_per_seat: number | null;
  };
  purchaserName: string;
  purchaserEmail: string;
  totalSeats?: number;
  totalAmount: number;
  subtotal?: number;
  addOnSubtotal?: number;
  addOns?: Array<{ productId: string; name: string; quantity: number; total: number }>;
  items?: Array<{ name: string; quantity: number; total: number }>;
  discountAmount: number;
  membershipCreditsUsed?: number;
  membershipCreditDiscount?: number;
  promoCode?: string | null;
  promoDiscount?: number;
  giftCardCode?: string | null;
  giftCardDiscount?: number;
  orderId: string;
}

export default function CheckoutSuccessPage() {
  const [order] = useState<StoredOrder | null>(() => {
    try {
      const stored = localStorage.getItem('checkout_success');
      return stored ? JSON.parse(stored) as StoredOrder : null;
    } catch {
      return null;
    }
  });

  const calendarEvent: CalendarEventInput | null = order?.checkoutType === 'event' && order.event ? {
    title: order.event.title,
    start_datetime: order.event.start_datetime,
    end_datetime: order.event.end_datetime,
    venue: order.event.venue,
    description: `Order ID: ${order.orderId}\nSeats: ${order.totalSeats}\nConfirmation sent to: ${order.purchaserEmail}`,
  } : null;

  useEffect(() => {
    void trackAnalyticsEvent({
      eventName: 'checkout_success_view',
      userType: 'customer',
      userEmail: order?.purchaserEmail,
      properties: {
        checkoutType: order?.checkoutType || 'unknown',
        hasOrder: Boolean(order),
        orderId: order?.orderId || null,
        eventSlug: order?.event?.slug || null,
        eventTitle: order?.event?.title || null,
        seats: order?.totalSeats ?? null,
        total: order?.totalAmount ?? null,
        discount: order?.discountAmount ?? null,
      },
    });
  }, [order]);

  return (
    <div className="py-12" style={{ backgroundColor: 'var(--section-bg-white)' }}>
      <SEO title="Booking Confirmed!" description="Your Paint & Sip event booking is confirmed." />
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <Card className="text-center">
          <CardContent className="pt-12 pb-8">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Booking Confirmed!</h1>
            <p className="text-gray-600 mb-6">
              {order ? (
                <>
                  Thank you for your booking{order.purchaserName ? `, ${order.purchaserName}` : ''}! We've sent a confirmation email with all the details.
                  We can't wait to see you at the event!
                </>
              ) : (
                'Your confirmation page loaded, but this browser does not have the local order summary saved. You can still browse upcoming events or return home.'
              )}
            </p>

            {order && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-left mb-6">
                <h2 className="font-semibold text-gray-900 mb-4 text-center">Order Summary</h2>
                <div className="space-y-3 text-sm">
                  {order.checkoutType === 'event' && order.event ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Event</span>
                        <span className="font-medium text-gray-900 text-right max-w-[60%]">{order.event.title}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Date</span>
                        <span className="text-gray-900">{formatDateTime(order.event.start_datetime)}</span>
                      </div>
                      {order.event.venue && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Venue</span>
                          <span className="text-gray-900 flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {order.event.venue.name}, {order.event.venue.city}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-500">Seats</span>
                        <span className="text-gray-900">{order.totalSeats}</span>
                      </div>
                      {order.addOns && order.addOns.length > 0 && (
                        <div className="border-t border-gray-200 pt-3 mt-3">
                          <div className="flex justify-between font-medium text-gray-700 mb-2">
                            <span>Add-ons</span>
                          </div>
                          {order.addOns.map((addOn) => (
                            <div key={addOn.productId} className="flex justify-between text-sm">
                              <span className="text-gray-500">{addOn.quantity} × {addOn.name}</span>
                              <span className="text-gray-900">{formatCurrency(addOn.total)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : order.items && order.items.length > 0 ? (
                    <>
                      {order.items.map((item, i) => (
                        <div key={i} className="flex justify-between">
                          <span className="text-gray-500">{item.quantity} × {item.name}</span>
                          <span className="text-gray-900">{formatCurrency(item.total)}</span>
                        </div>
                      ))}
                    </>
                  ) : null}
                  {order.subtotal !== undefined && (
                    <div className="flex justify-between pt-3">
                      <span className="text-gray-500">Subtotal</span>
                      <span className="text-gray-900">{formatCurrency(order.subtotal)}</span>
                    </div>
                  )}
                  {order.membershipCreditDiscount && order.membershipCreditDiscount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Membership credits{order.membershipCreditsUsed ? ` (${order.membershipCreditsUsed})` : ''}</span>
                      <span>-{formatCurrency(order.membershipCreditDiscount)}</span>
                    </div>
                  )}
                  {order.promoDiscount && order.promoDiscount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Promo{order.promoCode ? ` (${order.promoCode})` : ''}</span>
                      <span>-{formatCurrency(order.promoDiscount)}</span>
                    </div>
                  )}
                  {order.giftCardDiscount && order.giftCardDiscount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Gift card{order.giftCardCode ? ` (${order.giftCardCode})` : ''}</span>
                      <span>-{formatCurrency(order.giftCardDiscount)}</span>
                    </div>
                  )}
                  {order.discountAmount > 0 && (
                    <div className="flex justify-between text-green-600 font-medium">
                      <span>Total Discount</span>
                      <span>-{formatCurrency(order.discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold text-gray-900 border-t border-gray-200 pt-3">
                    <span>Total Paid</span>
                    <span>{formatCurrency(order.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Confirmation Email</span>
                    <span className="text-gray-900">{order.purchaserEmail}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Order ID</span>
                    <span className="font-mono text-xs text-gray-500">{order.orderId.slice(0, 8)}</span>
                  </div>
                </div>
              </div>
            )}

            {order && order.checkoutType === 'event' && order.totalSeats && order.totalSeats > 1 && (
              <div className="mb-6">
                <EventInvitePanel
                  eventTitle={order.event.title}
                  eventSlug={order.event.slug}
                  purchaserEmail={order.purchaserEmail}
                  orderId={order.orderId}
                  totalSeats={order.totalSeats}
                />
              </div>
            )}

            {order && order.checkoutType === 'event' && calendarEvent && (
              <div className="border-t border-gray-200 pt-4 mb-6">
                <p className="text-sm font-medium text-gray-700 mb-3">Add to Calendar</p>
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={generateGoogleCalendarUrl(calendarEvent)}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-analytics-event="calendar_add_click"
                    data-analytics-label="Google Calendar"
                    className="flex items-center justify-center gap-2 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-700"
                  >
                    <CalendarPlus className="h-4 w-4" />
                    Google Calendar
                  </a>
                  <button
                    onClick={() => downloadIcsFile(calendarEvent)}
                    data-analytics-event="calendar_add_click"
                    data-analytics-label="Outlook / Apple"
                    className="flex items-center justify-center gap-2 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-700"
                  >
                    <Download className="h-4 w-4" />
                    Outlook / Apple
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {order?.checkoutType === 'event' ? (
                <Link to="/events">
                  <Button className="w-full">Browse More Events</Button>
                </Link>
              ) : (
                <Link to="/shop">
                  <Button className="w-full">Continue Shopping</Button>
                </Link>
              )}
              <Link to="/">
                <Button variant="outline" className="w-full">Back to Home</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
