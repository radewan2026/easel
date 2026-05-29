import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { getElementAnalyticsLabel, inferUserType, trackAnalyticsEvent } from '../../lib/analytics';

function getElementRole(element: Element) {
  if (element instanceof HTMLAnchorElement) return 'link';
  if (element instanceof HTMLButtonElement) return 'button';
  return element.getAttribute('role') || element.tagName.toLowerCase();
}

function getClickTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return null;
  return target.closest('a,button,[data-analytics-event]');
}

export function AnalyticsTracker() {
  const location = useLocation();
  const lastPathRef = useRef('');

  useEffect(() => {
    const path = `${location.pathname}${location.search}`;
    if (lastPathRef.current === path) return;
    lastPathRef.current = path;

    void trackAnalyticsEvent({
      eventName: 'page_view',
      path,
      userType: inferUserType(location.pathname),
      properties: {
        referrer: document.referrer || null,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      },
    });
  }, [location.pathname, location.search]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = getClickTarget(event.target);
      if (!target) return;

      const explicitEvent = target.getAttribute('data-analytics-event');
      const label = getElementAnalyticsLabel(target);
      const href = target instanceof HTMLAnchorElement ? target.href : null;

      if (!explicitEvent && !label && !href) return;

      void trackAnalyticsEvent({
        eventName: explicitEvent || 'ui_click',
        userType: inferUserType(window.location.pathname),
        properties: {
          label,
          role: getElementRole(target),
          href,
          section: target.getAttribute('data-analytics-section') || null,
        },
      });
    };

    document.addEventListener('click', handleClick, { capture: true });
    return () => document.removeEventListener('click', handleClick, { capture: true });
  }, []);

  useEffect(() => {
    const starts = new WeakSet<HTMLFormElement>();
    const handleInput = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const form = target.closest('form');
      if (!form || starts.has(form)) return;
      starts.add(form);
      void trackAnalyticsEvent({
        eventName: 'form_start',
        userType: inferUserType(window.location.pathname),
        properties: {
          formName: form.getAttribute('name') || form.getAttribute('aria-label') || form.id || 'unnamed_form',
          path: window.location.pathname,
        },
      });
    };

    const handleSubmit = (event: SubmitEvent) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      void trackAnalyticsEvent({
        eventName: 'form_submit',
        userType: inferUserType(window.location.pathname),
        properties: {
          formName: form.getAttribute('name') || form.getAttribute('aria-label') || form.id || 'unnamed_form',
          path: window.location.pathname,
        },
      });
    };

    document.addEventListener('input', handleInput, { capture: true });
    document.addEventListener('submit', handleSubmit, { capture: true });
    return () => {
      document.removeEventListener('input', handleInput, { capture: true });
      document.removeEventListener('submit', handleSubmit, { capture: true });
    };
  }, []);

  return null;
}

