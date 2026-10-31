import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Skeleton } from '../../components/ui';
import { RequestError } from '../../components/RequestError';
import { formatStayDate } from '../../lib/format';
import { hostListings, listingKeys } from '../listings/api';
import { useHostDateChangeRequests } from '../trips/api';
import { getEarnings, getToday, reservationKeys } from './api';
import { HostActions } from './HostActions';
import { Deadline, ReservationBadge } from './ReservationBits';
import type { ReservationDetail } from './types';

type FilterType =
  | 'all'
  | 'checking_out'
  | 'currently_hosting'
  | 'arriving_today'
  | 'upcoming'
  | 'pending_requests';

export function HostTodayPage() {
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const dateChanges = useHostDateChangeRequests();
  const pendingDateChanges = dateChanges.data?.alterations ?? [];

  const query = useQuery({
    queryKey: reservationKeys.today,
    queryFn: ({ signal }) => getToday(signal),
    staleTime: 0,
    refetchInterval: 30000,
    retry: false,
  });

  const listings = useQuery({
    queryKey: listingKeys.all,
    queryFn: ({ signal }) => hostListings(signal),
    staleTime: 0,
    retry: false,
  });

  const earnings = useQuery({
    queryKey: reservationKeys.earnings,
    queryFn: ({ signal }) => getEarnings(signal),
    staleTime: 0,
    retry: false,
  });

  const access = useMemo(
    () => new Map(listings.data?.listings?.map((l) => [l.id, l.host_access])),
    [listings.data?.listings],
  );

  const pendingRequests = useMemo(() => query.data?.pending_requests || [], [query.data?.pending_requests]);
  const arrivingToday = useMemo(() => query.data?.arriving_today || [], [query.data?.arriving_today]);
  const currentlyHosting = useMemo(() => query.data?.currently_hosting || [], [query.data?.currently_hosting]);
  const checkingOutToday = useMemo(() => query.data?.checking_out_today || [], [query.data?.checking_out_today]);
  const upcoming = useMemo(() => query.data?.upcoming || [], [query.data?.upcoming]);

  const totalCount =
    pendingRequests.length +
    arrivingToday.length +
    currentlyHosting.length +
    checkingOutToday.length +
    upcoming.length;

  // Stays happening today (currently hosting + arriving today)
  const todayStays = useMemo(
    () => [...currentlyHosting, ...arrivingToday],
    [currentlyHosting, arrivingToday],
  );

  // Filtered reservations based on selected pill
  const filteredList = useMemo(() => {
    switch (activeFilter) {
      case 'checking_out':
        return checkingOutToday;
      case 'currently_hosting':
        return currentlyHosting;
      case 'arriving_today':
        return arrivingToday;
      case 'upcoming':
        return upcoming;
      case 'pending_requests':
        return pendingRequests;
      case 'all':
      default:
        return todayStays;
    }
  }, [activeFilter, checkingOutToday, currentlyHosting, arrivingToday, upcoming, pendingRequests, todayStays]);

  // Draft listing currently in setup wizard
  const draftListing = useMemo(() => {
    return listings.data?.listings?.find((l) => l.status === 'draft') || listings.data?.listings?.[0];
  }, [listings.data?.listings]);

  const wizardStep = draftListing?.wizard_step || 1;
  const isDraftSetup = draftListing?.status === 'draft';

  // Subtitle date
  const todayDateStr = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }, []);

  if (query.isPending && listings.isPending) {
    return (
      <section className="host-today-page">
        <Skeleton label="Loading your hosting day" />
      </section>
    );
  }

  return (
    <section className="host-today-page">
      {toastMsg && (
        <div className="host-toast" role="status">
          {toastMsg}
        </div>
      )}

      {/* Page Header */}
      <div className="host-page-top-bar">
        <div className="host-page-title-controls">
          <h1 className="host-page-main-title">Today</h1>
          <p className="host-today-subtitle">
            {todayDateStr} · {currentlyHosting.length} guest(s) staying · {checkingOutToday.length} checkout(s) today
          </p>
        </div>

        <div className="host-page-top-actions">
          <Link to="/host/calendar" className="host-outline-action-btn">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span>Block dates</span>
          </Link>

          <Link to="/host/listings" className="host-pill-primary-btn">
            + Create listing
          </Link>
        </div>
      </div>

      {query.isError && (
        <RequestError error={query.error} onRetry={() => void query.refetch()} />
      )}

      {/* Yellow Alert Banner for real pending requests from DB */}
      {pendingDateChanges.length > 0 && (
        <div className="host-alert-banner">
          <div className="host-alert-left">
            <div className="host-alert-clock-circle" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div className="host-alert-text">
              <strong className="host-alert-headline">
                {pendingDateChanges.length} date change request(s) need your approval
              </strong>
              <p className="host-alert-subtext">
                {pendingDateChanges
                  .map((change) => {
                    const stay = change.reservation_code || 'Reservation';
                    const listing = change.listing_title ? ` · ${change.listing_title}` : '';
                    return `${stay}${listing} · ${change.current_check_in} – ${change.current_check_out} → ${change.new_check_in} – ${change.new_check_out}`;
                  })
                  .join(' · ')}
              </p>
            </div>
          </div>
          <Link
            className="host-alert-review-btn"
            style={{ textDecoration: 'none' }}
            to={`/host/reservations/${pendingDateChanges[0].reservation_id}?review=dates`}
          >
            Review request
          </Link>
        </div>
      )}

      {pendingRequests.length > 0 && (
        <div className="host-alert-banner">
          <div className="host-alert-left">
            <div className="host-alert-clock-circle" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div className="host-alert-text">
              <strong className="host-alert-headline">
                {pendingRequests.length} request(s) need a response within 24 hours
              </strong>
              <p className="host-alert-subtext">
                {pendingRequests
                  .map(
                    (p) =>
                      `${p.guest.full_name} · ${p.reservation.check_in.slice(5)} – ${p.reservation.check_out.slice(5)} · ${p.listing.title}`,
                  )
                  .join(' · ')}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="host-alert-review-btn"
            onClick={() => {
              setActiveFilter('pending_requests');
              showToast('Viewing pending requests');
            }}
          >
            Review requests
          </button>
        </div>
      )}

      {/* Filter Pills Bar with real counts */}
      <div className="host-pill-filter-bar" role="tablist" aria-label="Filter stays">
        <button
          type="button"
          role="tab"
          aria-selected={activeFilter === 'all'}
          className={`host-pill-filter ${activeFilter === 'all' ? 'active' : ''}`}
          onClick={() => setActiveFilter('all')}
        >
          All {totalCount}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeFilter === 'checking_out'}
          className={`host-pill-filter ${activeFilter === 'checking_out' ? 'active' : ''}`}
          onClick={() => setActiveFilter('checking_out')}
        >
          Checking out {checkingOutToday.length}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeFilter === 'currently_hosting'}
          className={`host-pill-filter ${activeFilter === 'currently_hosting' ? 'active' : ''}`}
          onClick={() => setActiveFilter('currently_hosting')}
        >
          Currently hosting {currentlyHosting.length}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeFilter === 'arriving_today'}
          className={`host-pill-filter ${activeFilter === 'arriving_today' ? 'active' : ''}`}
          onClick={() => setActiveFilter('arriving_today')}
        >
          Arriving today {arrivingToday.length}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeFilter === 'upcoming'}
          className={`host-pill-filter ${activeFilter === 'upcoming' ? 'active' : ''}`}
          onClick={() => setActiveFilter('upcoming')}
        >
          Upcoming {upcoming.length}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeFilter === 'pending_requests'}
          className={`host-pill-filter ${activeFilter === 'pending_requests' ? 'active' : ''}`}
          onClick={() => setActiveFilter('pending_requests')}
        >
          Pending requests {pendingRequests.length}
        </button>
      </div>

      {/* Two-Column Main Content */}
      <div className="host-today-two-columns">
        {/* Left Column */}
        <div className="host-today-left-col">
          {/* Active Section Header */}
          <div className="host-section-group">
            <h2 className="host-section-eyebrow">
              {activeFilter === 'pending_requests'
                ? `PENDING REQUESTS · ${pendingRequests.length}`
                : activeFilter === 'upcoming'
                  ? `UPCOMING STAYS · ${upcoming.length}`
                  : activeFilter === 'checking_out'
                    ? `CHECKING OUT TODAY · ${checkingOutToday.length}`
                    : `TODAY · ${currentlyHosting.length} HOSTING · ${arrivingToday.length} ARRIVING`}
            </h2>

            {filteredList.length === 0 ? (
              <div className="host-empty-filter-box">
                <p>No reservations in this category right now.</p>
                {activeFilter !== 'all' && (
                  <button
                    type="button"
                    className="host-pill-small-btn"
                    onClick={() => setActiveFilter('all')}
                  >
                    View all stays
                  </button>
                )}
              </div>
            ) : (
              <div className="host-today-cards-grid">
                {filteredList.map((detail: ReservationDetail) => {
                  const r = detail.reservation;
                  const initials = detail.guest.full_name
                    .split(' ')
                    .map((p) => p[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2) || 'GU';

                  return (
                    <article className="host-stay-card" key={r.id}>
                      <div className="host-stay-card-top">
                        <div className="host-stay-guest-info">
                          <span className="host-stay-avatar">{initials}</span>
                          <div className="host-stay-name-dates">
                            <strong className="host-stay-name">{detail.guest.full_name}</strong>
                            <span className="host-stay-dates">
                              {formatStayDate(r.check_in.slice(0, 10))} – {formatStayDate(r.check_out.slice(0, 10))} · {r.guests} guest(s)
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="host-stay-badges-row">
                        <ReservationBadge status={r.status} />
                        {r.status === 'confirmed' && (
                          <span className="host-stay-sub-badge host-stay-sub-badge--green">
                            Confirmed
                          </span>
                        )}
                      </div>

                      <p className="host-stay-listing-name">
                        {detail.listing.title} ({detail.listing.city})
                      </p>

                      {r.guest_message && (
                        <p className="guest-note" style={{ margin: 0, fontSize: '12px' }}>
                          “{r.guest_message}”
                        </p>
                      )}

                      {r.status === 'pending' && r.request_expires_at && (
                        <Deadline at={r.request_expires_at} onExpired={() => void query.refetch()} />
                      )}

                      <Link className="host-text-link" to={`/host/reservations/${r.id}`}>
                        View reservation #{r.code} ↗
                      </Link>

                      <div style={{ marginTop: 'auto', paddingTop: '8px' }}>
                        <HostActions
                          key={r.status}
                          detail={detail}
                          access={access.get(r.listing_id)}
                        />
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          {/* Upcoming Section from DB if not already filtering */}
          {activeFilter === 'all' && (
            <div className="host-section-group">
              <div className="host-section-eyebrow-row">
                <h2 className="host-section-eyebrow">UPCOMING · {upcoming.length}</h2>
                <Link to="/host/calendar" className="host-text-link">
                  Open calendar
                </Link>
              </div>

              <div className="host-list-container">
                {upcoming.length === 0 ? (
                  <p className="muted" style={{ padding: '20px', margin: 0, fontSize: '13px' }}>
                    No upcoming stays in database.
                  </p>
                ) : (
                  upcoming.slice(0, 5).map((up, idx) => {
                    const initials = up.guest.full_name
                      .split(' ')
                      .map((p) => p[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2) || 'GU';
                    return (
                      <div
                        className={`host-list-item-row ${idx > 0 ? 'border-top' : ''}`}
                        key={up.reservation.id}
                      >
                        <div className="host-list-left">
                          <span className="host-tx-avatar">{initials}</span>
                          <div className="host-list-info">
                            <strong className="host-list-guest-name">{up.guest.full_name}</strong>
                            <span className="host-list-subnote">
                              {formatStayDate(up.reservation.check_in.slice(0, 10))} – {formatStayDate(up.reservation.check_out.slice(0, 10))} · {up.listing.title}
                            </span>
                          </div>
                        </div>
                        <ReservationBadge status={up.reservation.status} />
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="host-today-right-col">
          {/* Widget 1: Listing Setup Progress Card directly from DB listings */}
          <div className="host-widget-card">
            <div className="host-widget-header-row">
              <h3 className="host-widget-title">
                {draftListing?.title || 'Listing setup'}
              </h3>
              <span className="host-widget-step-count">
                {isDraftSetup ? `${wizardStep} of 5` : 'Active'}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="host-progress-track" aria-hidden="true">
              <div
                className="host-progress-fill"
                style={{ width: `${isDraftSetup ? Math.round((wizardStep / 5) * 100) : 100}%` }}
              />
            </div>

            {/* Real checklist based on listing wizard state */}
            <ul className="host-checklist">
              <li className={`host-checklist-item ${wizardStep >= 1 ? 'completed' : 'pending'}`}>
                <span className={wizardStep >= 1 ? 'host-check-icon' : 'host-circle-icon'}>
                  {wizardStep >= 1 ? '✓' : '○'}
                </span>
                <span>Photos and title</span>
              </li>
              <li className={`host-checklist-item ${wizardStep >= 2 ? 'completed' : 'pending'}`}>
                <span className={wizardStep >= 2 ? 'host-check-icon' : 'host-circle-icon'}>
                  {wizardStep >= 2 ? '✓' : '○'}
                </span>
                <span>Amenities and house rules</span>
              </li>
              <li className={`host-checklist-item ${wizardStep >= 3 ? 'completed' : 'pending'}`}>
                <span className={wizardStep >= 3 ? 'host-check-icon' : 'host-circle-icon'}>
                  {wizardStep >= 3 ? '✓' : '○'}
                </span>
                <span>Pricing and availability</span>
              </li>
              <li className={`host-checklist-item ${wizardStep >= 4 ? 'completed' : 'pending'}`}>
                <span className={wizardStep >= 4 ? 'host-check-icon' : 'host-circle-icon'}>
                  {wizardStep >= 4 ? '✓' : '○'}
                </span>
                <span>Registration number (AL)</span>
              </li>
              <li className={`host-checklist-item ${wizardStep >= 5 ? 'completed' : 'pending'}`}>
                <span className={wizardStep >= 5 ? 'host-check-icon' : 'host-circle-icon'}>
                  {wizardStep >= 5 ? '✓' : '○'}
                </span>
                <span>Submit for review</span>
              </li>
            </ul>

            {draftListing ? (
              <Link
                to={`/host/listings/${draftListing.id}/edit`}
                className="host-widget-outline-full-btn"
              >
                {isDraftSetup ? 'Continue setup' : 'Edit listing'}
              </Link>
            ) : (
              <Link to="/host/listings" className="host-widget-outline-full-btn">
                Create a listing
              </Link>
            )}
          </div>

          {/* Widget 2: This Month Metrics calculated from DB */}
          <div className="host-widget-card">
            <p className="host-widget-eyebrow">THIS MONTH</p>
            <div className="host-metrics-rows">
              <div className="host-metric-row">
                <span className="host-metric-label">Listed homes</span>
                <strong className="host-metric-val">
                  {listings.data?.listings?.filter((l) => l.status === 'live').length || 0}
                </strong>
              </div>
              <div className="host-metric-row">
                <span className="host-metric-label">Active / Upcoming stays</span>
                <strong className="host-metric-val">{totalCount}</strong>
              </div>
              <div className="host-metric-row">
                <span className="host-metric-label">Paid earnings</span>
                <strong className="host-metric-val">
                  {earnings.data ? (earnings.data.paid_minor / 100).toLocaleString('en-US', { style: 'currency', currency: earnings.data.currency || 'EUR' }) : '€0'}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}