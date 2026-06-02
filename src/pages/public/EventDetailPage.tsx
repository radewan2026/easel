import { useParams, Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useEvent, useEventImages } from '../../hooks/useEvents';
import { useIsAdmin } from '../../hooks/useAuth';
import { useProducts } from '../../hooks/useProducts';
import { useEventAddOns } from '../../hooks/useEventAddOns';
import { formatDateTime, formatCurrency } from '../../lib/utils';
import { generateGoogleCalendarUrl, downloadIcsFile } from '../../lib/calendar';
import { Calendar, MapPin, Users, Minus, Plus, ChevronLeft, Image, Edit, Bell, CalendarPlus, Download } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import WaitlistModal from '../../components/public/WaitlistModal';
import ShareButtons from '../../components/public/ShareButtons';
import SEO from '../../components/SEO';
import type { Event } from '../../types/database';

const MAX_RECENT = 5;

function addToRecentlyViewed(event: Event) {
  try {
    const stored = localStorage.getItem('recently_viewed_events');
    const recent: Event[] = stored ? JSON.parse(stored) as Event[] : [];
    const updated = [event, ...recent.filter((recentEvent) => recentEvent.id !== event.id)].slice(0, MAX_RECENT);
    localStorage.setItem('recently_viewed_events', JSON.stringify(updated));
  } catch {
    /* Unable to update recently viewed events */
  }
}

export default function EventDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data: event, isLoading, error } = useEvent(slug || '');
  const { isAdmin, loading: authLoading } = useIsAdmin();
  const { data: products = [] } = useProducts({ active: true });
  const { enabledAddOns } = useEventAddOns(slug || '', products);

  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [showWaitlist, setShowWaitlist] = useState(false);

  const { data: images } = useEventImages(event?.id || '');

  useEffect(() => {
    if (event) addToRecentlyViewed(event);
  }, [event]);

  if (isLoading || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <p className="text-lg mb-4" style={{ color: 'var(--text-muted)' }}>Event not found</p>
        <Link to="/events"><Button>Back to Events</Button></Link>
      </div>
    );
  }

  const pageUrl = `${window.location.origin}/events/${event.slug}`;

  const allImages = event.main_image_url ? [event.main_image_url, ...(images?.map(i => i.image_url) || [])] : (images?.map(i => i.image_url) || []);

  const handleQuantityChange = (delta: number) => {
    const newQuantity = quantity + delta;
    if (newQuantity >= 1 && newQuantity <= (event.seats_available ?? 0)) {
      setQuantity(newQuantity);
    }
  };

  const totalPrice = (event.base_price_per_seat || 0) * quantity;

  return (
    <div className="py-12" style={{ backgroundColor: 'var(--section-bg-white)' }}>
      <SEO
        title={event.title}
        description={event.description || `Join us for ${event.title} - a Paint & Sip event!`}
        image={event.main_image_url || undefined}
        url={pageUrl}
      />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Link
          to="/events"
          className="inline-flex items-center mb-6" style={{ color: 'var(--text-secondary)' }}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to Events
        </Link>
        {!authLoading && isAdmin && (
          <button
            onClick={() => navigate(`/admin/events/${event.id}`)}
            className="inline-flex items-center text-primary-600 hover:text-primary-700 mb-6 ml-4"
          >
            <Edit className="h-4 w-4 mr-1" />
            Edit this event
          </button>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="aspect-video bg-gray-200 rounded-xl overflow-hidden mb-4">
              {allImages[selectedImage] ? (
                <img
                  src={allImages[selectedImage]}
                  alt={event.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
                  <Image className="h-16 w-16" />
                </div>
              )}
            </div>

            {allImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {allImages.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(idx)}
                    className={`w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden border-2 ${
                      selectedImage === idx ? 'border-primary-500' : 'border-transparent'
                    }`}
                  >
                    <img
                      src={img}
                      alt={`${event.title} ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

            <h1 className="text-3xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>{event.title}</h1>

            <ShareButtons url={pageUrl} title={event.title} description={event.description || undefined} />

            <div className="flex flex-wrap gap-6 mb-6 mt-4" style={{ color: 'var(--text-secondary)' }}>
              <div className="flex items-center">
                <Calendar className="h-5 w-5 mr-2 text-primary-500" />
                {formatDateTime(event.start_datetime)}
              </div>
              {event.venue && (
                <div className="flex items-center">
                  <MapPin className="h-5 w-5 mr-2 text-primary-500" />
                  {event.venue.name}, {event.venue.city}, {event.venue.state}
                </div>
              )}
              <div className="flex items-center">
                <Users className="h-5 w-5 mr-2 text-primary-500" />
                {event.seats_available || 0} seats available
              </div>
            </div>

            <div className="prose max-w-none">
              <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>About This Event</h2>
              <div 
                className="[&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-3 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2 [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:mt-2 [&_ul]:mb-4 [&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:mt-2 [&_ol]:mb-4 [&_li]:mb-2 [&_p]:mb-3 [&_a]:text-primary-600 [&_a]:underline [&_table]:w-full [&_table]:border-collapse [&_table]:my-4 [&_th]:border [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_td]:border [&_td]:px-3 [&_td]:py-2"
                style={{ color: 'var(--text-secondary)' }}
                dangerouslySetInnerHTML={{ __html: event.description || '<p>Join us for a fun Paint & Sip event! No experience required. All materials provided.</p>' }}
              />
            </div>

            {event.venue && (
              <div className="mt-8">
                <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Venue</h2>
                <Card>
                  <CardContent>
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{event.venue.name}</p>
                    <p style={{ color: 'var(--text-secondary)' }}>
                      {event.venue.address_line1}
                      {event.venue.address_line2 && `, ${event.venue.address_line2}`}
                    </p>
                    <p style={{ color: 'var(--text-secondary)' }}>
                      {event.venue.city}, {event.venue.state} {event.venue.postal_code}
                    </p>
                    {event.venue.phone && (
                      <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>{event.venue.phone}</p>
                    )}
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        `${event.venue.address_line1}, ${event.venue.city}, ${event.venue.state} ${event.venue.postal_code}`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-600 hover:text-primary-700 mt-2 inline-block"
                    >
                      Get Directions →
                    </a>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardContent>
                <div className="mb-6">
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Price per seat</p>
                  <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
                    {event.base_price_per_seat
                      ? formatCurrency(event.base_price_per_seat)
                      : 'Free'}
                  </p>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                    Number of Seats
                  </label>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => handleQuantityChange(-1)}
                      disabled={quantity <= 1}
                      className="w-10 h-10 flex items-center justify-center border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="text-xl font-semibold w-8 text-center" style={{ color: 'var(--text-primary)' }}>{quantity}</span>
                    <button
                      onClick={() => handleQuantityChange(1)}
                      disabled={quantity >= (event.seats_available || 0)}
                      className="w-10 h-10 flex items-center justify-center border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="border-t pt-4 mb-6" style={{ borderColor: 'var(--border-color)' }}>
                  <div className="flex justify-between mb-2">
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {quantity} × {formatCurrency(event.base_price_per_seat || 0)}
                    </span>
                    <span style={{ color: 'var(--text-primary)' }}>{formatCurrency(totalPrice)}</span>
                  </div>
                  {enabledAddOns.length > 0 && (
                    <div className="mt-3 rounded-lg border p-3" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--section-bg-light)' }}>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Optional add-ons at checkout</p>
                      <div className="mt-2 space-y-1">
                        {enabledAddOns.map((addOn) => (
                          <div key={addOn.productId} className="flex justify-between gap-3 text-sm">
                            <span style={{ color: 'var(--text-muted)' }}>{addOn.name}</span>
                            <span style={{ color: 'var(--text-primary)' }}>{formatCurrency(addOn.price)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {event.seats_available && event.seats_available > 0 ? (
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={() =>
                      navigate(`/checkout/${event.slug}?quantity=${quantity}`)
                    }
                  >
                    Book Seats
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    size="lg"
                    variant="outline"
                    onClick={() => setShowWaitlist(true)}
                  >
                    <Bell className="h-4 w-4 mr-2" />
                    Join Waitlist
                  </Button>
                )}

                <div className="mt-4 space-y-2">
                  <a
                    href={generateGoogleCalendarUrl(event)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full px-4 py-2 text-sm border rounded-lg transition-colors"
                    style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  >
                    <CalendarPlus className="h-4 w-4" />
                    Add to Google Calendar
                  </a>
                  <button
                    onClick={() => downloadIcsFile(event)}
                    className="flex items-center justify-center gap-2 w-full px-4 py-2 text-sm border rounded-lg transition-colors"
                    style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  >
                    <Download className="h-4 w-4" />
                    Download .ics (Outlook/Apple)
                  </button>
                </div>

                <p className="text-sm text-center mt-4" style={{ color: 'var(--text-muted)' }}>
                  You won't be charged until you complete the booking.
                </p>
              </CardContent>
            </Card>
         </div>
       </div>

      <WaitlistModal
        isOpen={showWaitlist}
        onClose={() => setShowWaitlist(false)}
        eventId={event.id}
        eventName={event.title}
      />
    </div>
    </div>
  );
}
