import React, { useState, useEffect, useRef } from 'react';
import { Bell, CheckCheck, Inbox } from 'lucide-react';
import { Link } from 'react-router-dom';
import moment from 'moment';
import { base44 } from '@/api/base44Client';
import { useGame } from '@/lib/gameContext';

export default function NotificationBell() {
  const { profile } = useGame();
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  // Stable reference to this user's id — the profile object itself is a fresh
  // reference on every token change, so depending on `profile` (object) here
  // would tear down and recreate our realtime subscription + refetch the list
  // on every heartbeat/token update. Depending on the scalar id avoids that.
  const userId = profile?.user_id;

  const loadNotifications = async () => {
    if (!userId) return;
    try {
      const notifs = await base44.entities.Notification.filter({ user_id: userId }, '-created_date', 20);
      setNotifications(notifs);
    } catch (e) {
      // Ignore transient read-volume limits; keep last known notifications
    }
  };

  useEffect(() => {
    if (!userId) return;
    loadNotifications();
    const unsubscribe = base44.entities.Notification.subscribe((event) => {
      if (event.type === 'delete') {
        setNotifications(prev => prev.some(n => n.id === event.id) ? prev.filter(n => n.id !== event.id) : prev);
        return;
      }
      if (event.data?.user_id !== userId) return;
      setNotifications(prev => {
        const row = { ...prev.find(n => n.id === event.id), ...event.data, id: event.id };
        return [row, ...prev.filter(n => n.id !== event.id)]
          .sort((a, b) => (b.created_date || '').localeCompare(a.created_date || '')).slice(0, 20);
      });
    });
    return () => { if (unsubscribe) unsubscribe(); };
  }, [userId]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.is_read);
    if (unread.length === 0) return;
    await base44.entities.Notification.bulkUpdate(unread.map(n => ({ id: n.id, is_read: true })));
    loadNotifications();
  };

  const handleNotifClick = (n) => {
    if (!n.is_read) base44.entities.Notification.update(n.id, { is_read: true });
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-1.5 rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-colors"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl border shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <span className="font-display text-sm text-panel">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-panel hover:underline flex items-center gap-1">
                <CheckCheck size={12} /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-8 text-center">
                <Inbox size={24} className="mx-auto text-muted-foreground mb-1" />
                <p className="text-xs text-muted-foreground">No notifications yet</p>
              </div>
            ) : notifications.map(n => (
              <div
                key={n.id}
                onClick={() => handleNotifClick(n)}
                className={`px-3 py-2 border-b last:border-0 cursor-pointer hover:bg-muted/50 ${!n.is_read ? 'bg-[#a7fcc9]/30' : ''}`}
              >
                {n.link ? (
                  <Link to={n.link} className="block">
                    <p className="text-xs font-display text-panel">{n.title}</p>
                    <p className="text-xs text-muted-foreground">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">{moment(n.created_date).fromNow()}</p>
                  </Link>
                ) : (
                  <>
                    <p className="text-xs font-display text-panel">{n.title}</p>
                    <p className="text-xs text-muted-foreground">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">{moment(n.created_date).fromNow()}</p>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}