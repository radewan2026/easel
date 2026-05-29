import { Link } from 'react-router-dom';
import { useEvents } from '../../hooks/useEvents';
import { formatCurrency } from '../../lib/utils';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import PrivatePartyModal from '../../components/public/PrivatePartyModal';
import SEO from '../../components/SEO';

const HERO_IMAGE = 'https://lh3.googleusercontent.com/aida-public/AB6AXuCi5X2dK9dbCZL2CbIFaI4Lhc-OybYZZH9hvz_DfPNPFgeDxJcKJpGYXCpvJ1CTQmPsq-7DACdTXKs2Z6tPIdLsR2OmGi_xyCdirOLx0unB_Yfv1TPFS98M3_CDPOJd1NAVnEP7hcdjEaVI3_e06ZGiu5svvrSOPxdghQ3FN_P28BG8hEBzpWP52ut6BZCHZvGisoe1KIcrH1Hf-4nHICc9_AXaLaRGPtivE2iXMHkt8du6hztt7ofRvRiLpjZPCH1ZE96z33hhZb0';

const OCCASIONS = [
  { icon: 'favorite', label: 'Date Night', href: '/events' },
  { icon: 'celebration', label: "Girls' Night", href: '/events' },
  { icon: 'groups', label: 'Team Event', href: '/events' },
  { icon: 'cake', label: 'Birthday', href: '/events' },
  { icon: 'diamond', label: 'Bridal Shower', href: '/events' },
  { icon: 'redeem', label: 'Gift Card', href: '/gift-cards', dark: true },
];

const HOW_IT_WORKS = [
  { num: '1', title: 'Choose Your Session', desc: 'Pick a painting, date, and seat count from the live workshop calendar.' },
  { num: '2', title: 'Arrive Ready to Relax', desc: 'Your canvas, brushes, apron, and first pour are waiting at your station.' },
  { num: '3', title: 'Leave With Your Canvas', desc: 'Follow friendly guidance, add your own style, and take home the finished piece.' },
];

const BOOKING_FEATURES = [
  { icon: 'event_available', title: 'Book in Seconds', desc: 'Choose a date, painting, and seat count without back-and-forth.' },
  { icon: 'local_bar', title: 'Arrive to Setup', desc: 'Your station, supplies, and first pour are ready when you walk in.' },
  { icon: 'brush', title: 'Paint With Help', desc: 'Friendly instruction keeps the night relaxed, even for first-timers.' },
  { icon: 'wall_art', title: 'Leave With Art', desc: 'Take home a finished canvas and a photo-ready memory.' },
];

const FAQ_ITEMS = [
  { q: 'Do I need painting experience?', a: 'Not at all. Every workshop is beginner-friendly, guided step by step, and flexible enough for guests who want to add their own style.' },
  { q: 'What is included with a seat?', a: 'Your canvas, paints, brushes, apron, guided instruction, and the finished piece you take home. Food and drink options vary by session.' },
  { q: 'Can I book a private event?', a: 'Yes. Private events are available for birthdays, bridal showers, corporate teams, client nights, and studio buyouts. Share your date, guest count, and occasion to check availability.' },
  { q: 'What if I am running late or need to cancel?', a: 'Arrive 10–15 minutes early if you can. Cancellation and credit policies depend on the session type, and private events have their own deposit terms.' },
  { q: 'Do gift cards expire?', a: 'Gift cards can be used toward workshops, private events, and select studio experiences.' },
];

const CLIENT_LOGOS = [
  { name: 'Northstar', suffix: 'DESIGN CO.', color: '#ac3400' },
  { name: 'Evergreen', suffix: 'WELLNESS', color: '#3f6f52' },
  { name: 'Union', suffix: 'BANK', color: '#0f172a' },
  { name: 'Luma', suffix: 'STUDIO', color: '#fd6b36' },
  { name: 'Harbor', suffix: 'HOMES', color: '#456273' },
  { name: 'Aster', suffix: 'EVENTS', color: '#ac3400' },
];

const INSTRUCTORS = [
  { name: 'Julian Thorne', role: 'Lead Instructor', bio: 'Guides landscape and texture sessions with calm, step-by-step instruction.', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD2BIRbRZxbLK6CPlCPFwonPajC7zZuAVBDyNIdAk-xEAu-VV0-7Uu0T4erUsJznpqbthHt58sMZRyIB-54cBkudD8gF0CPQ3P7xZ6YRcwA5IDuHdETncyActDSN0L8vhsG0Zy3-vfSCFFx263458f4uj2bFHZmNd2zZsNPU7pIrHZ3XZeYV8QfNl4-dOz4eA7qhLSyozNPNB9tY0IstcWsJO37UyBXxvLLUn48osClVHT_utKTzoS2kADSYfuXTSIjm8m8uHXUYb4' },
  { name: 'Sienna Miller', role: 'Workshop Instructor', bio: 'Keeps floral, abstract, and date-night classes light, social, and easy to follow.', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB5YMBR5jbCLub4l4_eXWtF3I_JXYZbwjnAlGbczNZjFn8muMMOmTKqIJEYvrz1mxm4NpYus3Rb0kl_TJzOBlKXIdMIzzsTwhY0VI_VQ3DN2gRDaE4kE6LuAGCPWq8me8Gd8A8PcqOFZboEvtBJ_SHrybRHodKGvkRM3pXBg1YdKzZEiBlp_L6S2iAj7OjIic9Pr31885mxz3h4sNdZcFbplsx-EjWY-EOt4sy0oGRQsOmsriHnU_untqbeKar1msCdTlPCvi-sULM' },
  { name: 'Marcus Chen', role: 'Private Event Instructor', bio: 'Specializes in group formats, pet portraits, and collaborative team canvases.', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCVdEqlIZL3HXmlWCE1dGAZMoPxc5ue_V3NUeBkyXwuQlhVmNDZ-mEZq8YiEqJUPGUijK6-d8trJ4robfzWYA0pEcd7dCgSpDtDgEahoJTO3HA0AH5rgaaqiK5jyrTx854T1MSW01uwpVxtInNMCIie9EpFwO0V6SsMjJ5dDP2_PJMSWqJ5e-rNgQj_D9deQPoBiEFiXuwp-SOASWH0C8PI1JHLf6WjQQZ5o9V_d89b9dcM5S0XJhOa19gdyg3hPNOphXTx92VTjsE' },
];

const GALLERY_IMAGES = [
  { url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAS97_i2w7VyNJob_fTGrfhAxnGxMCqhDkk3Sk-Db_2NjBdkEHzx-xpim-YIxYa2X7TKm1Z7BOarndGjXpR6H9MmmjftDO3KH8paYs7xwGCJAnCevOUD53vl7wRT_lFX14LzMTx3LkJv8BJb4byARUhNtARmbeVG7vSFCDa2eQiXqHRrks5YiDbKFH5bQFM57Wj_j_ocRqDqUhwQz6ll2uHSjq46SIWRTb5Xn5uRSSzhLrtnkTygYUeDjibSclqdosjPCIngcYz_e4', tall: true },
  { url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBBURH3--Yhsmgqk5Q9VSvChi3kD0QAV_Gj7ctINU6l8sCQ6RmnAH2zxkIjLDe__XmKHNHddlJdiZFl83oLsWvl2jiYFaXqFgiUKokouFr1WFyrDLQO5IhWZJiNJaHyO9xIw_U_0GE4T2FZeo5sNJnaoKcu45o_3PGakf_InlD1_WAlY9y84iBTjJhh9vIViLzZVzpIQ_sdHvsWVALWvvQDUDmAk9n8rQxDve9xUosSd684bO21HM7YaBmHo9ZLyY5w1e8LbvR45g4' },
  { url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCDOya3YD-nusbjMa-boyWujDJpNHo0jw8VDpnx_8XdwIOytU6HpZ7TOyUqW_aTUzZcXDsEYuVyBt01A_NvStS42X-Oc0oCMiNc1Vp6ag6wuRU6wWx-A6L2Plu2yRcw3Z-Xw5n6Yxv1ckWB25jaLuFUrxWtfChbeQq40w1EkyHBOEAEFT4u8jzbMjLyxwsItfXp5m-Ooe4GryHrM7eFY4uBIkMNTZxAMmmXCDQjsbPWpaBjaSDI_ittqsEoIi2vqY4FRyXtOxAeSaM', wide: true },
  { url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA5qUdTqnZOLRH2edPswvuhS_oR7BBXSGiRkRGF_gj807PVG925e8lm98dmeKdsLIcbAv-3QpT6RfBy6Q1NwE4tD41mfjd9_Dis6isnbBEWUyuvnVtLtNWaj5Ugk-Fhj6uMUVHCt0DBgENzPk1S7V960YCiHaO7EH9L-oP_dGGKZMds8__WkmZrblEgAOo4w7gEjT525KMi_V9Q13yYrO3UHSrrEpKl-UvPeyj9nw3d-KDl7B9VRzQvhVpxU7jWVcHniP8xwm8fE-Q' },
  { url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBeaP2_vCtSg6MyBUpfe157XRn6Fq_Q8C3GGLFLfDYwpVKgrRvIUV85fA4cRdavuZEB8NO-wwk48Zzv7K8TC085iMb0FTPe9W1lw6Eu6u33eMZAea30-w1OBzf2h_JybcJMoQFuCxig5OmFz0_ZzohJ_P7cSi0IDSbnF9Ujn0h5eiolLNM3gsrov_RW1F5r6Kkf0hNTfJFSLRdUsOM-byEuqj3uKMpGtKi_k42zFJ02Jpv1LIylZUHQY74u5kvYjpmKaaEH8Rl1T6M', tall: true },
  { url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB7zmX1VAR08nz52chgVS4UsCD4Zf3q0xvJqUWNZZX4uugAfKQ4caIQRM34KCe2WlTPKSM1LAdwuCmqFgB0g70nX46oBT7HmE2u_ZsKID7NtCFBJhRyY-FcLRyPdiJsVELRw4IeFUy100zBsKPjqvzTRHijCilP677M6lOFz9-THqJvYwdBaMvpa05Qv8XIXtsGKERmdCxx0VD9cJrJbs7yfJTy_GZ7XN7TuiWYMnEeGJSRbCJBIBg7-SEt-1v3_Y_Dhyp68rEFWNw' },
];

export default function HomePage() {
  const { data: events, isLoading } = useEvents({ published: true });
  const [showPrivateParty, setShowPrivateParty] = useState(false);
  const [newsletterStatus, setNewsletterStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [activeStory, setActiveStory] = useState(0);

  const upcoming = events?.filter(e => new Date(e.start_datetime) > new Date()) || [];
  const nextThree = upcoming.slice(0, 3);

  const { data: testimonials } = useQuery({
    queryKey: ['homeTestimonials'],
    queryFn: async () => {
      const { data } = await supabase
        .from('testimonials')
        .select('*, event:events(title)')
        .eq('is_published', true)
        .eq('is_deleted', false)
        .eq('is_featured', true)
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  useEffect(() => {
    if (!testimonials || testimonials.length <= 1) return;
    const interval = setInterval(() => {
      setActiveStory(prev => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [testimonials]);

  return (
    <div>
      <SEO title="Refined Paint & Sip Studio" description="Join us for guided painting, good wine, and a creative night out. No experience required." />

      {/* ── Hero ── */}
      <header className="relative h-[921px] flex items-center justify-center overflow-hidden pt-16 md:pt-20" id="hero">
        <div className="absolute inset-0 z-0">
          <img className="w-full h-full object-cover scale-105" src={HERO_IMAGE} alt="Paint and sip studio" />
          <div className="absolute inset-0 bg-gradient-to-r from-tertiary-container/70 via-tertiary-container/40 to-transparent"></div>
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-8 w-full">
          <div className="max-w-2xl">
            <h1 className="text-6xl md:text-7xl font-bold leading-tight text-white font-display-lg">
              Uncork Your <span className="text-secondary-container">Inner Artist</span>
            </h1>
            <p className="text-body-lg text-surface-bright mb-8 opacity-90 leading-relaxed max-w-xl">
              A polished night out with guided painting, good wine, and everything ready when you arrive. No experience required, just a spirit of curiosity.
            </p>
            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
              <button
                onClick={() => document.getElementById('workshops')?.scrollIntoView({ behavior: 'smooth' })}
                className="bg-secondary text-white px-8 py-4 rounded-lg font-label-md transition-all hover:shadow-[0_20px_40px_rgba(172,52,0,0.3)] hover:-translate-y-1"
              >
                View Workshop Schedule
              </button>
              <button
                onClick={() => setShowPrivateParty(true)}
                className="border border-white/50 text-white px-8 py-4 rounded-lg font-label-md hover:bg-white/10 backdrop-blur-sm transition-all"
              >
                Explore Private Events
              </button>
            </div>
            <p className="mt-5 text-sm text-surface-bright/80">Trusted for 500+ private events and thousands of studio nights.</p>
            <div className="hidden sm:grid grid-cols-4 gap-4 mt-10 max-w-2xl">
              <div className="border-l border-white/30 pl-4"><p className="text-white text-2xl font-headline-md font-bold">4.9</p><p className="text-surface-bright/80 text-sm">Guest rating</p></div>
              <div className="border-l border-white/30 pl-4"><p className="text-white text-2xl font-headline-md font-bold">500+</p><p className="text-surface-bright/80 text-sm">Private events</p></div>
              <div className="border-l border-white/30 pl-4"><p className="text-white text-2xl font-headline-md font-bold">All</p><p className="text-surface-bright/80 text-sm">Supplies included</p></div>
              <div className="border-l border-white/30 pl-4"><p className="text-white text-2xl font-headline-md font-bold">100%</p><p className="text-surface-bright/80 text-sm">Beginner-friendly</p></div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Upcoming Classes Strip ── */}
      <section className="relative z-20 -mt-20 px-8">
        <div className="max-w-7xl mx-auto bg-white rounded-2xl shadow-2xl border border-surface-container-highest overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_1fr_auto]">
            {isLoading ? (
              <div className="p-6 lg:col-span-4 text-center text-on-surface-variant">Loading events...</div>
            ) : nextThree.length === 0 ? (
              <div className="p-6 lg:col-span-4 text-center text-on-surface-variant">No upcoming events — check back soon!</div>
            ) : nextThree.map((event) => (
              <div key={event.id} className="p-6 border-b lg:border-b-0 lg:border-r border-surface-container-highest">
                <p className="text-sm uppercase tracking-[0.2em] text-secondary font-label-md mb-2">
                  {new Date(event.start_datetime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </p>
                <h3 className="text-lg font-bold font-headline-md mb-1">{event.title}</h3>
                <p className="text-on-surface-variant text-sm">
                  {new Date(event.start_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &bull; {event.base_price_per_seat ? `${formatCurrency(event.base_price_per_seat)}` : 'Free'}
                </p>
              </div>
            ))}
            <div className="p-6 flex items-center justify-center">
              <Link
                to="/events"
                className="bg-tertiary-container text-white px-8 py-4 rounded-lg font-label-md hover:bg-secondary transition-all shadow-lg whitespace-nowrap"
              >
                Reserve a Class
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Why Book Direct ── */}
      <section className="px-8 pt-14">
        <div className="max-w-7xl mx-auto bg-tertiary-container text-white rounded-2xl overflow-hidden shadow-xl">
          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_2fr]">
            <div className="p-8 md:p-10 border-b lg:border-b-0 lg:border-r border-white/10">
              <p className="text-secondary-fixed-dim uppercase tracking-[0.28em] mb-3 font-label-md">Why Book Direct</p>
              <h2 className="text-3xl md:text-4xl font-bold font-headline-md">Everything handled, start to finish.</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {BOOKING_FEATURES.map((f) => (
                <div key={f.title} className="p-7 border-b sm:border-r lg:border-b-0 border-white/10">
                  <span className="material-symbols-outlined text-secondary-container mb-4 block text-3xl">{f.icon}</span>
                  <h3 className="text-lg font-bold font-headline-md mb-2">{f.title}</h3>
                  <p className="text-sm text-white/70 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="px-8 py-20 max-w-7xl mx-auto">
        <div className="border-y border-surface-container-highest py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {HOW_IT_WORKS.map((step) => (
              <div key={step.num} className="flex items-start gap-5">
                <div className="w-12 h-12 rounded-full bg-secondary text-white flex items-center justify-center text-xl font-headline-md font-bold flex-shrink-0">{step.num}</div>
                <div>
                  <h3 className="text-lg font-bold font-headline-md mb-2">{step.title}</h3>
                  <p className="text-body-md text-on-surface-variant">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Occasions ── */}
      <section className="px-8 pb-20 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-8">
          <div>
            <p className="text-secondary uppercase tracking-[0.28em] mb-3 font-label-md">Plan by Occasion</p>
            <h2 className="text-4xl md:text-5xl font-bold font-display-lg">What Are You Celebrating?</h2>
          </div>
          <p className="text-body-lg text-on-surface-variant max-w-xl">Start with the moment, then choose the canvas. Every option leads to classes, private events, or gift cards.</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          {OCCASIONS.map((oc) => (
            <Link
              key={oc.label}
              to={oc.href}
              className={`rounded-xl p-5 text-left shadow-sm hover:-translate-y-1 hover:shadow-xl transition-all border ${
                oc.dark
                  ? 'bg-tertiary-container text-white border-tertiary-container'
                  : 'bg-white text-on-surface border-surface-container-highest'
              }`}
            >
              <span className={`material-symbols-outlined mb-6 block text-3xl ${oc.dark ? 'text-secondary-container' : 'text-secondary'}`}>{oc.icon}</span>
              <span className="block text-xl font-bold font-headline-md">{oc.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Workshops ── */}
      <section className="bg-surface-container-low py-20" id="workshops">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold font-display-lg mb-4">Curated Workshops</h2>
              <p className="text-body-lg text-on-surface-variant">Find the perfect session for your next creative escape.</p>
            </div>
            <Link to="/events" className="text-secondary font-label-md flex items-center border-b-2 border-secondary pb-1 mt-4 md:mt-0 hover:gap-2 transition-all">
              See All Workshops
              <span className="material-symbols-outlined ml-2 text-sm">arrow_forward</span>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {upcoming.slice(0, 6).map((event) => (
              <div key={event.id} className="workshop-card bg-surface-container-lowest rounded-xl overflow-hidden group hover:shadow-2xl transition-all duration-500">
                <div className="aspect-[4/5] overflow-hidden relative">
                  {event.main_image_url ? (
                    <img src={event.main_image_url} alt={event.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-surface-container-high text-on-surface-variant">
                      <span className="material-symbols-outlined text-5xl">palette</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="p-8">
                  <div className="flex justify-between items-start mb-4">
                    <span className="bg-secondary/10 text-secondary px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
                      Workshop
                    </span>
                    <span className="text-sm font-label-md text-on-surface">
                      {event.base_price_per_seat ? formatCurrency(event.base_price_per_seat) : 'Free'}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold font-headline-md mb-2 group-hover:text-secondary transition-colors">{event.title}</h3>
                  <p className="text-body-md text-on-surface-variant">
                    {new Date(event.start_datetime).toLocaleDateString('en-US', { weekday: 'long', hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <div className="quick-view" />
                  <Link
                    to={`/events/${event.slug}`}
                    className="reserve-btn block w-full mt-6 py-4 border border-tertiary-container text-tertiary-container font-label-md transition-all rounded-lg text-center hover:bg-secondary hover:text-white hover:border-secondary"
                  >
                    Reserve Seat
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Gift Cards ── */}
      <section className="py-20 px-8 bg-surface-bright" id="gift-cards">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-5">
            <p className="text-secondary uppercase tracking-[0.28em] mb-4 font-label-md">Gift Cards</p>
            <h2 className="text-4xl md:text-5xl font-bold font-display-lg mb-6">Give Them a Night Worth Framing</h2>
            <p className="text-body-lg text-on-surface-variant mb-8 leading-relaxed">
              A Paint & Sip gift card turns date nights, birthdays, team thank-yous, and last-minute celebrations into a polished studio experience they can choose on their own schedule.
            </p>
            <Link to="/gift-cards" className="bg-secondary text-white px-10 py-5 rounded-lg font-label-md hover:bg-secondary-container transition-all duration-300 shadow-xl hover:-translate-y-1 inline-block">
              Purchase a Gift Card
            </Link>
          </div>
          <div className="lg:col-span-7 relative min-h-[520px]">
            <div className="absolute inset-0 rounded-2xl overflow-hidden shadow-2xl">
              <img className="w-full h-full object-cover" src="https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?auto=format&fit=crop&w=1400&q=80" alt="Gift card" />
              <div className="absolute inset-0 bg-gradient-to-tr from-tertiary-container/70 via-tertiary-container/20 to-transparent" />
            </div>
            <div className="absolute left-6 right-6 bottom-6 md:left-10 md:right-auto md:w-[420px] bg-white/95 backdrop-blur-md rounded-xl p-7 shadow-2xl border border-white/60">
              <div className="flex justify-between items-start mb-10">
                <div>
                  <p className="text-secondary uppercase tracking-[0.2em] mb-2 font-label-md">Paint & Sip</p>
                  <p className="text-3xl font-bold font-headline-md text-tertiary-container">Studio Gift Card</p>
                </div>
                <span className="material-symbols-outlined text-secondary text-4xl">redeem</span>
              </div>
              <div className="flex items-end justify-between border-t border-surface-container-highest pt-6">
                <div>
                  <p className="text-sm text-on-surface-variant mb-1">Valid for</p>
                  <p className="text-body-md font-semibold">Workshops, private events, and studio experiences</p>
                </div>
                <p className="text-4xl font-display-lg text-secondary">$__</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Guest Stories ── */}
      {testimonials && testimonials.length > 0 && (
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
              <div className="relative">
                <div className="story-card bg-tertiary-container p-12 rounded-2xl relative z-10 shadow-2xl group transition-all duration-500 hover:-rotate-1 cursor-default">
                  <span className="material-symbols-outlined text-secondary text-5xl mb-6 block" style={{ fontVariationSettings: "'FILL' 1" }}>format_quote</span>
                  <p className="text-headline-md text-white italic mb-8">{testimonials[activeStory]?.content}</p>
                  <div className="flex items-center">
                    {testimonials[activeStory]?.author_image_url ? (
                      <div className="w-12 h-12 rounded-full overflow-hidden mr-4 border-2 border-secondary/30">
                        <img className="w-full h-full object-cover" src={testimonials[activeStory].author_image_url} alt={testimonials[activeStory].author_name} />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-full mr-4 border-2 border-secondary/30 flex items-center justify-center bg-secondary/20 text-white font-bold">{testimonials[activeStory]?.author_name?.charAt(0)}</div>
                    )}
                    <div>
                      <p className="text-white font-bold">{testimonials[activeStory]?.author_name}</p>
                      {testimonials[activeStory]?.event && (
                        <p className="text-secondary-fixed-dim text-sm">{testimonials[activeStory].event.title}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-8">
                    {testimonials.map((_, idx) => (
                      <span key={idx} className={`story-dot h-2 w-2 rounded-full transition-all duration-300 cursor-pointer ${idx === activeStory ? 'active' : 'bg-white/30'}`} onClick={() => setActiveStory(idx)} />
                    ))}
                  </div>
                </div>
                <div className="absolute -top-4 -left-4 w-full h-full border-2 border-secondary rounded-2xl z-0" />
              </div>
              <div>
                <h2 className="text-4xl md:text-5xl font-bold font-display-lg mb-8">Guest Stories</h2>
                <p className="text-body-lg text-on-surface-variant mb-8">Discover why our guests return month after month for our unique blend of fine arts and social connection.</p>
                <div className="space-y-8">
                  {testimonials.slice(0, 2).map((t) => (
                    <div key={t.id} className="flex items-start space-x-6 border-b border-surface-container-highest pb-8 group">
                      <div className="w-20 h-20 flex-shrink-0 rounded-full bg-surface-container-high flex items-center justify-center text-4xl font-display-lg text-secondary shadow-sm group-hover:bg-secondary group-hover:text-white transition-all duration-300">
                        {t.author_name?.charAt(0) || '?'}
                      </div>
                      <div className="pt-2">
                        <p className="text-body-md italic text-on-surface-variant text-lg">"{t.content}" <span className="font-bold text-on-surface block mt-2 group-hover:text-secondary transition-colors">— {t.author_name}</span></p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Gallery ── */}
      <section className="bg-tertiary-container py-20 overflow-hidden" id="gallery">
        <div className="max-w-7xl mx-auto px-8 mb-16 flex flex-col md:flex-row justify-between items-start md:items-end">
          <div>
            <h2 className="text-4xl md:text-5xl font-bold font-display-lg text-white mb-4">Fresh From the Studio</h2>
            <div className="h-1 w-24 bg-secondary" />
          </div>
          <p className="text-secondary-fixed-dim tracking-[0.4em] mt-6 md:mt-0 uppercase font-label-md">#CANVASCORKMOMENTS</p>
        </div>
        <div className="gallery-grid gap-6 px-8 max-w-[1400px] mx-auto">
          {GALLERY_IMAGES.map((img, i) => (
            <div key={i} className={`gallery-item rounded-xl overflow-hidden shadow-2xl border border-white/5 ${img.tall ? 'tall' : ''} ${img.wide ? 'wide' : ''}`}>
              <img className="w-full h-full object-cover" src={img.url} alt={`Studio moment ${i + 1}`} />
            </div>
          ))}
        </div>
      </section>

      {/* ── Private Events ── */}
      <section className="py-20 px-8 bg-surface-bright" id="events">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-4xl md:text-5xl font-bold font-display-lg mb-8">Elevate Your Next Gathering</h2>
            <p className="text-body-lg text-on-surface-variant mb-8 leading-relaxed">
              From team nights to birthdays and bridal showers, we make private events feel easy to plan and special to attend.
            </p>
            <div className="space-y-6 mb-10">
              {['Custom Branding Options for Corporate Teams', 'Food, beverage, and add-on options', 'Full Studio Buyout Availability'].map((item) => (
                <div key={item} className="flex items-center group">
                  <span className="w-8 h-8 rounded-full cork-progress flex items-center justify-center text-white mr-4">
                    <span className="material-symbols-outlined text-sm">check</span>
                  </span>
                  <span className="text-body-md font-semibold">{item}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-4 max-w-lg">
              <div><p className="text-3xl font-bold font-headline-md text-secondary">12-80</p><p className="text-sm text-on-surface-variant">Guests</p></div>
              <div><p className="text-3xl font-bold font-headline-md text-secondary">2 hrs</p><p className="text-sm text-on-surface-variant">Typical event</p></div>
              <div><p className="text-3xl font-bold font-headline-md text-secondary">48 hr</p><p className="text-sm text-on-surface-variant">Reply window</p></div>
            </div>
          </div>
          <div className="relative">
            <img className="rounded-2xl shadow-2xl w-full h-[560px] object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBH6TpLmKH_LN0p2XGD6ZAsn1EJxMEkS4fDzgSPOEXS6XJ7OBJYRl_ACeTP89fuSkSv8_6v9Yr4vXlu3Ue0aBZw1eHZ6mVTy3ZoMvVqtaKRwAY-LJ7kaMfqhHc5F5agKXNxFiZJ35PTpgzYVobzKyfh4OMdZwSu89Pqp8FlKmYHqCOi4zX8lLRgd2BfRwAhKEhum1CHOAG5jYk7FhrNdIf7PHkIeRM6SqKU5YISIQqeCS5MU7yFakgg7V1gITc7jbE9DnMkgg8DPCg" alt="Private event" />
            <div className="absolute inset-0 rounded-2xl bg-tertiary-container/35" />
            <div className="absolute left-6 right-6 bottom-6 bg-white/95 backdrop-blur-md rounded-xl p-7 shadow-2xl border border-white/70">
              <h3 className="text-xl md:text-2xl font-bold font-headline-md mb-5">Plan a Private Event</h3>
              <button
                onClick={() => setShowPrivateParty(true)}
                className="w-full bg-secondary text-white px-8 py-4 rounded-lg font-label-md hover:bg-tertiary-container transition-all shadow-lg"
              >
                Get a Private Event Quote
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Client Logos ── */}
      <section className="px-8 pb-20 bg-surface-bright">
        <div className="max-w-7xl mx-auto border-y border-surface-container-highest py-10">
          <div className="flex flex-col lg:flex-row lg:items-center gap-8 lg:gap-12">
            <div className="lg:w-72 flex-shrink-0">
              <p className="text-secondary uppercase tracking-[0.24em] mb-2 font-label-md">Private Events</p>
              <h3 className="text-xl md:text-2xl font-bold font-headline-md">Booked for team nights, client events, birthdays, and showers.</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 flex-1">
              {CLIENT_LOGOS.map((logo) => (
                <div key={logo.name} className="bg-white rounded-lg border border-surface-container-highest h-28 flex items-center justify-center px-4 shadow-sm grayscale hover:grayscale-0 transition-all duration-300">
                  <div className="text-center">
                    <div className="w-8 h-8 mx-auto mb-1 rounded" style={{ backgroundColor: logo.color }} />
                    <p className="text-xs font-bold font-display-lg text-slate-800">{logo.name}</p>
                    <p className="text-[9px] tracking-widest text-slate-500">{logo.suffix}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Instructors ── */}
      <section className="py-20 px-8 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold font-display-lg mb-4">Meet Your Instructors</h2>
          <p className="text-body-lg text-on-surface-variant max-w-2xl mx-auto">Learn from welcoming artists who know how to guide first-timers, groups, and guests who want to make the night their own.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {INSTRUCTORS.map((inst) => (
            <div key={inst.name} className="text-center group">
              <div className="w-48 h-48 rounded-full overflow-hidden mx-auto grayscale group-hover:grayscale-0 transition-all duration-700 border-4 border-transparent group-hover:border-secondary group-hover:scale-105 shadow-xl mb-6">
                <img className="w-full h-full object-cover" src={inst.img} alt={inst.name} />
              </div>
              <h3 className="text-lg font-bold font-headline-md mb-2 group-hover:text-secondary transition-colors">{inst.name}</h3>
              <p className="text-sm text-secondary font-label-md mb-4">{inst.role}</p>
              <p className="text-body-md text-on-surface-variant max-w-[280px] mx-auto">{inst.bio}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-20 px-8 bg-surface-container-low" id="faq">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-4">
            <p className="text-secondary uppercase tracking-[0.28em] mb-4 font-label-md">FAQ</p>
            <h2 className="text-4xl md:text-5xl font-bold font-display-lg mb-6">Good to Know Before You Book</h2>
            <p className="text-body-lg text-on-surface-variant">A few quick answers for first-timers, group hosts, and last-minute planners.</p>
            <div className="mt-8 rounded-xl border border-surface-container-highest bg-white p-6 shadow-sm">
              <p className="text-secondary uppercase tracking-[0.2em] mb-3 font-label-md">Arrival Note</p>
              <p className="text-body-md text-on-surface-variant">Plan to arrive 10–15 minutes early so you can settle in, choose a drink, and start relaxed. Private events may require a deposit to hold the date.</p>
            </div>
          </div>
          <div className="lg:col-span-8 bg-white rounded-2xl shadow-xl border border-surface-container-highest overflow-hidden">
            {FAQ_ITEMS.map((faq, idx) => (
              <details key={idx} className="group border-b border-surface-container-highest last:border-b-0" open={openFaq === idx} onToggle={(e) => { if ((e.target as HTMLDetailsElement).open) setOpenFaq(idx); }}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 p-7">
                  <span className="text-xl md:text-2xl font-bold font-headline-md">{faq.q}</span>
                  <span className="faq-icon material-symbols-outlined text-secondary transition-transform flex-shrink-0">add</span>
                </summary>
                <p className="text-body-md text-on-surface-variant px-7 pb-7 max-w-2xl">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Newsletter CTA ── */}
      <section className="py-20 px-8">
        <div className="max-w-4xl mx-auto bg-tertiary-container rounded-3xl p-12 text-center text-white relative overflow-hidden group">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-secondary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
          <div className="relative z-10">
            <h2 className="text-4xl md:text-5xl font-bold font-display-lg mb-6">Join The Circle</h2>
            <p className="text-body-lg mb-8 opacity-80 max-w-xl mx-auto">Be the first to know about new class drops, seasonal wine tastings, and exclusive members-only events.</p>
            <form className="flex flex-col md:flex-row gap-4 max-w-lg mx-auto" onSubmit={async (e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const email = new FormData(form).get('email') as string;
              if (!email) return;
              try {
                const res = await fetch('/api/newsletter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
                if (!res.ok) throw new Error('Network error');
                form.reset();
                setNewsletterStatus('success');
              } catch {
                setNewsletterStatus('error');
              }
            }}>
              <input name="email" type="email" placeholder="Your email address" required className="flex-1 bg-white/10 border border-white/20 rounded-lg px-6 py-4 focus:ring-2 focus:ring-secondary outline-none transition-all placeholder:text-white/50 backdrop-blur-sm text-white" />
              <button type="submit" className="bg-secondary text-white px-8 py-4 rounded-lg font-label-md hover:bg-secondary-container transition-all shadow-lg hover:shadow-secondary/20 whitespace-nowrap">Subscribe</button>
            </form>
            {newsletterStatus === 'success' && (
              <p className="mt-4 text-sm text-green-300">You're on the list! Welcome to the circle.</p>
            )}
            {newsletterStatus === 'error' && (
              <p className="mt-4 text-sm text-red-300">Something went wrong. Please try again or email us directly.</p>
            )}
            <p className="mt-6 text-sm opacity-50">Refined updates only. No spam, ever.</p>
          </div>
        </div>
      </section>

      <PrivatePartyModal isOpen={showPrivateParty} onClose={() => setShowPrivateParty(false)} />
    </div>
  );
}
