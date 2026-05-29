export type CalendarEventInput = {
  title: string;
  start_datetime: string;
  end_datetime?: string | null;
  description?: string | null;
  venue?: { name: string; city?: string | null; state?: string | null } | null;
};

export function generateGoogleCalendarUrl(event: CalendarEventInput): string {
  const start = new Date(event.start_datetime).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const endDate = event.end_datetime
    ? new Date(event.end_datetime).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    : new Date(new Date(event.start_datetime).getTime() + 2 * 60 * 60 * 1000).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${start}/${endDate}`,
    details: event.description || `Join us for ${event.title}!`,
    location: event.venue ? `${event.venue.name}, ${event.venue.city || ''}` : '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function generateIcsContent(event: CalendarEventInput): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const formatDt = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  const start = formatDt(new Date(event.start_datetime));
  const end = event.end_datetime
    ? formatDt(new Date(event.end_datetime))
    : formatDt(new Date(new Date(event.start_datetime).getTime() + 2 * 60 * 60 * 1000));
  const location = event.venue ? `${event.venue.name}, ${event.venue.city || ''}` : '';
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Paint & Sip//EN',
    'BEGIN:VEVENT',
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${event.title}`,
    `DESCRIPTION:${(event.description || '').replace(/\n/g, '\\n')}`,
    `LOCATION:${location}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export function downloadIcsFile(event: CalendarEventInput) {
  const content = generateIcsContent(event);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${event.title.replace(/[^a-zA-Z0-9]/g, '_')}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
