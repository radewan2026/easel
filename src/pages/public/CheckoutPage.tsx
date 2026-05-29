import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useCart } from '../../hooks/useCart';
import { useCreateProductOrder, useProducts } from '../../hooks/useProducts';
import { useEvent } from '../../hooks/useEvents';
import { useCreateOrder } from '../../hooks/useEvents';
import { useRedeemGiftCard } from '../../hooks/useGiftCards';
import { useValidateCoupon } from '../../hooks/useEvents';
import { useCustomerAuth } from '../../hooks/useCustomerAuth';
import { useMembershipCredits } from '../../hooks/useMembershipCredits';
import { useEventAddOns } from '../../hooks/useEventAddOns';
import { logActivity } from '../../lib/activityLog';
import { getAttributionContext, trackAnalyticsEvent } from '../../lib/analytics';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { ArrowLeft, ShoppingBag, Check, Calendar, MapPin, Minus, Plus, Ticket, CreditCard, Tag, Gift } from 'lucide-react';
import SEO from '../../components/SEO';
import EventInvitePanel from '../../components/public/EventInvitePanel';
import { useToast } from '../../components/ui/Toast';

type CheckoutAttendee = { fullName: string; email: string; notes: string };
type EventCheckoutDraft = {
  quantity: number;
  purchaserName: string;
  purchaserEmail: string;
  purchaserPhone: string;
  useMembershipCredit: boolean;
  collectAttendeeDetails: boolean;
  attendees: CheckoutAttendee[];
  selectedAddOns: Record<string, number>;
};
type CompletedEventOrder = {
  purchaserName: string;
  purchaserEmail: string;
  totalAmount: number;
  creditsUsed: number;
  status: 'paid' | 'pending';
  seats: number;
};

const EVENT_CHECKOUT_DRAFT_PREFIX = 'easel_event_checkout_draft';

function emptyAttendees(count: number) {
  return Array.from({ length: Math.max(count, 1) }, () => ({ fullName: '', email: '', notes: '' }));
}

function draftKey(slug: string) {
  return `${EVENT_CHECKOUT_DRAFT_PREFIX}:${slug}`;
}

function readEventCheckoutDraft(slug: string): EventCheckoutDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(draftKey(slug));
    return raw ? JSON.parse(raw) as EventCheckoutDraft : null;
  } catch {
    return null;
  }
}

function writeEventCheckoutDraft(slug: string, draft: EventCheckoutDraft) {
  localStorage.setItem(draftKey(slug), JSON.stringify(draft));
}

function removeEventCheckoutDraft(slug: string) {
  localStorage.removeItem(draftKey(slug));
}

export default function CheckoutPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();

  const isEventCheckout = !!slug;
  const quantityParam = parseInt(searchParams.get('quantity') || '1', 10);

  if (isEventCheckout) {
    return <EventCheckout key={slug} slug={slug} initialQuantity={quantityParam} />;
  }

  return <ProductCheckout />;
}

function EventCheckout({ slug, initialQuantity }: { slug: string; initialQuantity: number }) {
  const navigate = useNavigate();
  const { data: event, isLoading } = useEvent(slug);
  const createOrder = useCreateOrder();
  const createProductOrder = useCreateProductOrder();
  const { customer } = useCustomerAuth();
  const membership = useMembershipCredits(customer?.email);
  const redeemGiftCard = useRedeemGiftCard();
  const { showToast } = useToast();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const { data: products = [] } = useProducts({ active: true });
  const { enabledAddOns } = useEventAddOns(slug, products);

  const [savedDraft] = useState<EventCheckoutDraft | null>(() => readEventCheckoutDraft(slug));
  const [quantity, setQuantity] = useState(savedDraft?.quantity || initialQuantity);
  const [purchaserName, setPurchaserName] = useState(savedDraft?.purchaserName || '');
  const [purchaserEmail, setPurchaserEmail] = useState(savedDraft?.purchaserEmail || '');
  const [purchaserPhone, setPurchaserPhone] = useState(savedDraft?.purchaserPhone || '');
  const [useMembershipCredit, setUseMembershipCredit] = useState(savedDraft?.useMembershipCredit || false);
  const [collectAttendeeDetails, setCollectAttendeeDetails] = useState(savedDraft?.collectAttendeeDetails || false);
  const [selectedAddOns, setSelectedAddOns] = useState<Record<string, number>>(savedDraft?.selectedAddOns || {});
  const [attendees, setAttendees] = useState<CheckoutAttendee[]>(() =>
    savedDraft?.attendees?.length ? savedDraft.attendees : emptyAttendees(savedDraft?.quantity || initialQuantity)
  );
  const [isComplete, setIsComplete] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<CompletedEventOrder | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [giftCardCode, setGiftCardCode] = useState('');
  const [giftCardAmount, setGiftCardAmount] = useState(0);
  const [giftCardApplied, setGiftCardApplied] = useState(false);
  const [giftCardError, setGiftCardError] = useState('');
  const [appliedCouponId, setAppliedCouponId] = useState<string | null>(null);
  const [appliedCouponUses, setAppliedCouponUses] = useState(0);
  const checkoutStateRef = useRef({
    completed: false,
    abandonedLogged: false,
    interacted: false,
    quantity: Math.max(initialQuantity, 1),
    purchaserName: '',
    purchaserEmail: '',
    purchaserPhone: '',
    amountDue: 0,
    subtotal: 0,
    creditSeats: 0,
  });

  useEffect(() => {
    if (!customer) return;
    queueMicrotask(() => {
      setPurchaserEmail(prev => prev || customer.email || '');
      setPurchaserName(prev => prev || customer.name || '');
    });
  }, [customer]);

  useEffect(() => {
    checkoutStateRef.current = {
      ...checkoutStateRef.current,
      completed: isComplete,
      quantity,
      purchaserName,
      purchaserEmail,
      purchaserPhone,
    };
  }, [isComplete, purchaserEmail, purchaserName, purchaserPhone, quantity]);

  const maxSeats = event?.seats_available || 999;
  const selectedQuantity = Math.min(Math.max(quantity, 1), maxSeats);
  const displayedAttendees = useMemo(
    () => Array.from({ length: selectedQuantity }, (_, index) => attendees[index] || { fullName: '', email: '', notes: '' }),
    [attendees, selectedQuantity]
  );
  const pricePerSeat = event?.base_price_per_seat || 0;
  const subtotal = pricePerSeat * selectedQuantity;
  const selectedAddOnItems = useMemo(() => enabledAddOns
    .map((addOn) => {
      const maxAvailable = Math.max(0, Math.min(addOn.maxQuantity, addOn.stock || addOn.maxQuantity));
      const quantity = Math.min(Math.max(selectedAddOns[addOn.productId] || 0, 0), maxAvailable);
      return { ...addOn, quantity, total: quantity * addOn.price };
    })
    .filter((addOn) => addOn.quantity > 0), [enabledAddOns, selectedAddOns]);
  const addOnSubtotal = selectedAddOnItems.reduce((sum, addOn) => sum + addOn.total, 0);
  const membershipEligible = Boolean(customer && membership.plan?.status === 'active' && membership.availableCredits > 0);
  const shouldUseMembershipCredit = useMembershipCredit && membershipEligible;
  const creditSeats = shouldUseMembershipCredit ? Math.min(selectedQuantity, membership.availableCredits) : 0;
  const creditDiscount = creditSeats * pricePerSeat;
  const totalDiscount = creditDiscount + promoDiscount + giftCardAmount;
  const amountDue = Math.max(subtotal + addOnSubtotal - totalDiscount, 0);
  const orderStatus = amountDue === 0 ? 'paid' : 'pending';
  const balanceAfterBooking = membershipEligible ? membership.availableCredits - creditSeats : 0;

  const handleApplyPromo = useCallback(async () => {
    if (!promoCode.trim()) return;
    setPromoError('');
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', promoCode.trim().toUpperCase())
        .eq('is_active', true)
        .lte('valid_from', now)
        .gte('valid_to', now)
        .single();
      if (error || !data) {
        setPromoError('Invalid or expired promo code');
        return;
      }
      if (data.max_uses && data.uses_so_far >= data.max_uses) {
        setPromoError('This promo code has reached its usage limit');
        return;
      }
      const discount = data.discount_type === 'percentage'
        ? Math.round((subtotal + addOnSubtotal) * (data.discount_value / 100) * 100) / 100
        : data.discount_value;
      setPromoDiscount(Math.min(discount, amountDue + creditDiscount));
      setPromoApplied(true);
      setAppliedCouponId(data.id);
      setAppliedCouponUses(data.uses_so_far || 0);
    } catch {
      setPromoError('Could not validate promo code');
    }
  }, [promoCode, subtotal, addOnSubtotal, amountDue, creditDiscount]);

  const handleApplyGiftCard = useCallback(async () => {
    if (!giftCardCode.trim()) return;
    setGiftCardError('');
    try {
      const { data, error } = await supabase
        .from('gift_cards')
        .select('*')
        .eq('code', giftCardCode.trim().toUpperCase())
        .gt('remaining_balance', 0)
        .single();
      if (error || !data) {
        setGiftCardError('Invalid or already redeemed gift card');
        return;
      }
      setGiftCardAmount(Math.min(data.remaining_balance, amountDue || Infinity));
      setGiftCardApplied(true);
    } catch {
      setGiftCardError('Could not validate gift card');
    }
  }, [giftCardCode, amountDue]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = purchaserName.trim();
    const trimmedEmail = purchaserEmail.trim();

    if (!trimmedName) {
      showToast('Please enter your name', 'error');
      return;
    }
    if (!trimmedEmail) {
      showToast('Please enter your email', 'error');
      return;
    }
    if (!emailRegex.test(trimmedEmail)) {
      showToast('Please enter a valid email address', 'error');
      return;
    }

    if (purchaserPhone.trim() && !/^[\d\s\-+().]{7,20}$/.test(purchaserPhone.trim())) {
      showToast('Please enter a valid phone number', 'error');
      return;
    }

    if (collectAttendeeDetails) {
      for (let i = 0; i < displayedAttendees.length; i++) {
        const a = displayedAttendees[i];
        if (a.email.trim() && !emailRegex.test(a.email.trim())) {
          showToast(`Guest ${i + 1} email is not valid`, 'error');
          return;
        }
      }
    }

    checkoutStateRef.current.completed = true;

    const filledAttendees = displayedAttendees.map((a, i) => ({
      fullName: a.fullName.trim() || `${purchaserName}${selectedQuantity > 1 ? ` (Guest ${i + 1})` : ''}`,
      email: a.email.trim() || undefined,
      notes: a.notes.trim() || undefined,
    }));

    try {
      void trackAnalyticsEvent({
        eventName: 'checkout_submit',
        userType: 'customer',
        userEmail: purchaserEmail.trim(),
        properties: {
          checkoutType: 'event',
          eventId: event.id,
          eventSlug: event.slug,
          eventTitle: event.title,
          quantity: selectedQuantity,
          subtotal,
          addOnSubtotal,
          amountDue,
          creditsUsed: creditSeats,
          addOns: selectedAddOnItems.map((addOn) => ({ productId: addOn.productId, name: addOn.name, quantity: addOn.quantity, total: addOn.total })),
        },
      });

      const result = await createOrder.mutateAsync({
        eventId: event.id,
        purchaserName: purchaserName.trim(),
        purchaserEmail: purchaserEmail.trim(),
        purchaserPhone: purchaserPhone.trim() || undefined,
        totalSeats: selectedQuantity,
        subtotalAmount: subtotal,
        discountAmount: totalDiscount,
        totalAmount: amountDue,
        status: orderStatus,
        attendees: filledAttendees,
        couponId: appliedCouponId || undefined,
        customerEmail: customer?.email,
        membershipCreditsUsed: creditSeats,
        membershipCreditValue: creditDiscount,
      });

      if (selectedAddOnItems.length > 0) {
        await Promise.all(selectedAddOnItems.map((addOn) => createProductOrder.mutateAsync({
          order_id: result.order.id,
          product_id: addOn.productId,
          quantity: addOn.quantity,
          unit_price: addOn.price,
          total_price: addOn.total,
          purchaser_name: purchaserName.trim(),
          purchaser_email: purchaserEmail.trim(),
          purchaser_phone: purchaserPhone.trim() || null,
          shipping_address: null,
          shipping_city: null,
          shipping_state: null,
          shipping_zip: null,
          status: orderStatus,
        })));
      }

      const creditRedemption = result.membershipRedemption || (creditSeats > 0 ? await membership.redeemCredits({
          eventId: event.id,
          orderId: result.order.id,
          creditsUsed: creditSeats,
          amountCovered: creditDiscount,
        }) : null);

      if (promoApplied && appliedCouponId) {
        await supabase
          .from('coupons')
          .update({ uses_so_far: appliedCouponUses + 1 })
          .eq('id', appliedCouponId);
      }

      if (giftCardApplied && giftCardCode.trim()) {
        const giftCardAmountUsed = Math.min(giftCardAmount, Math.max(subtotal + addOnSubtotal - creditDiscount - promoDiscount, 0));
        await redeemGiftCard.mutateAsync({ code: giftCardCode.trim().toUpperCase(), amount: giftCardAmountUsed });
      }

      await logActivity({
        action: 'order.created',
        entityType: 'order',
        entityId: result.order.id,
        entityName: purchaserName,
        details: {
          event: event.title,
          seats: selectedQuantity,
          subtotal,
          addOnSubtotal,
          addOns: selectedAddOnItems.map((addOn) => ({ productId: addOn.productId, name: addOn.name, quantity: addOn.quantity, total: addOn.total })),
          membershipCreditsUsed: creditSeats,
          membershipCreditValue: creditDiscount,
          checkoutSource: result.source,
          paymentStatus: orderStatus,
          total: amountDue,
        },
      });

      localStorage.setItem('checkout_success', JSON.stringify({
        event: {
          title: event.title,
          slug: event.slug,
          start_datetime: event.start_datetime,
          end_datetime: event.end_datetime,
          venue: event.venue ? { name: event.venue.name, city: event.venue.city, state: event.venue.state } : null,
          main_image_url: event.main_image_url,
          base_price_per_seat: event.base_price_per_seat,
        },
        purchaserName: purchaserName.trim(),
        purchaserEmail: purchaserEmail.trim(),
        totalSeats: selectedQuantity,
        totalAmount: amountDue,
        subtotal: subtotal + addOnSubtotal,
        addOnSubtotal,
        addOns: selectedAddOnItems.map((addOn) => ({ productId: addOn.productId, name: addOn.name, quantity: addOn.quantity, total: addOn.total })),
        discountAmount: totalDiscount,
        membershipCreditsUsed: creditSeats,
        membershipCreditDiscount: creditDiscount,
        promoCode: promoApplied ? promoCode.trim().toUpperCase() : null,
        promoDiscount: promoApplied ? promoDiscount : 0,
        giftCardCode: giftCardApplied ? giftCardCode.trim().toUpperCase() : null,
        giftCardDiscount: giftCardApplied ? giftCardAmount : 0,
        membershipCreditRedemptionId: creditRedemption?.id || null,
        status: orderStatus,
        orderId: result.order.id,
        attribution: getAttributionContext(),
      }));
      removeEventCheckoutDraft(slug);

      void trackAnalyticsEvent({
        eventName: 'checkout_complete',
        userType: 'customer',
        userEmail: purchaserEmail.trim(),
        properties: {
          checkoutType: 'event',
          eventId: event.id,
          eventSlug: event.slug,
          eventTitle: event.title,
          orderId: result.order.id,
          status: orderStatus,
          quantity: selectedQuantity,
          subtotal,
          addOnSubtotal,
          amountDue,
          creditsUsed: creditSeats,
          addOns: selectedAddOnItems.map((addOn) => ({ productId: addOn.productId, name: addOn.name, quantity: addOn.quantity, total: addOn.total })),
        },
      });

      setCompletedOrder({
        purchaserName: purchaserName.trim(),
        purchaserEmail: purchaserEmail.trim(),
        totalAmount: amountDue,
        creditsUsed: creditSeats,
        status: orderStatus,
        seats: selectedQuantity,
      });
      navigate('/checkout/success');
    } catch (err) {
      void trackAnalyticsEvent({
        eventName: 'checkout_error',
        userType: 'customer',
        userEmail: purchaserEmail.trim() || null,
        properties: {
          checkoutType: 'event',
          eventId: event.id,
          eventSlug: event.slug,
          message: err instanceof Error ? err.message : 'Order creation failed',
        },
      });
      showToast(err instanceof Error ? err.message : 'Order creation failed', 'error');
    }
  };

  const handleQuantityChange = (delta: number) => {
    const next = selectedQuantity + delta;
    if (next >= 1 && next <= maxSeats) {
      checkoutStateRef.current.interacted = true;
      setQuantity(next);
      setAttendees(prev => Array.from({ length: next }, (_, index) => prev[index] || { fullName: '', email: '', notes: '' }));
    }
  };

  const updateAttendee = (index: number, field: 'fullName' | 'email' | 'notes', value: string) => {
    checkoutStateRef.current.interacted = true;
    setAttendees(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const updateAddOnQuantity = (productId: string, quantity: number) => {
    checkoutStateRef.current.interacted = true;
    setSelectedAddOns(prev => ({ ...prev, [productId]: Math.max(0, quantity) }));
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--section-bg-light)' }}>
      <SEO title="Checkout" description="Complete your booking" />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button onClick={() => navigate(-1)} className="flex items-center mb-6" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Event
        </button>

        <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>Checkout</h1>

        <Card className="mb-6">
          <CardContent className="p-4">
            <h2 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{event.title}</h2>
            <div className="flex flex-wrap gap-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> {formatDateTime(event.start_datetime)}</span>
              {event.venue && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {event.venue.name}</span>}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit}>
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Your Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    label="Full Name"
                    value={purchaserName}
                    onChange={(e) => {
                      checkoutStateRef.current.interacted = true;
                      setPurchaserName(e.target.value);
                    }}
                    required
                  />
                  <Input
                    label="Email"
                    type="email"
                    value={purchaserEmail}
                    onChange={(e) => {
                      checkoutStateRef.current.interacted = true;
                      setPurchaserEmail(e.target.value);
                    }}
                    required
                  />
                  <Input
                    label="Phone (optional)"
                    type="tel"
                    value={purchaserPhone}
                    onChange={(e) => {
                      checkoutStateRef.current.interacted = true;
                      setPurchaserPhone(e.target.value);
                    }}
                  />
                </CardContent>
              </Card>

              <Card className="mb-6">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Seats</CardTitle>
                      <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                        Reserve now with purchaser info. Guest names and notes can be added after booking.
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        aria-label="Decrease seats"
                        onClick={() => handleQuantityChange(-1)}
                        disabled={selectedQuantity <= 1}
                        className="w-8 h-8 flex items-center justify-center border rounded"
                        style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{selectedQuantity}</span>
                      <button
                        type="button"
                        aria-label="Increase seats"
                        onClick={() => handleQuantityChange(1)}
                        disabled={selectedQuantity >= maxSeats}
                        className="w-8 h-8 flex items-center justify-center border rounded"
                        style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--section-bg-light)' }}>
                    <div>
                      <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                        {selectedQuantity} seat{selectedQuantity === 1 ? '' : 's'} selected
                      </p>
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        Keep checkout quick, or add guest details now if you already have them.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        checkoutStateRef.current.interacted = true;
                        setCollectAttendeeDetails(prev => !prev);
                      }}
                    >
                      {collectAttendeeDetails ? 'Hide guest details' : 'Add guest details now'}
                    </Button>
                  </div>

                  {collectAttendeeDetails && displayedAttendees.map((attendee, index) => (
                    <div key={index}>
                      <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>
                        Guest {index + 1}
                      </h3>
                      <div className="space-y-3">
                        <Input
                          label={`Guest ${index + 1} name (optional)`}
                          value={attendee.fullName}
                          onChange={(e) => updateAttendee(index, 'fullName', e.target.value)}
                          placeholder={index === 0 ? purchaserName : `${purchaserName || 'Purchaser'}'s guest`}
                        />
                        <Input
                          label={`Guest ${index + 1} email (optional)`}
                          type="email"
                          value={attendee.email}
                          onChange={(e) => updateAttendee(index, 'email', e.target.value)}
                          placeholder={index === 0 ? purchaserEmail : ''}
                        />
                        <Input
                          label={`Guest ${index + 1} notes (optional)`}
                          value={attendee.notes}
                          onChange={(e) => updateAttendee(index, 'notes', e.target.value)}
                          placeholder="Dietary needs, seating preferences, accessibility notes, etc."
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {enabledAddOns.length > 0 && (
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle>Optional Add-Ons</CardTitle>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      Add studio extras to your reservation. These are optional and can be limited by inventory.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {enabledAddOns.map((addOn) => {
                      const maxAvailable = Math.max(0, Math.min(addOn.maxQuantity, addOn.stock || addOn.maxQuantity));
                      const quantity = Math.min(selectedAddOns[addOn.productId] || 0, maxAvailable);
                      const suggestedQuantity = addOn.perSeat ? Math.min(selectedQuantity, maxAvailable) : 1;
                      return (
                        <div key={addOn.productId} className="rounded-lg border p-4" style={{ borderColor: quantity ? 'var(--primary-color)' : 'var(--border-color)', backgroundColor: 'var(--section-bg-light)' }}>
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{addOn.name}</p>
                              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                                {formatCurrency(addOn.price)} each{addOn.perSeat ? ' · suggested one per seat' : ''} · {maxAvailable} available
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                aria-label={`Decrease ${addOn.name}`}
                                onClick={() => updateAddOnQuantity(addOn.productId, quantity - 1)}
                                disabled={quantity <= 0}
                                className="w-8 h-8 flex items-center justify-center border rounded disabled:opacity-50"
                                style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                              >
                                <Minus className="h-4 w-4" />
                              </button>
                              <span className="w-6 text-center font-semibold" style={{ color: 'var(--text-primary)' }}>{quantity}</span>
                              <button
                                type="button"
                                aria-label={`Increase ${addOn.name}`}
                                onClick={() => updateAddOnQuantity(addOn.productId, quantity > 0 ? quantity + 1 : suggestedQuantity)}
                                disabled={quantity >= maxAvailable}
                                className="w-8 h-8 flex items-center justify-center border rounded disabled:opacity-50"
                                style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                              <span className="min-w-20 text-right font-semibold" style={{ color: 'var(--text-primary)' }}>
                                {formatCurrency(quantity * addOn.price)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}

              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Payment Method</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {customer ? (
                    <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--section-bg-light)' }}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: 'var(--primary-color)', color: 'white' }}>
                            <Ticket className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{membership.plan?.name || 'Membership credits'}</p>
                            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                              {membership.availableCredits} credit{membership.availableCredits === 1 ? '' : 's'} available. {membership.plan ? 'Renews monthly.' : ''}
                              {membership.source === 'demo' ? ' Demo ledger.' : ''}
                            </p>
                          </div>
                        </div>
                        <span className="text-sm font-semibold" style={{ color: membershipEligible ? 'var(--primary-color)' : 'var(--text-muted)' }}>
                          {membershipEligible ? 'Eligible' : 'Unavailable'}
                        </span>
                      </div>

                      <label className={`mt-4 flex items-start gap-3 rounded-lg border p-3 ${membershipEligible ? 'cursor-pointer' : 'opacity-60'}`} style={{ borderColor: shouldUseMembershipCredit ? 'var(--primary-color)' : 'var(--border-color)', backgroundColor: 'var(--card-bg)' }}>
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={shouldUseMembershipCredit}
                          disabled={!membershipEligible}
                          onChange={(e) => {
                            checkoutStateRef.current.interacted = true;
                            setUseMembershipCredit(e.target.checked);
                          }}
                        />
                        <span>
                          <span className="block font-semibold" style={{ color: 'var(--text-primary)' }}>Use membership credits</span>
                          <span className="block text-sm" style={{ color: 'var(--text-muted)' }}>
                            {membershipEligible
                              ? `${Math.min(selectedQuantity, membership.availableCredits)} credit${Math.min(selectedQuantity, membership.availableCredits) === 1 ? '' : 's'} can cover ${Math.min(selectedQuantity, membership.availableCredits)} of ${selectedQuantity} seat${selectedQuantity === 1 ? '' : 's'}.`
                              : 'Credits appear here when the customer has an active plan.'}
                          </span>
                        </span>
                      </label>
                    </div>
                  ) : (
                    <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--section-bg-light)' }}>
                      <div className="flex items-start gap-3">
                        <CreditCard className="mt-1 h-5 w-5" style={{ color: 'var(--text-muted)' }} />
                        <div>
                          <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>Pay by card</p>
                          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Sign in to your account before checkout to use membership credits.</p>
                          <Link to={`/account/login?next=${encodeURIComponent(`/checkout/${slug}?quantity=${selectedQuantity}`)}`} className="mt-2 inline-flex text-sm font-semibold" style={{ color: 'var(--primary-color)' }}>
                            Sign in for credits
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}
                  {amountDue > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                      Card processing is not connected in this local build. This checkout will create a pending-payment reservation instead of marking the order paid.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Button type="submit" className="w-full" size="lg" disabled={createOrder.isPending || createProductOrder.isPending || membership.isRedeeming}>
                {createOrder.isPending || createProductOrder.isPending || membership.isRedeeming ? 'Processing...' : `${amountDue === 0 ? 'Confirm' : 'Reserve'} ${selectedQuantity} Seat${selectedQuantity > 1 ? 's' : ''} — ${amountDue === 0 ? 'Covered by credits' : formatCurrency(amountDue)}`}
              </Button>
            </form>
          </div>

          <div>
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <div>
                    <p style={{ color: 'var(--text-primary)' }}>{event.title}</p>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {formatDateTime(event.start_datetime)}
                    </p>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {selectedQuantity} × {formatCurrency(pricePerSeat)}
                  </span>
                  <span style={{ color: 'var(--text-primary)' }}>{formatCurrency(subtotal)}</span>
                </div>
                {selectedAddOnItems.map((addOn) => (
                  <div key={addOn.productId} className="flex justify-between">
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {addOn.quantity} × {addOn.name}
                    </span>
                    <span style={{ color: 'var(--text-primary)' }}>{formatCurrency(addOn.total)}</span>
                  </div>
                ))}
                {creditSeats > 0 && (
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Membership credits ({creditSeats})
                    </span>
                    <span style={{ color: 'var(--primary-color)' }}>-{formatCurrency(creditDiscount)}</span>
                  </div>
                )}
                {promoApplied && promoDiscount > 0 && (
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-secondary)' }}>Promo discount</span>
                    <span style={{ color: 'var(--primary-color)' }}>-{formatCurrency(promoDiscount)}</span>
                  </div>
                )}
                {giftCardApplied && giftCardAmount > 0 && (
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-secondary)' }}>Gift card</span>
                    <span style={{ color: 'var(--primary-color)' }}>-{formatCurrency(giftCardAmount)}</span>
                  </div>
                )}
                <div className="border-t pt-4 space-y-3" style={{ borderColor: 'var(--border-color)' }}>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Promo code"
                      value={promoCode}
                      onChange={(event) => { setPromoCode(event.target.value); setPromoError(''); setPromoApplied(false); setPromoDiscount(0); }}
                      disabled={promoApplied}
                      className="flex-1"
                    />
                    <Button type="button" variant="outline" size="sm" onClick={handleApplyPromo} disabled={promoApplied || !promoCode.trim()}>
                      <Tag className="mr-1 h-4 w-4" />
                      Apply
                    </Button>
                  </div>
                  {promoError && <p className="text-xs text-red-500">{promoError}</p>}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Gift card code"
                      value={giftCardCode}
                      onChange={(event) => { setGiftCardCode(event.target.value); setGiftCardError(''); setGiftCardApplied(false); setGiftCardAmount(0); }}
                      disabled={giftCardApplied}
                      className="flex-1"
                    />
                    <Button type="button" variant="outline" size="sm" onClick={handleApplyGiftCard} disabled={giftCardApplied || !giftCardCode.trim()}>
                      <Gift className="mr-1 h-4 w-4" />
                      Apply
                    </Button>
                  </div>
                  {giftCardError && <p className="text-xs text-red-500">{giftCardError}</p>}
                  <div className="flex justify-between font-bold">
                    <span style={{ color: 'var(--text-primary)' }}>Due today</span>
                    <span style={{ color: 'var(--primary-color)' }}>{formatCurrency(amountDue)}</span>
                  </div>
                  {creditSeats > 0 && (
                    <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                      Balance after booking: {balanceAfterBooking} credit{balanceAfterBooking === 1 ? '' : 's'}.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductCheckout() {
  const { items, getTotal, clearCart } = useCart();
  const createOrder = useCreateProductOrder();
  const navigate = useNavigate();
  const redeemGiftCard = useRedeemGiftCard();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
  });
  const [promoCode, setPromoCode] = useState('');
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [giftCardCode, setGiftCardCode] = useState('');
  const [giftCardAmount, setGiftCardAmount] = useState(0);
  const [giftCardApplied, setGiftCardApplied] = useState(false);
  const [giftCardError, setGiftCardError] = useState('');
  const [appliedCouponId, setAppliedCouponId] = useState<string | null>(null);
  const [appliedCouponUses, setAppliedCouponUses] = useState(0);
  const { showToast } = useToast();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const productTotal = getTotal();
  const totalDiscount = promoDiscount + giftCardAmount;
  const amountDue = Math.max(productTotal - totalDiscount, 0);

  const handleApplyPromo = useCallback(async () => {
    if (!promoCode.trim()) return;
    setPromoError('');
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', promoCode.trim().toUpperCase())
        .eq('is_active', true)
        .lte('valid_from', now)
        .gte('valid_to', now)
        .single();
      if (error || !data) {
        setPromoError('Invalid or expired promo code');
        return;
      }
      if (data.max_uses && data.uses_so_far >= data.max_uses) {
        setPromoError('This promo code has reached its usage limit');
        return;
      }
      const discount = data.discount_type === 'percentage'
        ? Math.round(productTotal * (data.discount_value / 100) * 100) / 100
        : data.discount_value;
      setPromoDiscount(Math.min(discount, productTotal));
      setPromoApplied(true);
      setAppliedCouponId(data.id);
      setAppliedCouponUses(data.uses_so_far || 0);
    } catch {
      setPromoError('Could not validate promo code');
    }
  }, [promoCode, productTotal]);

  const handleApplyGiftCard = useCallback(async () => {
    if (!giftCardCode.trim()) return;
    setGiftCardError('');
    try {
      const { data, error } = await supabase
        .from('gift_cards')
        .select('*')
        .eq('code', giftCardCode.trim().toUpperCase())
        .gt('remaining_balance', 0)
        .single();
      if (error || !data) {
        setGiftCardError('Invalid or already redeemed gift card');
        return;
      }
      setGiftCardAmount(Math.min(data.remaining_balance, productTotal || Infinity));
      setGiftCardApplied(true);
    } catch {
      setGiftCardError('Could not validate gift card');
    }
  }, [giftCardCode, productTotal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = formData.name.trim();
    const trimmedEmail = formData.email.trim();
    if (!trimmedName) { showToast('Please enter your name', 'error'); return; }
    if (!trimmedEmail) { showToast('Please enter your email', 'error'); return; }
    if (!emailRegex.test(trimmedEmail)) { showToast('Please enter a valid email address', 'error'); return; }
    if (formData.phone.trim() && !/^[\d\s\-+().]{7,20}$/.test(formData.phone.trim())) { showToast('Please enter a valid phone number', 'error'); return; }
    if (!formData.address.trim()) { showToast('Please enter your shipping address', 'error'); return; }
    if (!formData.city.trim()) { showToast('Please enter your city', 'error'); return; }
    if (!formData.state.trim()) { showToast('Please enter your state', 'error'); return; }
    if (!formData.zip.trim()) { showToast('Please enter your ZIP code', 'error'); return; }

    try {
      void trackAnalyticsEvent({
        eventName: 'checkout_submit',
        userType: 'customer',
        userEmail: formData.email,
        properties: {
          checkoutType: 'product',
          itemCount: items.length,
          total: getTotal(),
        },
      });

      for (const item of items) {
        await createOrder.mutateAsync({
          product_id: item.productId,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: item.price * item.quantity,
          purchaser_name: formData.name,
          purchaser_email: formData.email,
          purchaser_phone: formData.phone || null,
          shipping_address: formData.address,
          shipping_city: formData.city,
          shipping_state: formData.state,
          shipping_zip: formData.zip,
          status: 'pending',
        });
      }

      if (promoApplied && appliedCouponId) {
        await supabase
          .from('coupons')
          .update({ uses_so_far: appliedCouponUses + 1 })
          .eq('id', appliedCouponId);
      }

      if (giftCardApplied && giftCardCode.trim()) {
        const giftCardAmountUsed = Math.min(giftCardAmount, Math.max(productTotal - promoDiscount, 0));
        await redeemGiftCard.mutateAsync({ code: giftCardCode.trim().toUpperCase(), amount: giftCardAmountUsed });
      }

      await logActivity({
        action: 'product.order.created',
        entityType: 'product_order',
        entityName: formData.name,
        details: {
          email: formData.email,
          itemCount: items.length,
          total: getTotal(),
        },
      });

      void trackAnalyticsEvent({
        eventName: 'checkout_complete',
        userType: 'customer',
        userEmail: formData.email,
        properties: {
          checkoutType: 'product',
          itemCount: items.length,
          total: getTotal(),
        },
      });

      localStorage.setItem('checkout_success', JSON.stringify({
        checkoutType: 'product',
        purchaserName: formData.name.trim(),
        purchaserEmail: formData.email.trim(),
        totalAmount: amountDue,
        subtotal: productTotal,
        items: items.map((item) => ({ name: item.name, quantity: item.quantity, total: item.price * item.quantity })),
        discountAmount: totalDiscount,
        promoCode: promoApplied ? promoCode.trim().toUpperCase() : null,
        promoDiscount: promoApplied ? promoDiscount : 0,
        giftCardCode: giftCardApplied ? giftCardCode.trim().toUpperCase() : null,
        giftCardDiscount: giftCardApplied ? giftCardAmount : 0,
        orderId: `PROD-${Date.now().toString(36)}`,
      }));

      clearCart();
      navigate('/checkout/success');
    } catch (err) {
      void trackAnalyticsEvent({
        eventName: 'checkout_error',
        userType: 'customer',
        userEmail: formData.email || null,
        properties: {
          checkoutType: 'product',
          message: err instanceof Error ? err.message : 'Product order creation failed',
        },
      });
      showToast(err instanceof Error ? err.message : 'Product order failed', 'error');
    }
  };


  if (items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--section-bg-light)' }}>
        <div className="text-center">
          <ShoppingBag className="h-16 w-16 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
          <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Your cart is empty</h1>
          <Link to="/shop"><Button>Browse Products</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--section-bg-light)' }}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button onClick={() => navigate(-1)} className="flex items-center mb-6" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Cart
        </button>

        <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit}>
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    label="Full Name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                  <Input
                    label="Email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                  <Input
                    label="Phone (optional)"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </CardContent>
              </Card>

              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Shipping Address</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    label="Street Address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    required
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="City"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      required
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="State"
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                        required
                      />
                      <Input
                        label="ZIP Code"
                        value={formData.zip}
                        onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Button type="submit" className="w-full" size="lg" disabled={createOrder.isPending}>
                {createOrder.isPending ? 'Placing Order...' : `${amountDue === 0 ? 'Place Order' : `Place Order - ${formatCurrency(amountDue)}`}`}
              </Button>
            </form>
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {items.map((item) => (
                  <div key={item.productId} className="flex justify-between">
                    <div>
                      <p style={{ color: 'var(--text-primary)' }}>{item.name}</p>
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Qty: {item.quantity}</p>
                    </div>
                    <p style={{ color: 'var(--text-primary)' }}>{formatCurrency(item.price * item.quantity)}</p>
                  </div>
                ))}
                {promoApplied && promoDiscount > 0 && (
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-secondary)' }}>Promo discount</span>
                    <span style={{ color: 'var(--primary-color)' }}>-{formatCurrency(promoDiscount)}</span>
                  </div>
                )}
                {giftCardApplied && giftCardAmount > 0 && (
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-secondary)' }}>Gift card</span>
                    <span style={{ color: 'var(--primary-color)' }}>-{formatCurrency(giftCardAmount)}</span>
                  </div>
                )}
                <div className="border-t pt-3 space-y-3" style={{ borderColor: 'var(--border-color)' }}>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Promo code"
                      value={promoCode}
                      onChange={(e) => { setPromoCode(e.target.value); setPromoError(''); setPromoApplied(false); setPromoDiscount(0); }}
                      disabled={promoApplied}
                      className="flex-1"
                    />
                    <Button type="button" variant="outline" size="sm" onClick={handleApplyPromo} disabled={promoApplied || !promoCode.trim()}>
                      <Tag className="mr-1 h-4 w-4" />
                      Apply
                    </Button>
                  </div>
                  {promoError && <p className="text-xs text-red-500">{promoError}</p>}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Gift card code"
                      value={giftCardCode}
                      onChange={(e) => { setGiftCardCode(e.target.value); setGiftCardError(''); setGiftCardApplied(false); setGiftCardAmount(0); }}
                      disabled={giftCardApplied}
                      className="flex-1"
                    />
                    <Button type="button" variant="outline" size="sm" onClick={handleApplyGiftCard} disabled={giftCardApplied || !giftCardCode.trim()}>
                      <Gift className="mr-1 h-4 w-4" />
                      Apply
                    </Button>
                  </div>
                  {giftCardError && <p className="text-xs text-red-500">{giftCardError}</p>}
                  <div className="flex justify-between font-bold">
                    <span style={{ color: 'var(--text-primary)' }}>Total</span>
                    <span style={{ color: 'var(--primary-color)' }}>{formatCurrency(amountDue)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
