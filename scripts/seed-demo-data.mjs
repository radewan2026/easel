import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://geibiaopohlnmpwqaxit.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_2bV7Ha2apgrfLG68XWlcxw_YIf1YTBJ';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const dayMs = 24 * 60 * 60 * 1000;
const now = new Date();
const iso = (offsetDays, hour = 18, minute = 30) => {
  const date = new Date(now.getTime() + offsetDays * dayMs);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
};
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

async function upsert(table, rows, onConflict = 'id') {
  if (!rows.length) return [];
  let sanitizedRows = rows;
  let data;
  const removedColumns = [];

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const response = await supabase.from(table).upsert(sanitizedRows, { onConflict }).select('*');
    data = response.data;

    if (!response.error) {
      if (removedColumns.length) console.log(`  omitted ${table} columns not in live schema: ${removedColumns.join(', ')}`);
      console.log(`seeded ${table}: ${rows.length}`);
      return data || [];
    }

    const missingColumn = response.error.message.match(/'([^']+)' column/)?.[1];
    if (!missingColumn) throw new Error(`${table}: ${response.error.message}`);

    removedColumns.push(missingColumn);
    sanitizedRows = sanitizedRows.map(({ [missingColumn]: _removed, ...row }) => row);
  }

  throw new Error(`${table}: too many schema mismatches (${removedColumns.join(', ')})`);
}

async function tryUpsert(table, rows, onConflict = 'id') {
  try {
    return await upsert(table, rows, onConflict);
  } catch (error) {
    console.warn(`skipped ${table}: ${error.message}`);
    return [];
  }
}

async function verifyTableCount(table) {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
  if (error) {
    console.warn(`verify ${table}: ${error.message}`);
    return null;
  }
  console.log(`verify ${table}: ${count ?? 0} visible rows`);
  return count ?? 0;
}

const venues = [
  { id: id(1), name: 'Lake Tahoe Studio', address_line1: '1120 Lakeshore Blvd', address_line2: null, city: 'South Lake Tahoe', state: 'CA', postal_code: '96150', phone: '(530) 555-0148', capacity: 52, notes: 'Main studio with lake-facing windows, retail wall, and private tasting nook.', is_active: true, is_deleted: false },
  { id: id(2), name: 'Truckee Taproom Pop-Up', address_line1: '88 Donner Pass Rd', address_line2: null, city: 'Truckee', state: 'CA', postal_code: '96161', phone: '(530) 555-0182', capacity: 36, notes: 'Partner venue for weeknight public classes and corporate happy hours.', is_active: true, is_deleted: false },
  { id: id(3), name: 'Incline Village Event Room', address_line1: '720 Mountain View Dr', address_line2: 'Suite B', city: 'Incline Village', state: 'NV', postal_code: '89451', phone: '(775) 555-0199', capacity: 28, notes: 'Quiet private-event room for birthdays and small team sessions.', is_active: true, is_deleted: false },
];

const employees = [
  { id: id(101), name: 'Sarah Kim', email: 'sarah.kim@paintandsip.local', phone: '(530) 555-1101', role: 'instructor', hourly_rate: 38, stripe_account_id: null, stripe_onboarding_complete: false, status: 'active', availability_days: ['Tuesday', 'Thursday', 'Saturday'], account_id: null, notes: 'Lead landscape instructor; great for larger public classes.', password_hash: null, avatar_url: null, admin_role: 'manager', permissions: null, overtime_multiplier: 1.5 },
  { id: id(102), name: 'Mike Torres', email: 'mike.torres@paintandsip.local', phone: '(530) 555-1102', role: 'artist', hourly_rate: 34, stripe_account_id: null, stripe_onboarding_complete: false, status: 'active', availability_days: ['Wednesday', 'Friday', 'Sunday'], account_id: null, notes: 'Strong with acrylic abstracts and corporate groups.', password_hash: null, avatar_url: null, admin_role: 'staff', permissions: { events: true, attendees: true, timeTracking: true }, overtime_multiplier: 1.5 },
  { id: id(103), name: 'Jenna Park', email: 'jenna.park@paintandsip.local', phone: '(530) 555-1103', role: 'host', hourly_rate: 24, stripe_account_id: null, stripe_onboarding_complete: false, status: 'active', availability_days: ['Friday', 'Saturday'], account_id: null, notes: 'Front desk, retail, and private-party host.', password_hash: null, avatar_url: null, admin_role: 'staff', permissions: { sales: true, customers: true, giftCards: true }, overtime_multiplier: 1.5 },
  { id: id(104), name: 'Avery Stone', email: 'avery.stone@paintandsip.local', phone: '(530) 555-1104', role: 'instructor', hourly_rate: 36, stripe_account_id: null, stripe_onboarding_complete: false, status: 'active', availability_days: ['Monday', 'Wednesday', 'Saturday'], account_id: null, notes: 'Private event specialist; watercolor and florals.', password_hash: null, avatar_url: null, admin_role: 'none', permissions: null, overtime_multiplier: 1.5 },
];

const events = [
  ['demo-mountain-sunset', 'Mountain Sunset', 2, 18, 30, 50, 29, id(1), 65, 'A warm acrylic landscape class with golden-hour mountains and lake reflections.', 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80'],
  ['demo-lake-reflections', 'Lake Reflections', 3, 18, 30, 50, 41, id(1), 65, 'Beginner-friendly lake scene with mirrored pines and layered blue washes.', 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=900&q=80'],
  ['demo-wildflower-fields', 'Wildflower Fields', 5, 19, 0, 50, 12, id(2), 62, 'Bright meadow florals with palette-knife texture and a wine pairing.', 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=900&q=80'],
  ['demo-corporate-canvas', 'Corporate Canvas: Alpine Strategy Night', 7, 14, 0, 24, 5, id(3), 78, 'Private event for a leadership team with collaborative canvas stations.', 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=900&q=80'],
  ['demo-watercolor-botanicals', 'Watercolor Botanicals', 9, 18, 30, 32, 18, id(3), 58, 'Soft botanical studies with watercolor layering, linework, and framing tips.', 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=900&q=80'],
  ['demo-date-night-starry-tahoe', 'Date Night: Starry Tahoe', 10, 19, 30, 44, 8, id(1), 72, 'Two-canvas date night with constellations, moonlight, and sparkling wine.', 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=900&q=80'],
  ['demo-paint-your-pet', 'Paint Your Pet Portrait', 12, 13, 0, 26, 3, id(1), 88, 'Guests submit pet photos ahead of time for a guided portrait session.', 'https://images.unsplash.com/photo-1450778869180-41d0601e046e?auto=format&fit=crop&w=900&q=80'],
  ['demo-summer-sangria', 'Summer Sangria & Succulents', 15, 18, 0, 36, 24, id(2), 60, 'Succulent still-life painting with a seasonal sangria tasting.', 'https://images.unsplash.com/photo-1483794344563-d27a8d18014e?auto=format&fit=crop&w=900&q=80'],
  ['demo-family-canvas', 'Sunday Family Canvas', 17, 11, 0, 40, 31, id(1), 42, 'All-ages class with simple shapes, bright color mixing, and take-home mats.', 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=900&q=80'],
  ['demo-bachelorette-blush', 'Blush & Bubbles Bachelorette', 19, 16, 0, 22, 2, id(3), 82, 'Private bachelorette event with florals, bubbly, and custom playlist.', 'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?auto=format&fit=crop&w=900&q=80'],
  ['demo-past-may-moonlight', 'Moonlight Pines', -6, 18, 30, 48, 0, id(1), 64, 'Completed public class used for sales, attendees, and repeat-customer history.', 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=900&q=80'],
  ['demo-past-team-canvas', 'Collaborative Team Canvas', -14, 14, 0, 30, 0, id(2), 75, 'Completed corporate team class used for account and invoice demos.', 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=900&q=80'],
  ['demo-sip-and-sketch-lakehouse', 'Sip & Sketch: Lakehouse Lines', 1, 17, 30, 34, 6, id(1), 54, 'Fast-moving sketch and watercolor class built for after-work guests.', 'https://images.unsplash.com/photo-1520420097861-e4959843b682?auto=format&fit=crop&w=900&q=80'],
  ['demo-monet-garden-brunch', 'Monet Garden Brunch', 4, 10, 30, 42, 0, id(1), 68, 'Sold-out brunch class with loose florals, mimosas, and soft color blocking.', 'https://images.unsplash.com/photo-1468327768560-75b778cbb551?auto=format&fit=crop&w=900&q=80'],
  ['demo-kids-summer-camp-day', 'Kids Summer Camp: Color Lab', 6, 9, 0, 24, 11, id(1), 48, 'Morning kids camp focused on color mixing, texture, and mini canvas studies.', 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=900&q=80'],
  ['demo-resin-coasters-workshop', 'Resin Coasters Workshop', 8, 18, 0, 28, 20, id(2), 74, 'Hands-on resin coaster workshop with pigments, metallics, and curing pickup.', 'https://images.unsplash.com/photo-1513519245088-0e12902e35ca?auto=format&fit=crop&w=900&q=80'],
  ['demo-fireworks-over-tahoe', 'Fireworks Over Tahoe', 11, 19, 0, 52, 14, id(1), 70, 'Holiday-week night scene with dramatic reflections and bright sky bursts.', 'https://images.unsplash.com/photo-1492681290082-e932832941e6?auto=format&fit=crop&w=900&q=80'],
  ['demo-mom-and-me-minis', 'Mom & Me Mini Canvases', 13, 11, 0, 30, 19, id(3), 46, 'Side-by-side mini canvases for parents and kids with simple guided shapes.', 'https://images.unsplash.com/photo-1491438590914-bc09fcaaf77a?auto=format&fit=crop&w=900&q=80'],
  ['demo-dog-days-pop-art', 'Dog Days Pop Art', 22, 13, 0, 30, 26, id(2), 76, 'Pet-photo prep class with bold pop-art backgrounds and pre-sketched canvases.', 'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=900&q=80'],
  ['demo-mountain-wildlife-night', 'Mountain Wildlife Night', 31, 18, 30, 44, 37, id(1), 66, 'Late-month wildlife silhouette class with trees, stars, and glowing skies.', 'https://images.unsplash.com/photo-1501706362039-c06b2d715385?auto=format&fit=crop&w=900&q=80'],
  ['demo-past-wine-and-watercolor', 'Wine & Watercolor Flight', -24, 18, 0, 36, 0, id(2), 59, 'Past tasting event used to show email follow-up, repeats, and product add-ons.', 'https://images.unsplash.com/photo-1528823872057-9c018a7a7553?auto=format&fit=crop&w=900&q=80'],
  ['demo-past-birthday-bash', 'Sophia Birthday Bash', -36, 15, 0, 18, 0, id(3), 82, 'Past private birthday party used for CRM history and private-event conversion.', 'https://images.unsplash.com/photo-1464349153735-7db50ed83c84?auto=format&fit=crop&w=900&q=80'],
  ['demo-past-corporate-retreat', 'Northstar Corporate Retreat', -58, 13, 0, 40, 0, id(1), 86, 'Past corporate retreat with add-on kits and invoice-style buying behavior.', 'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=900&q=80'],
  ['demo-past-couples-night', 'Couples Night: Moonlit Canoe', -82, 19, 0, 46, 0, id(1), 69, 'Older sold-through event for 90-day revenue and repeat-rate demos.', 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=80'],
].map(([slug, title, day, hour, minute, maxSeats, seatsAvailable, venueId, price, description, image], i) => ({
  id: id(200 + i),
  title,
  slug,
  description,
  start_datetime: iso(day, hour, minute),
  end_datetime: iso(day, Number(hour) + 2, minute),
  venue_id: venueId,
  base_price_per_seat: price,
  max_seats: maxSeats,
  seats_available: seatsAvailable,
  main_image_url: image,
  is_published: true,
  is_archived: false,
  is_deleted: false,
  recurrence: null,
  parent_event_id: null,
}));

const coupons = [
  { id: id(501), code: 'PAINT10', description: '10% off public events for new subscribers', discount_type: 'percentage', discount_value: 10, max_uses: 100, uses_so_far: 18, valid_from: iso(-20, 0, 0), valid_to: iso(45, 23, 59), is_active: true },
  { id: id(502), code: 'TEAMCANVAS', description: '$50 off corporate/private events', discount_type: 'fixed', discount_value: 50, max_uses: 25, uses_so_far: 6, valid_from: iso(-10, 0, 0), valid_to: iso(60, 23, 59), is_active: true },
  { id: id(503), code: 'GROUPON-DEMO', description: 'Imported Groupon voucher sample', discount_type: 'fixed', discount_value: 35, max_uses: 40, uses_so_far: 31, valid_from: iso(-30, 0, 0), valid_to: iso(15, 23, 59), is_active: true },
];

const customers = [
  ['Maya Chen', 'maya.chen@example.com', '(530) 555-2001'],
  ['Jordan Lee', 'jordan.lee@example.com', '(530) 555-2002'],
  ['Priya Shah', 'priya.shah@example.com', '(530) 555-2003'],
  ['Sam Rivera', 'sam.rivera@example.com', '(530) 555-2004'],
  ['Taylor Brooks', 'taylor.brooks@example.com', '(530) 555-2005'],
  ['Alicia Morgan', 'alicia.morgan@example.com', '(530) 555-2006'],
  ['Raleigh Dewan', 'raleigh@thenbgroup.com', '(312) 555-2007'],
  ['Casey Johnson', 'casey.johnson@example.com', '(530) 555-2008'],
  ['Nina Patel', 'nina.patel@example.com', '(530) 555-2009'],
  ['Owen Brooks', 'owen.brooks@example.com', '(530) 555-2010'],
  ['Jamie Lee', 'jamie.lee@example.com', '(530) 555-2011'],
  ['Noah Williams', 'noah.williams@example.com', '(530) 555-2012'],
  ['Grace Kim', 'grace.kim@example.com', '(530) 555-2013'],
  ['Morgan Hale', 'morgan@alpinestrategy.example', '(530) 555-3001'],
  ['Lena Ortiz', 'lena@bluebirdhr.example', '(775) 555-3002'],
  ['Erica Johnson', 'erica.johnson@example.com', '(530) 555-3003'],
];

const orders = [
  [701, 200, customers[0], 2, 130, 'paid', 501, -2],
  [702, 200, customers[1], 4, 260, 'paid', null, -1],
  [703, 201, customers[2], 2, 130, 'paid', null, -1],
  [704, 202, customers[3], 6, 372, 'paid', 501, -3],
  [705, 203, customers[4], 12, 936, 'paid', 502, -4],
  [706, 205, customers[5], 6, 432, 'paid', null, -5],
  [707, 206, customers[6], 2, 176, 'paid', null, -1],
  [708, 210, customers[0], 3, 192, 'paid', null, -7],
  [709, 211, customers[7], 10, 750, 'paid', 502, -15],
  [710, 208, customers[2], 5, 210, 'pending', null, 0],
  [711, 212, customers[8], 4, 216, 'paid', 501, -1],
  [712, 213, customers[9], 8, 544, 'paid', null, -2],
  [713, 213, customers[10], 6, 408, 'paid', null, -3],
  [714, 214, customers[11], 3, 144, 'paid', null, -1],
  [715, 215, customers[12], 2, 148, 'pending', null, 0],
  [716, 216, customers[13], 5, 350, 'paid', 501, -4],
  [717, 217, customers[14], 2, 92, 'paid', null, -2],
  [718, 218, customers[15], 18, 1368, 'paid', 502, -5],
  [719, 219, customers[1], 4, 264, 'cancelled', null, -7],
  [720, 220, customers[0], 2, 118, 'paid', null, -25],
  [721, 220, customers[3], 4, 236, 'paid', 501, -26],
  [722, 221, customers[15], 14, 1148, 'paid', null, -38],
  [723, 222, customers[13], 20, 1720, 'paid', 502, -60],
  [724, 223, customers[5], 2, 138, 'refunded', null, -83],
  [725, 223, customers[6], 2, 138, 'paid', null, -84],
  [726, 205, customers[8], 2, 144, 'paid', null, -2],
  [727, 202, customers[9], 4, 248, 'paid', 501, -1],
  [728, 218, customers[2], 6, 456, 'paid', null, -6],
  [729, 216, customers[4], 3, 210, 'paid', null, -2],
  [730, 212, customers[10], 2, 108, 'pending', null, 0],
].map(([n, eventIndex, customer, seats, total, status, couponN, createdOffset]) => ({
  id: id(n),
  event_id: id(eventIndex),
  purchaser_name: customer[0],
  purchaser_email: customer[1],
  purchaser_phone: customer[2],
  total_seats: seats,
  subtotal_amount: total + (couponN ? 20 : 0),
  discount_amount: couponN ? 20 : 0,
  total_amount: total,
  coupon_id: couponN ? id(couponN) : null,
  status,
  refund_reason: null,
  refunded_at: null,
  created_at: iso(createdOffset, 10, 15),
}));

const attendees = orders.flatMap((order, orderIndex) =>
  Array.from({ length: order.total_seats }, (_, i) => ({
    id: id(800 + orderIndex * 30 + i),
    order_id: order.id,
    full_name: i === 0 ? order.purchaser_name : `${order.purchaser_name.split(' ')[0]} Guest ${i}`,
    email: i === 0 ? order.purchaser_email : null,
    notes: i === 0 && order.total_seats > 4 ? 'Group organizer' : null,
  }))
);

const assignments = [
  [901, 200, 101, 'confirmed'],
  [902, 201, 102, 'assigned'],
  [903, 202, 102, 'confirmed'],
  [904, 203, 103, 'assigned'],
  [905, 205, 101, 'confirmed'],
  [906, 206, 104, 'confirmed'],
  [907, 210, 101, 'completed'],
  [908, 211, 102, 'completed'],
  [909, 212, 103, 'confirmed'],
  [910, 213, 101, 'confirmed'],
  [911, 214, 104, 'assigned'],
  [912, 216, 102, 'confirmed'],
  [913, 218, 101, 'assigned'],
  [914, 220, 104, 'completed'],
  [915, 221, 103, 'completed'],
  [916, 222, 101, 'completed'],
  [917, 223, 102, 'completed'],
].map(([n, eventN, employeeN, status]) => ({
  id: id(n),
  event_id: id(eventN),
  employee_id: id(employeeN),
  status,
  assigned_at: iso(-8, 9, 0),
  confirmed_at: status !== 'assigned' ? iso(-7, 11, 0) : null,
  clock_in: status === 'completed' ? iso(eventN === 210 ? -6 : -14, 17, 45) : null,
  clock_out: status === 'completed' ? iso(eventN === 210 ? -6 : -14, 20, 45) : null,
  hours_worked: status === 'completed' ? 3 : null,
  hourly_rate_snapshot: eventN === 210 ? 38 : 34,
  pay_amount: status === 'completed' ? (eventN === 210 ? 114 : 102) : null,
  pay_override: false,
  notes: status === 'assigned' ? 'Awaiting confirmation' : null,
}));

const payRecords = assignments.filter((a) => a.status === 'completed').map((a, i) => ({
  id: id(950 + i),
  event_assignment_id: a.id,
  employee_id: a.employee_id,
  event_id: a.event_id,
  hours_worked: a.hours_worked,
  hourly_rate: a.hourly_rate_snapshot,
  pay_amount: a.pay_amount,
  pay_override: false,
  status: i === 0 ? 'approved' : 'paid',
  stripe_transfer_id: i === 0 ? null : 'tr_demo_paid_transfer',
  stripe_error: null,
  approved_at: iso(-2, 9, 0),
  paid_at: i === 0 ? null : iso(-1, 9, 0),
}));

const giftCards = [
  { id: id(1001), code: 'PS-DEMO-150', amount: 150, purchaser_name: 'Nina Patel', purchaser_email: 'nina.patel@example.com', recipient_name: 'Maya Chen', recipient_email: 'maya.chen@example.com', message: 'For your next creative night out.', is_redeemed: false, redeemed_at: null, created_at: iso(-18, 12, 0) },
  { id: id(1002), code: 'PS-DEMO-075', amount: 75, purchaser_name: 'Owen Brooks', purchaser_email: 'owen.brooks@example.com', recipient_name: 'Taylor Brooks', recipient_email: 'taylor.brooks@example.com', message: 'Happy birthday!', is_redeemed: false, redeemed_at: null, created_at: iso(-8, 12, 0) },
  { id: id(1003), code: 'PS-DEMO-050', amount: 50, purchaser_name: 'Jamie Lee', purchaser_email: 'jamie.lee@example.com', recipient_name: 'Sam Rivera', recipient_email: 'sam.rivera@example.com', message: null, is_redeemed: true, redeemed_at: iso(-3, 12, 0), created_at: iso(-20, 12, 0) },
  { id: id(1004), code: 'PS-DEMO-200', amount: 200, purchaser_name: 'Morgan Hale', purchaser_email: 'morgan@alpinestrategy.example', recipient_name: 'Alpine Strategy Team', recipient_email: 'morgan@alpinestrategy.example', message: 'Team prizes for the next offsite.', is_redeemed: false, redeemed_at: null, created_at: iso(-2, 14, 0) },
  { id: id(1005), code: 'PS-DEMO-125', amount: 125, purchaser_name: 'Grace Kim', purchaser_email: 'grace.kim@example.com', recipient_name: 'Noah Williams', recipient_email: 'noah.williams@example.com', message: 'Let us paint something ridiculous.', is_redeemed: false, redeemed_at: null, created_at: iso(-31, 10, 0) },
  { id: id(1006), code: 'PS-DEMO-090', amount: 90, purchaser_name: 'Alicia Morgan', purchaser_email: 'alicia.morgan@example.com', recipient_name: 'Priya Shah', recipient_email: 'priya.shah@example.com', message: 'Girls night soon.', is_redeemed: true, redeemed_at: iso(-9, 16, 0), created_at: iso(-45, 11, 0) },
];

const subscribers = customers.map((customer, i) => ({
  id: id(1101 + i),
  email: customer[1],
  name: customer[0],
  source: i % 2 === 0 ? 'checkout' : 'footer',
  is_active: i !== 5,
  created_at: iso(-20 + i, 12, 0),
}));

const productCategories = [
  { id: id(1201), name: 'Paint Kits', slug: 'paint-kits', description: 'Take-home painting kits and class materials.', display_order: 1 },
  { id: id(1202), name: 'Gifts', slug: 'gifts', description: 'Studio gifts, cards, and creative extras.', display_order: 2 },
];

const products = [
  { id: id(1211), name: 'Tahoe Sunset Paint Kit', slug: 'tahoe-sunset-paint-kit', description: 'Canvas, paints, brushes, and step-by-step Tahoe sunset guide.', price: 38, compare_at_price: 45, image_url: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=900&q=80', images: [], category_id: id(1201), is_active: true, stock: 8, sku: 'KIT-SUNSET', weight_oz: 32 },
  { id: id(1212), name: 'Watercolor Botanical Set', slug: 'watercolor-botanical-set', description: 'Compact watercolor set for botanical practice at home.', price: 28, compare_at_price: null, image_url: 'https://images.unsplash.com/photo-1452860606245-08befc0ff44b?auto=format&fit=crop&w=900&q=80', images: [], category_id: id(1201), is_active: true, stock: 24, sku: 'KIT-BOTANICAL', weight_oz: 18 },
  { id: id(1213), name: 'Studio Wine Tumbler', slug: 'studio-wine-tumbler', description: 'Insulated tumbler with Easel Paint & Sip mark.', price: 22, compare_at_price: null, image_url: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=900&q=80', images: [], category_id: id(1202), is_active: true, stock: 5, sku: 'GIFT-TUMBLER', weight_oz: 12 },
  { id: id(1214), name: 'Private Party Supply Bundle', slug: 'private-party-supply-bundle', description: 'Extra canvases, aprons, table covers, and brush packs for off-site events.', price: 96, compare_at_price: 120, image_url: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=900&q=80', images: [], category_id: id(1201), is_active: true, stock: 3, sku: 'KIT-PARTY-BUNDLE', weight_oz: 96 },
  { id: id(1215), name: 'Mini Canvas Favor Pack', slug: 'mini-canvas-favor-pack', description: 'Twelve mini canvas favors for birthdays, showers, and corporate tables.', price: 34, compare_at_price: null, image_url: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=900&q=80', images: [], category_id: id(1202), is_active: true, stock: 16, sku: 'GIFT-MINI-FAVOR', weight_oz: 24 },
  { id: id(1216), name: 'Metallic Paint Add-On', slug: 'metallic-paint-add-on', description: 'Gold, copper, and pearl acrylic add-on set for dramatic highlights.', price: 16, compare_at_price: null, image_url: 'https://images.unsplash.com/photo-1456086272160-b28b0645b729?auto=format&fit=crop&w=900&q=80', images: [], category_id: id(1201), is_active: true, stock: 42, sku: 'KIT-METALLIC', weight_oz: 8 },
];

const productOrders = [
  { id: id(1251), order_id: null, product_id: id(1211), quantity: 2, unit_price: 38, total_price: 76, purchaser_name: 'Maya Chen', purchaser_email: 'maya.chen@example.com', purchaser_phone: '(530) 555-2001', shipping_address: '44 Pine Loop', shipping_city: 'South Lake Tahoe', shipping_state: 'CA', shipping_zip: '96150', status: 'processing' },
  { id: id(1252), order_id: null, product_id: id(1213), quantity: 1, unit_price: 22, total_price: 22, purchaser_name: 'Jordan Lee', purchaser_email: 'jordan.lee@example.com', purchaser_phone: '(530) 555-2002', shipping_address: '18 Donner Pass Rd', shipping_city: 'Truckee', shipping_state: 'CA', shipping_zip: '96161', status: 'shipped' },
  { id: id(1253), order_id: null, product_id: id(1214), quantity: 1, unit_price: 96, total_price: 96, purchaser_name: 'Morgan Hale', purchaser_email: 'morgan@alpinestrategy.example', purchaser_phone: '(530) 555-3001', shipping_address: '200 Summit Ave', shipping_city: 'Truckee', shipping_state: 'CA', shipping_zip: '96161', status: 'processing' },
  { id: id(1254), order_id: null, product_id: id(1215), quantity: 3, unit_price: 34, total_price: 102, purchaser_name: 'Erica Johnson', purchaser_email: 'erica.johnson@example.com', purchaser_phone: '(530) 555-3003', shipping_address: '11 Cedar Ct', shipping_city: 'Incline Village', shipping_state: 'NV', shipping_zip: '89451', status: 'pending' },
  { id: id(1255), order_id: null, product_id: id(1216), quantity: 4, unit_price: 16, total_price: 64, purchaser_name: 'Maya Chen', purchaser_email: 'maya.chen@example.com', purchaser_phone: '(530) 555-2001', shipping_address: '44 Pine Loop', shipping_city: 'South Lake Tahoe', shipping_state: 'CA', shipping_zip: '96150', status: 'delivered' },
  { id: id(1256), order_id: null, product_id: id(1212), quantity: 2, unit_price: 28, total_price: 56, purchaser_name: 'Grace Kim', purchaser_email: 'grace.kim@example.com', purchaser_phone: '(530) 555-2013', shipping_address: '72 Aspen Way', shipping_city: 'Truckee', shipping_state: 'CA', shipping_zip: '96161', status: 'shipped' },
];

const corporateAccounts = [
  { id: id(1301), company_name: 'Alpine Strategy Group', primary_contact_name: 'Morgan Hale', primary_contact_email: 'morgan@alpinestrategy.example', primary_contact_phone: '(530) 555-3001', billing_address: { street: '200 Summit Ave', city: 'Truckee', state: 'CA', zip: '96161' }, tax_id: null, plan_type: 'pay_per_event', monthly_seat_allotment: null, stripe_customer_id: 'cus_demo_alpine', stripe_subscription_id: null, auto_charge: true, status: 'active', notes: 'Quarterly team-building buyer.' },
  { id: id(1302), company_name: 'Bluebird HR Collective', primary_contact_name: 'Lena Ortiz', primary_contact_email: 'lena@bluebirdhr.example', primary_contact_phone: '(775) 555-3002', billing_address: { street: '74 Village Blvd', city: 'Incline Village', state: 'NV', zip: '89451' }, tax_id: null, plan_type: 'custom', monthly_seat_allotment: 20, stripe_customer_id: 'cus_demo_bluebird', stripe_subscription_id: 'sub_demo_bluebird', auto_charge: false, status: 'active', notes: 'Interested in recurring wellness workshops.' },
  { id: id(1303), company_name: 'Northstar Finance Co.', primary_contact_name: 'Dev Patel', primary_contact_email: 'dev@northstarfinance.example', primary_contact_phone: '(530) 555-3004', billing_address: { street: '900 Lake Center', city: 'South Lake Tahoe', state: 'CA', zip: '96150' }, tax_id: null, plan_type: 'pay_per_event', monthly_seat_allotment: null, stripe_customer_id: 'cus_demo_northstar', stripe_subscription_id: null, auto_charge: true, status: 'active', notes: 'Booked a retreat last quarter; likely repeat buyer.' },
  { id: id(1304), company_name: 'Sierra Pediatric Dental', primary_contact_name: 'Ana Romero', primary_contact_email: 'ana@sierradental.example', primary_contact_phone: '(775) 555-3005', billing_address: { street: '14 Lakeside Pl', city: 'Incline Village', state: 'NV', zip: '89451' }, tax_id: null, plan_type: 'custom', monthly_seat_allotment: 12, stripe_customer_id: 'cus_demo_sierra', stripe_subscription_id: null, auto_charge: false, status: 'active', notes: 'Prospect-like account. Asked about family-friendly employee appreciation events.' },
];

const privateRequests = [
  { id: id(1401), contact_name: 'Morgan Hale', contact_email: 'morgan@alpinestrategy.example', contact_phone: '(530) 555-3001', company_name: 'Alpine Strategy Group', corporate_account_id: id(1301), event_type: 'corporate', preferred_date: iso(21, 0, 0).slice(0, 10), alternate_date: iso(28, 0, 0).slice(0, 10), preferred_time: 'evening', guest_count: 26, venue_preference_id: id(1), painting_selection_type: 'owner_chooses', selected_painting_id: null, custom_painting_request: 'Collaborative mountain-themed mural panels.', special_requests: 'Needs quote with deposit link and alcohol-free options.', status: 'submitted', admin_notes: 'High-value lead. Follow up today.', deposit_required: true, deposit_amount: 300 },
  { id: id(1402), contact_name: 'Erica Johnson', contact_email: 'erica.johnson@example.com', contact_phone: '(530) 555-3003', company_name: null, corporate_account_id: null, event_type: 'birthday', preferred_date: iso(18, 0, 0).slice(0, 10), alternate_date: iso(25, 0, 0).slice(0, 10), preferred_time: 'afternoon', guest_count: 14, venue_preference_id: id(3), painting_selection_type: 'custom_request', selected_painting_id: null, custom_painting_request: 'Sunflowers and champagne theme.', special_requests: 'Cake table and playlist.', status: 'contacted', admin_notes: 'Asked for package options.', deposit_required: true, deposit_amount: 150 },
  { id: id(1403), contact_name: 'Lena Ortiz', contact_email: 'lena@bluebirdhr.example', contact_phone: '(775) 555-3002', company_name: 'Bluebird HR Collective', corporate_account_id: id(1302), event_type: 'corporate', preferred_date: iso(35, 0, 0).slice(0, 10), alternate_date: null, preferred_time: 'morning', guest_count: 18, venue_preference_id: id(2), painting_selection_type: 'chosen', selected_painting_id: null, custom_painting_request: null, special_requests: 'Wellness workshop, coffee service, invoice needed.', status: 'confirmed', admin_notes: 'Ready to convert to event.', deposit_required: false, deposit_amount: null },
  { id: id(1404), contact_name: 'Ana Romero', contact_email: 'ana@sierradental.example', contact_phone: '(775) 555-3005', company_name: 'Sierra Pediatric Dental', corporate_account_id: id(1304), event_type: 'corporate', preferred_date: iso(16, 0, 0).slice(0, 10), alternate_date: iso(23, 0, 0).slice(0, 10), preferred_time: 'evening', guest_count: 22, venue_preference_id: id(3), painting_selection_type: 'owner_chooses', selected_painting_id: null, custom_painting_request: 'Something cheerful, simple, and staff-appreciation oriented.', special_requests: 'Needs gluten-free snacks and invoice approval before deposit.', status: 'submitted', admin_notes: 'New lead. Ask about budget and alcohol preference.', deposit_required: true, deposit_amount: 250 },
  { id: id(1405), contact_name: 'Dev Patel', contact_email: 'dev@northstarfinance.example', contact_phone: '(530) 555-3004', company_name: 'Northstar Finance Co.', corporate_account_id: id(1303), event_type: 'corporate', preferred_date: iso(44, 0, 0).slice(0, 10), alternate_date: iso(51, 0, 0).slice(0, 10), preferred_time: 'afternoon', guest_count: 34, venue_preference_id: id(1), painting_selection_type: 'custom_request', selected_painting_id: null, custom_painting_request: 'Lake Tahoe skyline with company colors in the background.', special_requests: 'Wants proposal, contract, and deposit link by Friday.', status: 'contacted', admin_notes: 'Proposal sent. Strong repeat prospect; likely $2.8k event.', deposit_required: true, deposit_amount: 500 },
  { id: id(1406), contact_name: 'Rina Walsh', contact_email: 'rina.walsh@example.com', contact_phone: '(530) 555-3006', company_name: null, corporate_account_id: null, event_type: 'bachelorette', preferred_date: iso(27, 0, 0).slice(0, 10), alternate_date: iso(29, 0, 0).slice(0, 10), preferred_time: 'evening', guest_count: 16, venue_preference_id: id(1), painting_selection_type: 'custom_request', selected_painting_id: null, custom_painting_request: 'Disco cowgirl theme with pink mountains.', special_requests: 'Bride wants mocktails and photo backdrop.', status: 'contacted', admin_notes: 'Waiting on final guest count.', deposit_required: true, deposit_amount: 200 },
  { id: id(1407), contact_name: 'Kevin Lau', contact_email: 'kevin.lau@example.com', contact_phone: '(530) 555-3007', company_name: null, corporate_account_id: null, event_type: 'birthday', preferred_date: iso(5, 0, 0).slice(0, 10), alternate_date: null, preferred_time: 'morning', guest_count: 10, venue_preference_id: id(2), painting_selection_type: 'owner_chooses', selected_painting_id: null, custom_painting_request: null, special_requests: 'Asked if ten-year-olds can do a shorter class.', status: 'contacted', admin_notes: 'Date unavailable. Suggested public kids camp instead.', deposit_required: false, deposit_amount: null },
];

const memberships = [
  { id: id(1501), customer_email: 'raleigh@thenbgroup.com', customer_name: 'Raleigh Dewan', plan_id: 'creative-duo', plan_name: 'Creative Duo', monthly_price: 49, credits_per_cycle: 2, renewal_date: iso(12, 0, 0), status: 'active', stripe_customer_id: 'cus_demo_raleigh', stripe_subscription_id: 'sub_demo_raleigh' },
  { id: id(1502), customer_email: 'maya.chen@example.com', customer_name: 'Maya Chen', plan_id: 'studio-circle', plan_name: 'Studio Circle', monthly_price: 89, credits_per_cycle: 4, renewal_date: iso(7, 0, 0), status: 'active', stripe_customer_id: 'cus_demo_maya', stripe_subscription_id: 'sub_demo_maya' },
  { id: id(1503), customer_email: 'jamie.lee@example.com', customer_name: 'Jamie Lee', plan_id: 'creative-duo', plan_name: 'Creative Duo', monthly_price: 49, credits_per_cycle: 2, renewal_date: iso(3, 0, 0), status: 'past_due', stripe_customer_id: 'cus_demo_jamie', stripe_subscription_id: 'sub_demo_jamie' },
];

const redemptions = [
  { id: id(1511), customer_membership_id: id(1501), customer_email: 'raleigh@thenbgroup.com', event_id: id(206), order_id: id(707), credits_used: 2, amount_covered: 176, redeemed_at: iso(-1, 9, 0) },
  { id: id(1512), customer_membership_id: id(1502), customer_email: 'maya.chen@example.com', event_id: id(200), order_id: id(701), credits_used: 1, amount_covered: 65, redeemed_at: iso(-2, 9, 0) },
];

const emailBroadcasts = [
  { id: id(1601), event_id: id(201), subject: 'Seats still open for Lake Reflections', body: 'A calm Tahoe night is waiting. Reserve your canvas for Lake Reflections this week.', recipient_count: 428, status: 'scheduled', scheduled_at: iso(1, 9, 0), sent_at: null },
  { id: id(1602), event_id: id(208), subject: 'Sunday Family Canvas is almost here', body: 'Bring the family for a bright, easygoing creative morning.', recipient_count: 215, status: 'draft', scheduled_at: null, sent_at: null },
  { id: id(1603), event_id: id(210), subject: 'Thanks for painting Moonlight Pines', body: 'Thanks for joining us. Here are photos and upcoming events.', recipient_count: 42, status: 'sent', scheduled_at: iso(-5, 8, 0), sent_at: iso(-5, 8, 5) },
  { id: id(1604), event_id: id(213), subject: 'Monet Garden Brunch is sold out', body: 'Join the waitlist or grab a seat in Watercolor Botanicals.', recipient_count: 612, status: 'sent', scheduled_at: iso(-1, 8, 30), sent_at: iso(-1, 8, 35) },
  { id: id(1605), event_id: id(216), subject: 'Fireworks Over Tahoe needs one more push', body: 'Holiday week seats are moving. Promote this event to local subscribers and visitors.', recipient_count: 540, status: 'scheduled', scheduled_at: iso(2, 9, 0), sent_at: null },
  { id: id(1606), event_id: id(218), subject: 'Dog Days Pop Art early access', body: 'Pet portrait fans get first access before we publish the final reminder.', recipient_count: 188, status: 'draft', scheduled_at: null, sent_at: null },
  { id: id(1607), event_id: id(222), subject: 'Corporate retreat recap and reorder kits', body: 'Thanks for joining us. Reorder team kits or reserve your next workshop.', recipient_count: 34, status: 'sent', scheduled_at: iso(-55, 9, 0), sent_at: iso(-55, 9, 5) },
];

const waitlist = [
  { id: id(1701), event_id: id(206), name: 'Noah Williams', email: 'noah.williams@example.com', phone: '(530) 555-4001', seats_desired: 2, notified: false },
  { id: id(1702), event_id: id(205), name: 'Grace Kim', email: 'grace.kim@example.com', phone: '(530) 555-4002', seats_desired: 4, notified: true },
  { id: id(1703), event_id: id(213), name: 'Alicia Morgan', email: 'alicia.morgan@example.com', phone: '(530) 555-2006', seats_desired: 2, notified: false },
  { id: id(1704), event_id: id(213), name: 'Nina Patel', email: 'nina.patel@example.com', phone: '(530) 555-2009', seats_desired: 3, notified: false },
  { id: id(1705), event_id: id(206), name: 'Owen Brooks', email: 'owen.brooks@example.com', phone: '(530) 555-2010', seats_desired: 2, notified: true },
  { id: id(1706), event_id: id(219), name: 'Taylor Brooks', email: 'taylor.brooks@example.com', phone: '(530) 555-2005', seats_desired: 4, notified: false },
];

async function main() {
  console.log(`Seeding demo data into ${supabaseUrl}`);
  await upsert('venues', venues);
  await upsert('employees', employees);
  await upsert('coupons', coupons);
  await upsert('events', events);
  await upsert('orders', orders);
  await upsert('attendees', attendees);
  await upsert('event_assignments', assignments);
  await upsert('pay_records', payRecords);
  await upsert('gift_cards', giftCards);
  await upsert('newsletter_subscribers', subscribers);
  const seededCategories = await tryUpsert('product_categories', productCategories.map(({ id: _id, ...category }) => category), 'slug');
  const categoryIdsBySlug = Object.fromEntries(seededCategories.map((category) => [category.slug, category.id]));
  const oldCategoryIdsBySlug = Object.fromEntries(productCategories.map((category) => [category.slug, category.id]));
  const categorySlugByOldId = Object.fromEntries(Object.entries(oldCategoryIdsBySlug).map(([slug, categoryId]) => [categoryId, slug]));
  const hydratedProducts = products.map((product) => {
    const categorySlug = categorySlugByOldId[product.category_id];
    return { ...product, category_id: categoryIdsBySlug[categorySlug] || product.category_id };
  });
  const seededProducts = await tryUpsert('products', hydratedProducts.map(({ id: _id, ...product }) => product), 'slug');
  const productIdsBySlug = Object.fromEntries(seededProducts.map((product) => [product.slug, product.id]));
  const oldProductIdsBySlug = Object.fromEntries(products.map((product) => [product.slug, product.id]));
  const productSlugByOldId = Object.fromEntries(Object.entries(oldProductIdsBySlug).map(([slug, productId]) => [productId, slug]));
  const hydratedProductOrders = productOrders.map((order) => {
    const productSlug = productSlugByOldId[order.product_id];
    return { ...order, product_id: productIdsBySlug[productSlug] || order.product_id };
  });
  await tryUpsert('product_orders', hydratedProductOrders);
  await tryUpsert('corporate_accounts', corporateAccounts);
  await upsert('private_event_requests', privateRequests);
  await tryUpsert('customer_memberships', memberships);
  await tryUpsert('membership_credit_redemptions', redemptions);
  await tryUpsert('email_broadcasts', emailBroadcasts);
  await tryUpsert('waitlist', waitlist);

  await tryUpsert('settings', [{
    key: 'private_request_metadata',
    value: {
      [id(1401)]: { estimatedValue: 2100, qualification: 'qualified', proposalStatus: 'drafted', depositStatus: 'requested', depositAmount: 300, packageInterest: 'Corporate premium', probability: 72, source: 'Website form', nextFollowUpDate: iso(1, 10, 0) },
      [id(1402)]: { estimatedValue: 980, qualification: 'needs_info', proposalStatus: 'sent', depositStatus: 'requested', depositAmount: 150, packageInterest: 'Birthday classic', probability: 48, source: 'Referral', nextFollowUpDate: iso(2, 10, 0) },
      [id(1403)]: { estimatedValue: 1450, qualification: 'qualified', proposalStatus: 'accepted', depositStatus: 'waived', packageInterest: 'Corporate wellness', probability: 90, source: 'Corporate account', nextFollowUpDate: iso(4, 10, 0) },
    },
  }], 'key');

  console.log('\nVisible row counts after seed:');
  await Promise.all([
    verifyTableCount('events'),
    verifyTableCount('orders'),
    verifyTableCount('attendees'),
    verifyTableCount('private_event_requests'),
    verifyTableCount('gift_cards'),
    verifyTableCount('products'),
    verifyTableCount('product_orders'),
    verifyTableCount('email_broadcasts'),
    verifyTableCount('waitlist'),
    verifyTableCount('customer_memberships'),
    verifyTableCount('membership_credit_redemptions'),
  ]);

  console.log('Demo seed complete. Refresh the local app.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
