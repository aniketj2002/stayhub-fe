import { useMemo, useState } from 'react';
import { Badge } from '../../components/ui';
import { getCurrentUserId } from '../auth/session';
import type { Conversation } from './types';

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isLoading?: boolean;
  isHost?: boolean;
}

function formatShortDateRange(checkIn?: string, checkOut?: string): string {
  if (!checkIn || !checkOut) return '';
  try {
    const start = new Date(`${checkIn}T00:00:00`);
    const end = new Date(`${checkOut}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '';
    const sameMonth = start.getMonth() === end.getMonth();
    const startFmt = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endFmt = end.toLocaleDateString(
      'en-US',
      sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' },
    );
    return `${startFmt} – ${endFmt}`;
  } catch {
    return '';
  }
}

function formatConversationTimestamp(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  isLoading,
  isHost = false,
}: ConversationListProps) {
  const currentUserId = getCurrentUserId();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'unread'>('all');

  const totalUnread = useMemo(
    () => conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0),
    [conversations],
  );

  const filteredConversations = useMemo(() => {
    return conversations.filter((conv) => {
      if (filterMode === 'unread' && (!conv.unread_count || conv.unread_count <= 0)) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const guestMatch = (conv.guest_name || '').toLowerCase().includes(q);
      const hostMatch = (conv.host_name || '').toLowerCase().includes(q);
      const listingMatch = (conv.listing_title || '').toLowerCase().includes(q);
      const codeMatch = (conv.reservation_code || '').toLowerCase().includes(q);
      const bodyMatch = (conv.last_message?.body || '').toLowerCase().includes(q);
      return guestMatch || hostMatch || listingMatch || codeMatch || bodyMatch;
    });
  }, [conversations, filterMode, searchQuery]);

  if (isLoading) {
    return (
      <div className="conversation-list-container">
        <div className="conversation-list-header">
          <h3>Messages</h3>
        </div>
        <div className="conversation-list-loading">
          <div className="conversation-skeleton-item" />
          <div className="conversation-skeleton-item" />
          <div className="conversation-skeleton-item" />
          <p className="muted-text" style={{ textAlign: 'center', marginTop: '8px' }}>
            Loading conversations...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="conversation-list-container">
      <div className="conversation-list-header">
        <div className="conversation-header-top">
          <h3>Messages</h3>
          <span className="conversation-count-badge">
            {conversations.length} {conversations.length === 1 ? 'chat' : 'chats'}
          </span>
        </div>

        {conversations.length > 0 && (
          <div className="conversation-controls">
            <div className="conversation-search-box">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="search"
                className="conversation-search-input"
                placeholder="Search by name, listing, or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search conversations"
              />
            </div>

            <div className="conversation-filter-pills" role="tablist" aria-label="Filter conversations">
              <button
                type="button"
                role="tab"
                aria-selected={filterMode === 'all'}
                className={`conv-filter-pill ${filterMode === 'all' ? 'active' : ''}`}
                onClick={() => setFilterMode('all')}
              >
                All ({conversations.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={filterMode === 'unread'}
                className={`conv-filter-pill ${filterMode === 'unread' ? 'active' : ''}`}
                onClick={() => setFilterMode('unread')}
              >
                Unread {totalUnread > 0 ? `(${totalUnread})` : ''}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="conversation-list" role="list">
        {conversations.length === 0 ? (
          <div className="conversation-list-empty">
            <div className="empty-icon-circle" aria-hidden="true">
              💬
            </div>
            <h4>No conversations yet</h4>
            <p className="muted-text">
              Messages with your hosts and guests about reservations will appear here.
            </p>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="conversation-list-empty">
            <h4>No matching conversations</h4>
            <p className="muted-text">Try adjusting your search or filter.</p>
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const isSelected = conv.id === selectedId;
            const isCurrentUserGuest = currentUserId
              ? conv.guest_id === currentUserId
              : !isHost;
            const partnerName = isCurrentUserGuest
              ? conv.host_name || conv.guest_name || 'Host'
              : conv.guest_name || 'Guest';

            const initials = partnerName
              .split(' ')
              .filter(Boolean)
              .map((w) => w[0])
              .join('')
              .toUpperCase()
              .slice(0, 2) || 'SH';

            const hasUnread = conv.unread_count > 0;
            const isLastFromMe =
              currentUserId && conv.last_message?.sender_id === currentUserId;
            const rawBody =
              conv.last_message?.body ||
              (conv.last_message?.media_ids?.length ? '📷 Sent a photo' : 'No messages yet');
            const lastMessageText =
              conv.last_message && isLastFromMe ? `You: ${rawBody}` : rawBody;

            const timeStr = formatConversationTimestamp(
              conv.last_message?.created_at || conv.updated_at || conv.created_at,
            );
            const dateRange = formatShortDateRange(conv.check_in_date, conv.check_out_date);

            return (
              <button
                key={conv.id}
                type="button"
                className={`conversation-item ${isSelected ? 'conversation-item--selected' : ''} ${
                  hasUnread ? 'conversation-item--unread' : ''
                }`}
                onClick={() => onSelect(conv.id)}
                aria-selected={isSelected}
              >
                <div className="conversation-avatar-wrap">
                  <div className="conversation-avatar">{initials}</div>
                  {hasUnread && <span className="conversation-unread-dot" aria-hidden="true" />}
                </div>
                <div className="conversation-info">
                  <div className="conversation-top-row">
                    <span className="conversation-title">{partnerName}</span>
                    <span className="conversation-time">{timeStr}</span>
                  </div>
                  <div className="conversation-meta-row">
                    <span className="conversation-listing-title" title={conv.listing_title}>
                      {conv.listing_title}
                    </span>
                    {dateRange && (
                      <span className="conversation-dates-chip">· {dateRange}</span>
                    )}
                  </div>
                  <div className="conversation-preview-row">
                    <p className="conversation-preview">{lastMessageText}</p>
                    {hasUnread && (
                      <Badge tone="info" className="unread-badge">
                        {conv.unread_count}
                      </Badge>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
