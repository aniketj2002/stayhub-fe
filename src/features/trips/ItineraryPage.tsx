import { Link, useNavigate, useParams } from 'react-router-dom';
import { Badge, Skeleton } from '../../components/ui';
import { RequestError } from '../../components/RequestError';
import { formatMoney } from '../../lib/format';
import { useTripItinerary } from './api';
import { useGetOrCreateConversation } from '../messaging/api';

export function ItineraryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: itinerary, isLoading, error, refetch } = useTripItinerary(id);
  const getOrCreateConv = useGetOrCreateConversation();

  if (isLoading) {
    return (
      <div className="page-content itinerary-page">
        <Skeleton label="Loading your trip itinerary..." />
      </div>
    );
  }

  if (error || !itinerary) {
    return (
      <div className="page-content itinerary-page">
        <RequestError error={error || new Error('Itinerary not found')} onRetry={() => void refetch()} />
      </div>
    );
  }

  const isConfirmed =
    itinerary.status === 'confirmed' ||
    itinerary.status === 'checked_in' ||
    itinerary.status === 'completed' ||
    itinerary.status === 'reviewed';

  const handleMessageHost = async () => {
    try {
      const conv = await getOrCreateConv.mutateAsync(itinerary.reservation_id);
      navigate(`/messages/${conv.id}`);
    } catch {
      navigate('/messages');
    }
  };

  return (
    <div className="page-content itinerary-page">
      {/* Navigation Breadcrumb */}
      <div className="itinerary-nav">
        <Link to={`/trips/${itinerary.reservation_id}`} className="itinerary-back-link">
          ← Back to Reservation
        </Link>
      </div>

      {/* Hero Header */}
      <header className="itinerary-header">
        <div className="itinerary-header-info">
          <div className="itinerary-badge-row">
            <span className="itinerary-code">Code: {itinerary.code}</span>
            <Badge
              tone={
                itinerary.status === 'confirmed' || itinerary.status === 'completed'
                  ? 'success'
                  : 'neutral'
              }
            >
              {itinerary.status}
            </Badge>
          </div>
          <h1 className="itinerary-title">{itinerary.listing_title}</h1>
          <p className="itinerary-location">
            {itinerary.city}, {itinerary.country} · {itinerary.guests}{' '}
            {itinerary.guests === 1 ? 'guest' : 'guests'}
          </p>
        </div>

        {itinerary.cover_photo_url && (
          <div className="itinerary-cover-photo">
            <img src={itinerary.cover_photo_url} alt={itinerary.listing_title} />
          </div>
        )}
      </header>

      {/* Grid: Check-in Details + Host Contact */}
      <div className="itinerary-cards-grid">
        {/* Check-in & Address Card */}
        <div className="itinerary-card checkin-card">
          <h3>Check-in &amp; Key Details</h3>
          <div className="checkin-times-row">
            <div className="checkin-time-box">
              <span className="time-label">CHECK-IN</span>
              <strong className="time-date">{itinerary.check_in_date}</strong>
              <span className="time-hour">From {itinerary.check_in_time}</span>
            </div>
            <div className="checkin-time-box">
              <span className="time-label">CHECKOUT</span>
              <strong className="time-date">{itinerary.check_out_date}</strong>
              <span className="time-hour">Until {itinerary.check_out_time}</span>
            </div>
          </div>

          <div className="address-section">
            <span className="address-label">PROPERTY ADDRESS</span>
            {isConfirmed && itinerary.address ? (
              <p className="address-value">
                {itinerary.address}, {itinerary.city}, {itinerary.country}
              </p>
            ) : (
              <p className="address-value text-muted">
                🔒 Address will be unlocked once your reservation is confirmed.
              </p>
            )}
          </div>
        </div>

        {/* Host Info Card */}
        <div className="itinerary-card host-card">
          <h3>Your Host</h3>
          <div className="host-profile-row">
            <div className="host-avatar">
              {(itinerary.host_name || 'H')[0].toUpperCase()}
            </div>
            <div className="host-details">
              <strong>{itinerary.host_name || 'Listing Host'}</strong>
              <span className="host-email">{itinerary.host_email}</span>
            </div>
          </div>

          <div className="host-action-buttons">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleMessageHost}
              disabled={getOrCreateConv.isPending}
            >
              💬 {getOrCreateConv.isPending ? 'Connecting...' : 'Message Host'}
            </button>
          </div>
        </div>
      </div>

      {/* Day-by-Day Timeline */}
      {itinerary.timeline && itinerary.timeline.length > 0 && (
        <section className="itinerary-timeline-section">
          <h2>Day-by-Day Itinerary</h2>
          <div className="timeline-container">
            {itinerary.timeline.map((day, idx) => (
              <div
                key={day.date}
                className={`timeline-item ${
                  day.is_check_in
                    ? 'timeline-item--checkin'
                    : day.is_check_out
                    ? 'timeline-item--checkout'
                    : ''
                }`}
              >
                <div className="timeline-marker">
                  {day.is_check_in ? '🔑' : day.is_check_out ? '🚪' : idx + 1}
                </div>
                <div className="timeline-content">
                  <div className="timeline-date-row">
                    <span className="timeline-date">{day.date}</span>
                    <strong className="timeline-item-title">{day.title}</strong>
                  </div>
                  {day.description && <p className="timeline-desc">{day.description}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Receipts & Billing Breakdown */}
      <section className="itinerary-receipts-section">
        <h2>Receipts &amp; Payments</h2>

        <div className="itinerary-billing-summary">
          <div className="billing-row">
            <span>Nights Accommodation</span>
            <span>{formatMoney(itinerary.nightly_total_minor, itinerary.currency)}</span>
          </div>
          {itinerary.discount_minor > 0 && (
            <div className="billing-row discount-row" style={{ color: '#059669' }}>
              <span>Length-of-Stay Discount</span>
              <span>-{formatMoney(itinerary.discount_minor, itinerary.currency)}</span>
            </div>
          )}
          <div className="billing-row">
            <span>Cleaning Fee</span>
            <span>{formatMoney(itinerary.cleaning_fee_minor, itinerary.currency)}</span>
          </div>
          <div className="billing-row">
            <span>StayHub Guest Service Fee</span>
            <span>{formatMoney(itinerary.guest_fee_minor, itinerary.currency)}</span>
          </div>
          <div className="billing-row billing-row--total">
            <strong>Total Paid</strong>
            <strong>{formatMoney(itinerary.guest_total_minor, itinerary.currency)}</strong>
          </div>
        </div>

        {itinerary.receipts && itinerary.receipts.length > 0 && (
          <div className="receipts-transactions-list">
            <h4>Payment Transactions</h4>
            <div className="receipts-table-wrapper">
              <table className="receipts-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {itinerary.receipts.map((rcpt) => (
                    <tr key={rcpt.id}>
                      <td>{new Date(rcpt.created_at).toLocaleDateString()}</td>
                      <td>
                        <span className="capitalize">{rcpt.type}</span>
                      </td>
                      <td>
                        <Badge tone={rcpt.status === 'succeeded' ? 'success' : 'neutral'}>
                          {rcpt.status}
                        </Badge>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {rcpt.type === 'refund' ? '-' : ''}
                        {formatMoney(rcpt.amount_minor, itinerary.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

