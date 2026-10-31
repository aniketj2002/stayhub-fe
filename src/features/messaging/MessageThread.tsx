import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCurrentUserId } from '../auth/session';
import { PhotoUploader } from '../media/PhotoUploader';
import type { Media } from '../media/api';
import { useConversation, useMarkRead, useMessages, useSendMessage } from './api';
import { useMessagingSocket } from './socket';
import type { Message } from './types';

interface MessageThreadProps {
  conversationId: string;
  onBack?: () => void;
  isHost?: boolean;
}

function formatDayHeading(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function formatStayRange(checkIn?: string, checkOut?: string): string {
  if (!checkIn || !checkOut) return '';
  try {
    const start = new Date(`${checkIn}T00:00:00`);
    const end = new Date(`${checkOut}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '';
    const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = end.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    return `${startStr} – ${endStr}`;
  } catch {
    return '';
  }
}

function getAttachmentUrl(msg: Message, index: number, mediaId: string): string {
  if (msg.media_urls && msg.media_urls[index]) {
    return msg.media_urls[index];
  }
  return `/api/v1/media/${mediaId}/raw`;
}

const QUICK_REPLIES_GUEST = [
  'Hello! Looking forward to staying at your place.',
  'What time is check-in and how do we get the keys?',
  'Is early check-in or luggage drop-off available?',
];

const QUICK_REPLIES_HOST = [
  'Welcome! Let me know your estimated arrival time.',
  'Check-in is from 3:00 PM — I will share the door code before arrival.',
  'Please let me know if you need any local recommendations!',
];

export function MessageThread({ conversationId, onBack, isHost = false }: MessageThreadProps) {
  const currentUserId = getCurrentUserId();
  const { data: conversation } = useConversation(conversationId);
  const { data: messageData, isLoading } = useMessages(conversationId);
  const sendMessageMutation = useSendMessage();
  const markReadMutation = useMarkRead();
  const { isConnected, isPartnerTyping, sendTyping } = useMessagingSocket(conversationId);

  const [inputText, setInputText] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const [showUploader, setShowUploader] = useState(false);
  const [attachedMedia, setAttachedMedia] = useState<Media[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const historyRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const lastMarkedRef = useRef<string | null>(null);

  // Sort messages chronologically (oldest at top, newest at bottom)
  const messages = useMemo(() => {
    const raw = messageData?.messages || [];
    if (raw.length <= 1) return raw;
    return [...raw].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  }, [messageData?.messages]);

  const isCurrentUserGuest = useMemo(() => {
    if (!conversation) return !isHost;
    if (currentUserId) return conversation.guest_id === currentUserId;
    return !isHost;
  }, [conversation, currentUserId, isHost]);

  const partnerName = useMemo(() => {
    if (!conversation) return 'Host & Guest Conversation';
    if (isCurrentUserGuest) {
      return conversation.host_name || conversation.guest_name || 'Host';
    }
    return conversation.guest_name || 'Guest';
  }, [conversation, isCurrentUserGuest]);

  const partnerRoleLabel = isCurrentUserGuest ? 'Host' : 'Guest';
  const partnerInitials =
    partnerName
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'SH';

  // Mark conversation read once on load or when new unread messages arrive
  const latestMsgId = messages.length > 0 ? messages[messages.length - 1].id : '';
  useEffect(() => {
    if (!conversationId) return;
    const markKey = `${conversationId}:${latestMsgId}`;
    if (lastMarkedRef.current === markKey) return;
    lastMarkedRef.current = markKey;
    void markReadMutation.mutateAsync(conversationId);
  }, [conversationId, latestMsgId]);

  // Scroll message history container to bottom when conversation changes or message count grows
  useEffect(() => {
    const el = historyRef.current;
    if (el && typeof el.scrollTo === 'function') {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    } else {
      messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
    }
  }, [conversationId, messages.length]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputText.trim();
    if ((!trimmed && attachedMedia.length === 0) || sendMessageMutation.isPending) return;

    setSendError(null);
    sendTyping(false);
    try {
      await sendMessageMutation.mutateAsync({
        conversationId,
        input: {
          body: trimmed || (attachedMedia.length > 0 ? 'Sent photo attachment' : ''),
          ...(attachedMedia.length > 0 ? { media_ids: attachedMedia.map((m) => m.id) } : {}),
        },
      });
      setInputText('');
      setAttachedMedia([]);
      setShowUploader(false);
    } catch (err: unknown) {
      setSendError(err instanceof Error ? err.message : 'Failed to deliver message.');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const stayDatesStr = formatStayRange(conversation?.check_in_date, conversation?.check_out_date);
  const reservationLink = conversation?.reservation_id
    ? isCurrentUserGuest
      ? `/trips/${conversation.reservation_id}`
      : `/host/reservations/${conversation.reservation_id}`
    : null;

  const quickReplies = isCurrentUserGuest ? QUICK_REPLIES_GUEST : QUICK_REPLIES_HOST;

  return (
    <div className="message-thread-container">
      {/* Header */}
      <div className="message-thread-header">
        <div className="thread-header-left">
          {onBack && (
            <button type="button" className="btn btn-ghost btn-sm thread-back-btn" onClick={onBack}>
              ← Back
            </button>
          )}
          <div className="thread-partner-avatar" aria-hidden="true">
            {partnerInitials}
          </div>
          <div className="thread-partner-info">
            <div className="thread-partner-title-row">
              <h3 className="thread-partner-name">{partnerName}</h3>
              <span className="thread-role-pill">{partnerRoleLabel}</span>
              <span
                className="thread-status-pill"
                style={{
                  backgroundColor: isConnected ? '#ecfdf5' : '#f3f4f6',
                  color: isConnected ? '#065f46' : '#6b7280',
                  fontSize: '11px',
                }}
                title={isConnected ? 'Live WebSocket connection active' : 'Connecting to WebSocket...'}
              >
                {isConnected ? '● Live' : 'Connecting...'}
              </span>
              {conversation?.reservation_status && (
                <span
                  className={`thread-status-pill thread-status-pill--${conversation.reservation_status}`}
                >
                  {conversation.reservation_status.replace('_', ' ')}
                </span>
              )}
            </div>
            <div className="thread-subtitle-row">
              {conversation && (
                <Link
                  to={`/listings/${conversation.listing_id}`}
                  className="thread-listing-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {conversation.listing_title} ↗
                </Link>
              )}
              {stayDatesStr && <span className="thread-stay-meta">· {stayDatesStr}</span>}
              {conversation?.guests ? (
                <span className="thread-stay-meta">
                  · {conversation.guests} {conversation.guests === 1 ? 'guest' : 'guests'}
                </span>
              ) : null}
              {conversation?.reservation_code && (
                <span className="thread-code-badge">#{conversation.reservation_code}</span>
              )}
            </div>
          </div>
        </div>

        <div className="thread-header-actions">
          {reservationLink && (
            <Link to={reservationLink} className="thread-action-btn">
              Reservation
            </Link>
          )}
          <button
            type="button"
            className={`thread-action-btn ${showDetails ? 'active' : ''}`}
            onClick={() => setShowDetails((v) => !v)}
            aria-expanded={showDetails}
          >
            {showDetails ? 'Hide details' : 'Details'}
          </button>
        </div>
      </div>

      {/* Collapsible Reservation Context Strip */}
      {showDetails && conversation && (
        <div className="thread-reservation-drawer">
          <div className="drawer-card">
            {conversation.listing_cover_url && (
              <img
                src={conversation.listing_cover_url}
                alt={conversation.listing_title}
                className="drawer-listing-thumb"
              />
            )}
            <div className="drawer-info-grid">
              <div>
                <span className="drawer-label">PROPERTY</span>
                <strong className="drawer-val">
                  {conversation.listing_title}
                  {conversation.listing_city ? ` · ${conversation.listing_city}` : ''}
                </strong>
              </div>
              {stayDatesStr && (
                <div>
                  <span className="drawer-label">STAY DATES</span>
                  <strong className="drawer-val">{stayDatesStr}</strong>
                </div>
              )}
              {conversation.reservation_code && (
                <div>
                  <span className="drawer-label">CONFIRMATION CODE</span>
                  <strong className="drawer-val">{conversation.reservation_code}</strong>
                </div>
              )}
              <div>
                <span className="drawer-label">PROTECTION</span>
                <span className="drawer-protection-note">
                  🛡️ Always communicate and pay through StayHub
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="message-history" ref={historyRef}>
        {isLoading ? (
          <div className="thread-loading">
            <p className="muted-text">Loading conversation...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="thread-empty">
            <div className="thread-empty-card">
              <div className="thread-empty-avatar">{partnerInitials}</div>
              <h4>Start your conversation with {partnerName}</h4>
              <p className="muted-text">
                This conversation has no messages yet. Say hello or choose a quick message below!
              </p>
              <div className="quick-reply-chips">
                {quickReplies.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="quick-reply-chip"
                    onClick={() => setInputText(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = currentUserId ? msg.sender_id === currentUserId : false;
            const timeStr = new Date(msg.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });

            const dayHeading = formatDayHeading(msg.created_at);
            const prevDayHeading =
              idx > 0 ? formatDayHeading(messages[idx - 1].created_at) : null;
            const showDayDivider = dayHeading && dayHeading !== prevDayHeading;

            return (
              <div key={msg.id} className="message-item-group">
                {showDayDivider && (
                  <div className="message-day-divider">
                    <span>{dayHeading}</span>
                  </div>
                )}

                <div
                  className={`message-bubble-wrapper ${
                    isMe ? 'message--outgoing' : 'message--incoming'
                  }`}
                >
                  {/* Off-platform warning banner if message has flags or warning */}
                  {(msg.warning || (msg.flags && msg.flags.length > 0)) && (
                    <div className="off-platform-warning">
                      <span className="warning-icon" aria-hidden="true">
                        ⚠️
                      </span>
                      <div className="warning-text">
                        <strong>Security Notice:</strong>{' '}
                        {msg.warning ||
                          'StayHub detected off-platform contact or payment details. For your protection, never send payments or exchange contact numbers outside StayHub.'}
                      </div>
                    </div>
                  )}

                  <div className="message-row">
                    {!isMe && (
                      <div className="message-sender-mini-avatar" title={partnerName}>
                        {partnerInitials}
                      </div>
                    )}
                    <div className="message-bubble">
                      {!isMe && <span className="message-sender-label">{partnerName}</span>}
                      {msg.body && <div className="message-body">{msg.body}</div>}
                      {msg.media_ids && msg.media_ids.length > 0 && (
                        <div className="message-photos">
                          {msg.media_ids.map((id, mediaIdx) => {
                            const url = getAttachmentUrl(msg, mediaIdx, id);
                            return (
                              <button
                                key={id}
                                type="button"
                                className="message-photo-btn"
                                onClick={() => setLightboxUrl(url)}
                                title="Click to view full size"
                              >
                                <img
                                  src={url}
                                  alt="Attachment"
                                  className="message-photo-img"
                                  onError={(e) => {
                                    const img = e.currentTarget;
                                    if (!img.dataset.retried) {
                                      img.dataset.retried = '1';
                                      img.src = `/api/v1/media/${id}/raw`;
                                    } else {
                                      img.style.display = 'none';
                                    }
                                  }}
                                />
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <span className="message-timestamp">
                        {timeStr}
                        {isMe && ' · Delivered'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        {isPartnerTyping && (
          <div className="message-row message-row--partner" style={{ opacity: 0.85, marginBottom: '8px' }}>
            <div className="message-avatar" aria-hidden="true">
              {partnerInitials}
            </div>
            <div className="message-content-col">
              <div
                className="message-bubble message-bubble--received"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px' }}
              >
                <span style={{ fontSize: '13px', fontStyle: 'italic', color: '#6b7280' }}>
                  {partnerName} is typing...
                </span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Attachments preview */}
      {attachedMedia.length > 0 && (
        <div className="thread-attachments">
          {attachedMedia.map((m) => (
            <div key={m.id} className="attachment-preview-card">
              {m.public_url ? (
                <img src={m.public_url} alt="Attached preview" className="attachment-preview-img" />
              ) : (
                <span aria-hidden="true">📷</span>
              )}
              <span className="attachment-preview-label">Photo ready</span>
              <button
                type="button"
                className="attachment-remove-btn"
                onClick={() => setAttachedMedia((prev) => prev.filter((x) => x.id !== m.id))}
                aria-label="Remove photo"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Photo Uploader tray */}
      {showUploader && (
        <div className="thread-uploader-tray">
          <div className="thread-uploader-header">
            <strong>Attach photos to message</strong>
            <button
              type="button"
              className="thread-uploader-close"
              onClick={() => setShowUploader(false)}
            >
              Close
            </button>
          </div>
          <PhotoUploader
            purpose="evidence"
            multiple={true}
            onUploaded={(media) => setAttachedMedia((prev) => [...prev, media])}
          />
        </div>
      )}

      {/* Input Area */}
      <form onSubmit={handleSend} className="message-input-form">
        {sendError && (
          <div className="alert alert-danger message-alert" role="alert">
            <span>{sendError}</span>
            <button
              type="button"
              className="message-alert-dismiss"
              onClick={() => setSendError(null)}
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}
        <div className="message-input-wrapper">
          <button
            type="button"
            className={`btn btn-ghost btn-sm thread-attach-btn ${showUploader ? 'active' : ''}`}
            onClick={() => setShowUploader(!showUploader)}
            title="Attach photo"
            aria-label="Attach photo"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </button>
          <textarea
            className="message-textarea"
            rows={2}
            placeholder="Write a message... (Press Enter to send, Shift+Enter for new line)"
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              sendTyping(e.target.value.trim().length > 0);
            }}
            onBlur={() => sendTyping(false)}
            onKeyDown={handleKeyDown}
          />
          <button
            type="submit"
            className="btn btn-primary message-send-btn"
            disabled={(!inputText.trim() && attachedMedia.length === 0) || sendMessageMutation.isPending}
          >
            {sendMessageMutation.isPending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </form>

      {/* Photo Lightbox */}
      {lightboxUrl && (
        <div
          className="message-lightbox-backdrop"
          onClick={() => setLightboxUrl(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Image attachment preview"
        >
          <div className="message-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="message-lightbox-close"
              onClick={() => setLightboxUrl(null)}
              aria-label="Close preview"
            >
              ×
            </button>
            <img src={lightboxUrl} alt="Full attachment" className="message-lightbox-img" />
          </div>
        </div>
      )}
    </div>
  );
}
