'use client';

import { Bell, CheckCheck, CircleDollarSign, ClipboardList, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { useBusiness } from '../../src/context/BusinessContext';
import { formatRelativeDate } from '../../src/utils/format';
import { selectNotificationsForUser } from '../lib/role-dashboard';

export function EnterpriseNotificationCentre() {
  const { state, currentUser, markNotificationsRead } = useBusiness();
  const [open, setOpen] = useState(false);
  const notifications = useMemo(() => selectNotificationsForUser(state.notifications, currentUser), [currentUser, state.notifications]);
  const unread = notifications.filter((notification) => !notification.readByUserIds.includes(currentUser.userId));

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  return <div className="notification-centre">
    <button className={open ? 'notification-trigger notification-trigger--active' : 'notification-trigger'} type="button" title="Notifications" aria-label={`${unread.length} unread notifications`} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      <Bell size={17} />
      {unread.length ? <span>{unread.length > 9 ? '9+' : unread.length}</span> : null}
    </button>
    {open ? <><button className="notification-dismiss" type="button" aria-label="Close notifications" onClick={() => setOpen(false)} /><section className="notification-popover" aria-label="Notifications">
      <header><div><p className="eyebrow">Enterprise inbox</p><h2>Notifications</h2></div>{unread.length ? <button type="button" onClick={() => markNotificationsRead(unread.map((notification) => notification.id))}><CheckCheck size={14} /> Mark all read</button> : null}</header>
      <div className="notification-list">
        {notifications.slice(0, 8).map((notification) => {
          const isUnread = !notification.readByUserIds.includes(currentUser.userId);
          const Icon = notification.entityType === 'purchase' ? ClipboardList : notification.entityType === 'payable' ? CircleDollarSign : ShieldCheck;
          const content = <><i><Icon size={15} /></i><span><strong>{notification.title}</strong><small>{notification.message}</small><b>{notification.referenceNumber ? `${notification.referenceNumber} · ` : ''}{formatRelativeDate(notification.createdAt)}</b></span>{isUnread ? <em title="Unread" /> : null}</>;
          return notification.actionUrl
            ? <Link href={notification.actionUrl} className={isUnread ? 'notification-item notification-item--unread' : 'notification-item'} key={notification.id} onClick={() => { markNotificationsRead([notification.id]); setOpen(false); }}>{content}</Link>
            : <button type="button" className={isUnread ? 'notification-item notification-item--unread' : 'notification-item'} key={notification.id} onClick={() => markNotificationsRead([notification.id])}>{content}</button>;
        })}
        {!notifications.length ? <div className="notification-empty"><Bell size={21} /><strong>Inbox clear</strong><span>Workflow approvals, settlements, and workspace events addressed to you will appear here.</span></div> : null}
      </div>
      {notifications.length > 8 ? <footer>{notifications.length - 8} earlier notifications remain in your workspace history.</footer> : null}
    </section></> : null}
  </div>;
}
