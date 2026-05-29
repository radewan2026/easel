import { useMemo, useState } from 'react';
import { useEvents, useOrders } from './useEvents';
import { useEventAssignments } from './useEventAssignments';
import { usePrivateEventRequests } from './usePrivateEventRequests';
import { usePayRecords } from './usePayRecords';
import { useProducts } from './useProducts';
import { formatCurrency } from '../lib/utils';
import { getEventHealth } from '../lib/adminInsights';
import { usePrivateRequestMetadata } from './usePrivateRequestMetadata';
import { useMembershipAdmin } from './useMembershipAdmin';
import type { Event, EventAssignment, Order, PayRecord, PrivateEventRequest, Product } from '../types/database';

export type OwnerActionItem = {
  id: string;
  type: 'event' | 'private_request' | 'payroll' | 'order' | 'inventory' | 'membership';
  tone: 'danger' | 'warning' | 'success' | 'primary' | 'gray';
  timestamp: string;
  summary: string;
  detail: string;
  to: string;
  actionLabel: string;
  urgent?: boolean;
};

export function useOwnerActionFeed() {
  const { data: events = [] } = useEvents();
  const { data: assignments = [] } = useEventAssignments();
  const { data: privateRequests = [] } = usePrivateEventRequests();
  const { data: payRecords = [] } = usePayRecords();
  const { data: orders = [] } = useOrders();
  const { data: products = [] } = useProducts();
  const { data: privateRequestMetadata = {} } = usePrivateRequestMetadata();
  const { data: membershipAdmin } = useMembershipAdmin();
  const [now] = useState(() => Date.now());
  const nowIso = useMemo(() => new Date(now).toISOString(), [now]);

  return useMemo(() => {
    const assignmentMap = new Map<string, { total: number; confirmed: number }>();
    (assignments as EventAssignment[]).forEach((assignment) => {
      if (assignment.status === 'declined') return;
      const current = assignmentMap.get(assignment.event_id) || { total: 0, confirmed: 0 };
      current.total += 1;
      if (assignment.status === 'confirmed') current.confirmed += 1;
      assignmentMap.set(assignment.event_id, current);
    });

    const items: OwnerActionItem[] = [];

    (events as Event[])
      .filter((event) => new Date(event.start_datetime).getTime() >= now)
      .slice(0, 20)
      .forEach((event) => {
        const health = getEventHealth(event, assignmentMap.get(event.id));
        if (!['needs_staff', 'needs_promotion', 'at_risk', 'almost_sold_out'].includes(health.status)) return;
        items.push({
          id: `event-${event.id}-${health.status}`,
          type: 'event',
          tone: health.tone,
          timestamp: event.start_datetime,
          summary: `${event.title}: ${health.label}`,
          detail: `${health.fillRate}% filled${health.reasons.length ? ` · ${health.reasons.slice(0, 2).join(' · ')}` : ''}`,
          to: health.nextAction.to,
          actionLabel: health.nextAction.label,
          urgent: health.status === 'needs_staff' || health.status === 'at_risk',
        });
      });

    (privateRequests as PrivateEventRequest[])
      .filter((request) => request.status === 'submitted' || request.status === 'contacted')
      .slice(0, 10)
      .forEach((request) => {
        const metadata = privateRequestMetadata[request.id] || {};
        const followUpDue = Boolean(metadata.nextFollowUpDate && new Date(`${metadata.nextFollowUpDate}T23:59:59`).getTime() < now);
        items.push({
          id: `private-request-${request.id}`,
          type: 'private_request',
          tone: followUpDue ? 'warning' : request.status === 'submitted' ? 'primary' : 'gray',
          timestamp: metadata.nextFollowUpDate || request.created_at,
          summary: followUpDue ? `Follow up with ${request.contact_name}` : `Private request from ${request.contact_name}`,
          detail: `${request.guest_count} guests · ${request.event_type}${metadata.estimatedValue ? ` · ${formatCurrency(metadata.estimatedValue)}` : ''}${metadata.assignedOwnerName ? ` · Owner: ${metadata.assignedOwnerName}` : ''}`,
          to: '/admin/private-requests',
          actionLabel: followUpDue ? 'Follow up' : request.status === 'submitted' ? 'Review lead' : 'Review',
          urgent: followUpDue || request.status === 'submitted',
        });
      });

    (payRecords as PayRecord[])
      .filter((record) => ['pending', 'approved', 'failed'].includes(record.status))
      .slice(0, 5)
      .forEach((record) => {
        items.push({
          id: `payroll-${record.id}`,
          type: 'payroll',
          tone: record.status === 'failed' ? 'danger' : 'warning',
          timestamp: record.created_at,
          summary: `Payroll item ${record.status}`,
          detail: `${record.employee?.name || 'Employee'} · ${formatCurrency(record.pay_amount || 0)}`,
          to: '/admin/pay-queue',
          actionLabel: 'Review pay',
          urgent: record.status === 'failed',
        });
      });

    (products as Product[])
      .filter((product) => product.is_active && Number(product.stock || 0) <= 10)
      .slice(0, 5)
      .forEach((product) => {
        items.push({
          id: `inventory-${product.id}`,
          type: 'inventory',
          tone: Number(product.stock || 0) === 0 ? 'danger' : 'warning',
          timestamp: product.updated_at || nowIso,
          summary: `${product.name} inventory is low`,
          detail: `${product.stock || 0} in stock`,
          to: '/admin/products',
          actionLabel: 'Update product',
          urgent: Number(product.stock || 0) === 0,
        });
      });

    membershipAdmin?.memberships
      .filter((membership) => membership.status === 'past_due')
      .slice(0, 5)
      .forEach((membership) => {
        items.push({
          id: `membership-past-due-${membership.id}`,
          type: 'membership',
          tone: 'warning',
          timestamp: membership.renewalDate,
          summary: `${membership.customerName || membership.customerEmail}: membership past due`,
          detail: `${membership.planName} · ${formatCurrency(membership.monthlyPrice)} / month`,
          to: '/admin/memberships',
          actionLabel: 'Review member',
          urgent: true,
        });
      });

    if (membershipAdmin && membershipAdmin.totals.outstandingCredits > 0) {
      items.push({
        id: 'membership-credit-liability',
        type: 'membership',
        tone: 'primary',
        timestamp: nowIso,
        summary: `${membershipAdmin.totals.outstandingCredits} membership credits outstanding`,
        detail: `${formatCurrency(membershipAdmin.totals.creditLiability)} estimated credit liability`,
        to: '/admin/memberships',
        actionLabel: 'View credits',
      });
    }

    orders
      .slice(0, 5)
      .forEach((order: Order) => {
        items.push({
          id: `order-${order.id}`,
          type: 'order',
          tone: 'success',
          timestamp: order.created_at,
          summary: `${order.purchaser_name || 'Customer'} booked ${order.total_seats || 1} seat${order.total_seats === 1 ? '' : 's'}`,
          detail: `${order.event?.title || 'Event order'} · ${formatCurrency(order.total_amount || 0)}`,
          to: '/admin/sales',
          actionLabel: 'View sale',
        });
      });

    return items.sort((a, b) => {
      if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }, [events, assignments, privateRequests, privateRequestMetadata, payRecords, products, membershipAdmin, orders, now, nowIso]);
}
