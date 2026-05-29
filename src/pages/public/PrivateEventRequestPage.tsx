import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubmitPrivateEventRequest, usePaintableImages } from '../../hooks/usePrivateEventRequests';
import { useVenues } from '../../hooks/useEvents';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import SEO from '../../components/SEO';
import { trackAnalyticsEvent } from '../../lib/analytics';
import { Check, ChevronLeft, ChevronRight, Clock, Paintbrush, Users, Sparkles } from 'lucide-react';
import type { GalleryImage, PrivateRequestEventType, PrivateRequestTime, PaintingSelectionType } from '../../types/database';

const STEPS = [
  { number: 1, label: 'Contact Info' },
  { number: 2, label: 'Event Details' },
  { number: 3, label: 'Painting Selection' },
  { number: 4, label: 'Special Requests' },
  { number: 5, label: 'Review & Submit' },
];

const EVENT_TYPES: { value: PrivateRequestEventType; label: string }[] = [
  { value: 'bachelorette', label: 'Bachelorette Party' },
  { value: 'corporate', label: 'Corporate Event' },
  { value: 'birthday', label: 'Birthday Celebration' },
  { value: 'holiday', label: 'Holiday Party' },
  { value: 'other', label: 'Other' },
];

const TIME_OPTIONS: { value: PrivateRequestTime; label: string }[] = [
  { value: 'morning', label: 'Morning (9am–12pm)' },
  { value: 'afternoon', label: 'Afternoon (12pm–5pm)' },
  { value: 'evening', label: 'Evening (5pm–10pm)' },
];

const LOCATION_OPTIONS = [
  { value: 'studio', label: 'At your studio' },
  { value: 'customer_venue', label: 'At our location / venue' },
  { value: 'corporate_office', label: 'Corporate office' },
  { value: 'undecided', label: 'Not sure yet' },
];

const BUDGET_OPTIONS = [
  { value: '', label: 'Not sure yet' },
  { value: 'under_500', label: 'Under $500' },
  { value: '500_1000', label: '$500–$1,000' },
  { value: '1000_2000', label: '$1,000–$2,000' },
  { value: '2000_plus', label: '$2,000+' },
];

const PACKAGE_OPTIONS = [
  { value: 'standard_private', label: 'Standard private party' },
  { value: 'premium_private', label: 'Premium private experience' },
  { value: 'mobile_event', label: 'Mobile/off-site event' },
  { value: 'corporate_team_building', label: 'Corporate team-building' },
  { value: 'not_sure', label: 'Help me choose' },
];

const CONTACT_METHOD_OPTIONS = [
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone call' },
  { value: 'text', label: 'Text message' },
];

const TIMELINE_OPTIONS = [
  { value: 'asap', label: 'As soon as possible' },
  { value: 'this_month', label: 'This month' },
  { value: 'next_1_3_months', label: 'Next 1–3 months' },
  { value: 'planning_ahead', label: 'Planning ahead' },
];

const DEPOSIT_OPTIONS = [
  { value: 'ready', label: 'Ready if the date is available' },
  { value: 'need_proposal', label: 'Need a proposal first' },
  { value: 'just_exploring', label: 'Just exploring options' },
];

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: 'bg-green-100 text-green-700',
  intermediate: 'bg-yellow-100 text-yellow-700',
  advanced: 'bg-red-100 text-red-700',
};

export default function PrivateEventRequestPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<number>(1);
  const [submitted, setSubmitted] = useState(false);
  const [confirmAck, setConfirmAck] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');

  const [eventType, setEventType] = useState<PrivateRequestEventType>('birthday');
  const [preferredDate, setPreferredDate] = useState('');
  const [alternateDate, setAlternateDate] = useState('');
  const [preferredTime, setPreferredTime] = useState<PrivateRequestTime>('evening');
  const [guestCount, setGuestCount] = useState(10);
  const [venuePreferenceId, setVenuePreferenceId] = useState('');
  const [locationPreference, setLocationPreference] = useState('studio');
  const [budgetRange, setBudgetRange] = useState('');
  const [packageInterest, setPackageInterest] = useState('standard_private');
  const [dateFlexible, setDateFlexible] = useState('yes');

  const [paintingSelectionType, setPaintingSelectionType] = useState<PaintingSelectionType>('chosen');
  const [selectedPaintingId, setSelectedPaintingId] = useState('');
  const [customPaintingRequest, setCustomPaintingRequest] = useState('');

  const [occasionDetails, setOccasionDetails] = useState('');
  const [foodDrinkExpectations, setFoodDrinkExpectations] = useState('');
  const [preferredContactMethod, setPreferredContactMethod] = useState('email');
  const [bookingTimeline, setBookingTimeline] = useState('next_1_3_months');
  const [depositReadiness, setDepositReadiness] = useState('need_proposal');
  const [accessibilityNeeds, setAccessibilityNeeds] = useState('');
  const [referralSource, setReferralSource] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});

  const submitMutation = useSubmitPrivateEventRequest();
  const { data: paintableImages, isLoading: paintingsLoading } = usePaintableImages();
  const { data: venues } = useVenues();

  const venueOptions = [
    { value: '', label: 'No preference' },
    ...(venues?.map((v) => ({ value: v.id, label: v.name })) ?? []),
  ];

  const validateStep = (s: number): boolean => {
    const e: Record<string, string> = {};
    if (s === 1) {
      if (!firstName.trim()) e.firstName = 'First name is required';
      if (!lastName.trim()) e.lastName = 'Last name is required';
      if (!email.trim()) e.email = 'Email is required';
      else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Invalid email address';
      if (!phone.trim()) e.phone = 'Phone number is required';
      if (eventType === 'corporate' && !companyName.trim()) e.companyName = 'Company name is required for corporate events';
    }
    if (s === 2) {
      if (!preferredDate) e.preferredDate = 'Preferred date is required';
      if (guestCount < 8) e.guestCount = 'Minimum 8 guests required';
    }
    if (s === 3) {
      if (paintingSelectionType === 'chosen' && !selectedPaintingId) e.selectedPaintingId = 'Please select a painting from the gallery';
      if (paintingSelectionType === 'custom_request' && !customPaintingRequest.trim()) e.customPaintingRequest = 'Please describe your custom painting request';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const nextStep = () => {
    if (validateStep(step)) {
      void trackAnalyticsEvent({
        eventName: 'private_request_step_complete',
        userType: 'public',
        userEmail: email || null,
        properties: {
          step,
          eventType,
          guestCount,
          packageInterest,
          budgetRange,
        },
      });
      setStep((s) => Math.min(s + 1, 5));
    }
  };

  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  const handleSubmit = async () => {
    if (!confirmAck) {
      setErrors({ confirm: 'Please confirm you understand this is a request' });
      return;
    }
    const enrichedSpecialRequests = [
      occasionDetails && `Occasion/theme: ${occasionDetails}`,
      `Location preference: ${LOCATION_OPTIONS.find((option) => option.value === locationPreference)?.label || locationPreference}`,
      budgetRange && `Budget range: ${BUDGET_OPTIONS.find((option) => option.value === budgetRange)?.label || budgetRange}`,
      `Package interest: ${PACKAGE_OPTIONS.find((option) => option.value === packageInterest)?.label || packageInterest}`,
      `Date flexible: ${dateFlexible === 'yes' ? 'Yes' : 'No'}`,
      foodDrinkExpectations && `Food/drink expectations: ${foodDrinkExpectations}`,
      `Preferred contact method: ${CONTACT_METHOD_OPTIONS.find((option) => option.value === preferredContactMethod)?.label || preferredContactMethod}`,
      `Booking timeline: ${TIMELINE_OPTIONS.find((option) => option.value === bookingTimeline)?.label || bookingTimeline}`,
      `Deposit readiness: ${DEPOSIT_OPTIONS.find((option) => option.value === depositReadiness)?.label || depositReadiness}`,
      accessibilityNeeds && `Accessibility needs: ${accessibilityNeeds}`,
      referralSource && `Referral/source: ${referralSource}`,
      specialRequests && `Additional notes: ${specialRequests}`,
    ].filter(Boolean).join('\n');

    try {
      void trackAnalyticsEvent({
        eventName: 'private_request_submit',
        userType: 'public',
        userEmail: email,
        properties: {
          eventType,
          guestCount,
          preferredTime,
          locationPreference,
          budgetRange,
          packageInterest,
          bookingTimeline,
          depositReadiness,
          paintingSelectionType,
        },
      });

      const createdRequest = await submitMutation.mutateAsync({
        contact_name: `${firstName} ${lastName}`,
        contact_email: email,
        contact_phone: phone,
        company_name: eventType === 'corporate' ? companyName : null,
        event_type: eventType,
        preferred_date: preferredDate,
        alternate_date: alternateDate || null,
        preferred_time: preferredTime,
        guest_count: guestCount,
        venue_preference_id: venuePreferenceId || null,
        painting_selection_type: paintingSelectionType,
        selected_painting_id: paintingSelectionType === 'chosen' ? selectedPaintingId : null,
        custom_painting_request: paintingSelectionType === 'custom_request' ? customPaintingRequest : null,
        special_requests: enrichedSpecialRequests || null,
        status: 'submitted',
      });
      void trackAnalyticsEvent({
        eventName: 'private_request_complete',
        userType: 'public',
        userEmail: email,
        properties: {
          requestId: createdRequest?.id || null,
          eventType,
          guestCount,
          preferredDate,
          preferredTime,
          locationPreference,
          budgetRange,
          packageInterest,
          bookingTimeline,
          depositReadiness,
          paintingSelectionType,
        },
      });
      setSubmitted(true);
    } catch (err) {
      void trackAnalyticsEvent({
        eventName: 'private_request_error',
        userType: 'public',
        userEmail: email || null,
        properties: {
          eventType,
          guestCount,
          message: err instanceof Error ? err.message : 'Private request failed',
        },
      });
      setErrors({ submit: 'Something went wrong. Please try again.' });
    }
  };

  if (submitted) {
    return (
      <div className="py-16" style={{ backgroundColor: 'var(--section-bg-white)' }}>
        <SEO title="Request Received" description="Your private event request has been submitted." />
        <div className="mx-auto max-w-lg px-4 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
            <Check className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Thank You!</h1>
          <p className="text-lg mb-2" style={{ color: 'var(--text-secondary)' }}>
            We'll reach out to <span className="font-semibold">{email}</span> within 24 hours to discuss your private event.
          </p>
          <p className="mb-8" style={{ color: 'var(--text-secondary)' }}>
            Keep an eye on your inbox — we're excited to help you plan an unforgettable experience!
          </p>
          <Button onClick={() => navigate('/')}>Back to Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="py-12" style={{ backgroundColor: 'var(--section-bg-white)' }}>
      <SEO title="Private Events" description="Request a private paint & sip event for your group — bachelorette parties, corporate events, birthdays, and more!" />

      <div className="mx-auto max-w-3xl px-4">
        <div className="text-center mb-10">
          <Sparkles className="h-12 w-12 text-primary-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Request a Private Event</h1>
          <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
            Plan an unforgettable paint & sip experience for your group. Fill out the form below and we'll get back to you within 24 hours.
          </p>
        </div>

        <div className="flex items-center justify-center mb-10">
          {STEPS.map((s, i) => (
            <div key={s.number} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                    step > s.number
                      ? 'bg-green-500 text-white'
                      : step === s.number
                        ? 'text-white scale-110'
                        : 'bg-gray-200 text-gray-500'
                  }`}
                  style={step === s.number ? { backgroundColor: 'var(--primary-color)' } : undefined}
                >
                  {step > s.number ? <Check className="h-5 w-5" /> : s.number}
                </div>
                <span
                  className={`text-xs mt-1 font-medium hidden sm:block ${
                    step >= s.number ? '' : 'text-gray-400'
                  }`}
                  style={step >= s.number ? { color: 'var(--primary-color)' } : undefined}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`w-8 sm:w-16 h-0.5 mx-1 transition-colors duration-300 ${
                    step > s.number ? 'bg-green-500' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="First Name *" value={firstName} onChange={(e) => setFirstName(e.target.value)} error={errors.firstName} placeholder="Jane" />
                <Input label="Last Name *" value={lastName} onChange={(e) => setLastName(e.target.value)} error={errors.lastName} placeholder="Doe" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Email *" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} placeholder="jane@example.com" />
                <Input label="Phone *" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} error={errors.phone} placeholder="(555) 123-4567" />
              </div>
              {eventType === 'corporate' && (
                <Input label="Company Name *" value={companyName} onChange={(e) => setCompanyName(e.target.value)} error={errors.companyName} placeholder="Acme Corp" />
              )}
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Event Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select label="Event Type *" value={eventType} onChange={(e) => setEventType(e.target.value as PrivateRequestEventType)} options={EVENT_TYPES} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Preferred Date *" type="date" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} error={errors.preferredDate} />
                <Input label="Alternate Date" type="date" value={alternateDate} onChange={(e) => setAlternateDate(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select label="Preferred Time *" value={preferredTime} onChange={(e) => setPreferredTime(e.target.value as PrivateRequestTime)} options={TIME_OPTIONS} />
                <Input label="Guest Count *" type="number" min={8} value={String(guestCount)} onChange={(e) => setGuestCount(Math.max(8, parseInt(e.target.value) || 8))} error={errors.guestCount} />
              </div>
              <Select label="Venue Preference" value={venuePreferenceId} onChange={(e) => setVenuePreferenceId(e.target.value)} options={venueOptions} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select label="Where should this happen?" value={locationPreference} onChange={(e) => setLocationPreference(e.target.value)} options={LOCATION_OPTIONS} />
                <Select label="Is your date flexible?" value={dateFlexible} onChange={(e) => setDateFlexible(e.target.value)} options={[{ value: 'yes', label: 'Yes, we have flexibility' }, { value: 'no', label: 'No, this date is firm' }]} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select label="Budget Range" value={budgetRange} onChange={(e) => setBudgetRange(e.target.value)} options={BUDGET_OPTIONS} />
                <Select label="Package Interest" value={packageInterest} onChange={(e) => setPackageInterest(e.target.value)} options={PACKAGE_OPTIONS} />
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Painting Selection</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                {([
                  { value: 'chosen' as PaintingSelectionType, label: 'Browse our gallery and choose', icon: <Paintbrush className="h-5 w-5" /> },
                  { value: 'owner_chooses' as PaintingSelectionType, label: 'Let the owner choose for us', icon: <Sparkles className="h-5 w-5" /> },
                  { value: 'custom_request' as PaintingSelectionType, label: 'I have a custom request', icon: <Users className="h-5 w-5" /> },
                ]).map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      paintingSelectionType === option.value
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paintingSelectionType"
                      value={option.value}
                      checked={paintingSelectionType === option.value}
                      onChange={() => {
                        setPaintingSelectionType(option.value);
                        setSelectedPaintingId('');
                        setCustomPaintingRequest('');
                        setErrors({});
                      }}
                      className="sr-only"
                    />
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                      paintingSelectionType === option.value ? 'text-primary-600 bg-primary-100' : 'text-gray-400 bg-gray-100'
                    }`}>
                      {option.icon}
                    </div>
                    <div>
                      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{option.label}</span>
                    </div>
                    {paintingSelectionType === option.value && (
                      <Check className="h-5 w-5 text-primary-500 ml-auto" />
                    )}
                  </label>
                ))}
              </div>

              {errors.selectedPaintingId && <p className="text-sm text-red-600">{errors.selectedPaintingId}</p>}
              {errors.customPaintingRequest && <p className="text-sm text-red-600">{errors.customPaintingRequest}</p>}

              {paintingSelectionType === 'chosen' && (
                <div>
                  <h4 className="font-medium mb-3" style={{ color: 'var(--text-primary)' }}>Choose a Painting</h4>
                  {paintingsLoading ? (
                    <LoadingSpinner />
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {paintableImages?.map((img: GalleryImage) => (
                        <button
                          key={img.id}
                          onClick={() => { setSelectedPaintingId(img.id); setErrors({}); }}
                          className={`relative rounded-xl overflow-hidden border-2 transition-all hover:shadow-lg text-left ${
                            selectedPaintingId === img.id ? 'border-primary-500 ring-2 ring-primary-200' : 'border-gray-200'
                          }`}
                        >
                          <div className="aspect-square bg-gray-100">
                            {img.url ? (
                              <img src={img.url} alt={img.caption || 'Painting'} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Paintbrush className="h-8 w-8 text-gray-400" />
                              </div>
                            )}
                          </div>
                          <div className="p-2">
                            {img.caption && (
                              <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{img.caption}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              {img.difficulty && (
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${DIFFICULTY_COLORS[img.difficulty] || 'bg-gray-100 text-gray-600'}`}>
                                  {img.difficulty}
                                </span>
                              )}
                              {img.estimated_time_minutes && (
                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {img.estimated_time_minutes} min
                                </span>
                              )}
                            </div>
                          </div>
                          {selectedPaintingId === img.id && (
                            <div className="absolute top-2 right-2 w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center">
                              <Check className="h-4 w-4 text-white" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {paintingSelectionType === 'custom_request' && (
                <Textarea
                  label="Describe Your Custom Painting Idea"
                  rows={4}
                  value={customPaintingRequest}
                  onChange={(e) => setCustomPaintingRequest(e.target.value)}
                  error={errors.customPaintingRequest}
                  placeholder="Tell us about your vision — theme, colors, subject matter, etc."
                />
              )}
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle>Special Requests</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                label="Occasion, theme, or vibe"
                rows={3}
                value={occasionDetails}
                onChange={(e) => setOccasionDetails(e.target.value)}
                placeholder="Birthday for Maya, team celebration, coastal colors, relaxed and social..."
              />
              <Textarea
                label="Food or drink expectations"
                rows={3}
                value={foodDrinkExpectations}
                onChange={(e) => setFoodDrinkExpectations(e.target.value)}
                placeholder="BYOB, snacks, catering, bar package, no food needed..."
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Select label="Best Contact Method" value={preferredContactMethod} onChange={(e) => setPreferredContactMethod(e.target.value)} options={CONTACT_METHOD_OPTIONS} />
                <Select label="Booking Timeline" value={bookingTimeline} onChange={(e) => setBookingTimeline(e.target.value)} options={TIMELINE_OPTIONS} />
                <Select label="Deposit Readiness" value={depositReadiness} onChange={(e) => setDepositReadiness(e.target.value)} options={DEPOSIT_OPTIONS} />
              </div>
              <Input
                label="How did you hear about us?"
                value={referralSource}
                onChange={(e) => setReferralSource(e.target.value)}
                placeholder="Google, Instagram, friend, corporate partner..."
              />
              <Textarea
                label="Accessibility needs"
                rows={3}
                value={accessibilityNeeds}
                onChange={(e) => setAccessibilityNeeds(e.target.value)}
                placeholder="Mobility needs, seating needs, sensory considerations, etc."
              />
              <Textarea
                label="Anything else you'd like us to know?"
                rows={6}
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
                placeholder="Dietary restrictions, accessibility needs, decoration preferences, music requests, or anything else..."
              />
            </CardContent>
          </Card>
        )}

        {step === 5 && (
          <Card>
            <CardHeader>
              <CardTitle>Review Your Request</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <h4 className="font-medium" style={{ color: 'var(--text-primary)' }}>Contact Info</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-gray-500">Name</span><span style={{ color: 'var(--text-primary)' }}>{firstName} {lastName}</span>
                  <span className="text-gray-500">Email</span><span style={{ color: 'var(--text-primary)' }}>{email}</span>
                  <span className="text-gray-500">Phone</span><span style={{ color: 'var(--text-primary)' }}>{phone}</span>
                  {eventType === 'corporate' && (
                    <><span className="text-gray-500">Company</span><span style={{ color: 'var(--text-primary)' }}>{companyName}</span></>
                  )}
                </div>
              </div>

              <hr style={{ borderColor: 'var(--border-color)' }} />

              <div className="space-y-3">
                <h4 className="font-medium" style={{ color: 'var(--text-primary)' }}>Event Details</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-gray-500">Type</span><span style={{ color: 'var(--text-primary)' }}>{EVENT_TYPES.find((t) => t.value === eventType)?.label}</span>
                  <span className="text-gray-500">Preferred Date</span><span style={{ color: 'var(--text-primary)' }}>{preferredDate}</span>
                  {alternateDate && <><span className="text-gray-500">Alternate Date</span><span style={{ color: 'var(--text-primary)' }}>{alternateDate}</span></>}
                  <span className="text-gray-500">Time</span><span style={{ color: 'var(--text-primary)' }}>{TIME_OPTIONS.find((t) => t.value === preferredTime)?.label}</span>
                  <span className="text-gray-500">Guests</span><span style={{ color: 'var(--text-primary)' }}>{guestCount}</span>
                  <span className="text-gray-500">Venue</span><span style={{ color: 'var(--text-primary)' }}>{venues?.find((v) => v.id === venuePreferenceId)?.name || 'No preference'}</span>
                  <span className="text-gray-500">Location</span><span style={{ color: 'var(--text-primary)' }}>{LOCATION_OPTIONS.find((option) => option.value === locationPreference)?.label}</span>
                  <span className="text-gray-500">Flexible Date</span><span style={{ color: 'var(--text-primary)' }}>{dateFlexible === 'yes' ? 'Yes' : 'No'}</span>
                  <span className="text-gray-500">Budget</span><span style={{ color: 'var(--text-primary)' }}>{BUDGET_OPTIONS.find((option) => option.value === budgetRange)?.label || 'Not sure yet'}</span>
                  <span className="text-gray-500">Package</span><span style={{ color: 'var(--text-primary)' }}>{PACKAGE_OPTIONS.find((option) => option.value === packageInterest)?.label}</span>
                </div>
              </div>

              <hr style={{ borderColor: 'var(--border-color)' }} />

              <div className="space-y-3">
                <h4 className="font-medium" style={{ color: 'var(--text-primary)' }}>Painting Selection</h4>
                <div className="text-sm">
                  {paintingSelectionType === 'chosen' && (
                    <div className="grid grid-cols-2 gap-2">
                      <span className="text-gray-500">Painting</span>
                      <span style={{ color: 'var(--text-primary)' }}>
                        {paintableImages?.find((img: GalleryImage) => img.id === selectedPaintingId)?.caption || 'Selected from gallery' }
                      </span>
                    </div>
                  )}
                  {paintingSelectionType === 'owner_chooses' && <span style={{ color: 'var(--text-primary)' }}>Let the owner choose for us</span>}
                  {paintingSelectionType === 'custom_request' && (
                    <div className="grid grid-cols-2 gap-2">
                      <span className="text-gray-500">Custom Request</span>
                      <span style={{ color: 'var(--text-primary)' }}>{customPaintingRequest}</span>
                    </div>
                  )}
                </div>
              </div>

              {(occasionDetails || foodDrinkExpectations || accessibilityNeeds || referralSource || specialRequests) && (
                <>
                  <hr style={{ borderColor: 'var(--border-color)' }} />
                  <div className="space-y-2">
                    <h4 className="font-medium" style={{ color: 'var(--text-primary)' }}>Special Requests</h4>
                    <div className="text-sm space-y-1" style={{ color: 'var(--text-secondary)' }}>
                      {occasionDetails && <p><span className="font-medium">Occasion:</span> {occasionDetails}</p>}
                      {foodDrinkExpectations && <p><span className="font-medium">Food/drink:</span> {foodDrinkExpectations}</p>}
                      <p><span className="font-medium">Contact:</span> {CONTACT_METHOD_OPTIONS.find((option) => option.value === preferredContactMethod)?.label}</p>
                      <p><span className="font-medium">Timeline:</span> {TIMELINE_OPTIONS.find((option) => option.value === bookingTimeline)?.label}</p>
                      <p><span className="font-medium">Deposit:</span> {DEPOSIT_OPTIONS.find((option) => option.value === depositReadiness)?.label}</p>
                      {accessibilityNeeds && <p><span className="font-medium">Accessibility:</span> {accessibilityNeeds}</p>}
                      {referralSource && <p><span className="font-medium">Source:</span> {referralSource}</p>}
                      {specialRequests && <p><span className="font-medium">Additional:</span> {specialRequests}</p>}
                    </div>
                  </div>
                </>
              )}

              <hr style={{ borderColor: 'var(--border-color)' }} />

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmAck}
                  onChange={(e) => { setConfirmAck(e.target.checked); setErrors({}); }}
                  className="mt-1 w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                />
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  I understand this is a request, not a confirmed booking. A team member will contact me to finalize details and availability.
                </span>
              </label>
              {errors.confirm && <p className="text-sm text-red-600">{errors.confirm}</p>}
              {errors.submit && <p className="text-sm text-red-600">{errors.submit}</p>}
            </CardContent>
          </Card>
        )}

        <div className="flex justify-between mt-6">
          {step > 1 ? (
            <Button variant="outline" onClick={prevStep}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          ) : (
            <div />
          )}
          {step < 5 ? (
            <Button onClick={nextStep}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitMutation.isPending}>
              {submitMutation.isPending ? 'Submitting...' : 'Submit Request'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
