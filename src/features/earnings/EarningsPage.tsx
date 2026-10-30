import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { EmptyState, Skeleton } from '../../components/ui';
import { formatMoney, formatStayDate } from '../../lib/format';
import { hostListings, listingKeys } from '../listings/api';
import { getEarnings, reservationKeys } from '../reservations/api';

export function EarningsPage() {
  const [selectedListing, setSelectedListing] = useState('all');
  const [selectedRange, setSelectedRange] = useState('all');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const access = useQuery({
    queryKey: listingKeys.all,
    queryFn: ({ signal }) => hostListings(signal),
    staleTime: 0,
  });

  // Co-hosts specifically lacking insights permission are blocked from earnings.
  const hasCohostNoInsights =
    Boolean(access.data?.listings?.length) &&
    Boolean(
      access.data?.listings?.every(
        (listing) =>
          listing.host_access?.role === 'cohost' && !listing.host_access?.can_view_insights,
      ),
    );
  const allowed = Boolean(access.isSuccess && !hasCohostNoInsights);

  const query = useQuery({
    queryKey: reservationKeys.earnings,
    queryFn: ({ signal }) => getEarnings(signal),
    enabled: allowed,
    staleTime: 0,
    refetchInterval: 30000,
    retry: false,
  });

  const currency = query.data?.currency || 'EUR';

  // Filter payouts by selected listing and date range from DB data
  const filteredPayouts = useMemo(() => {
    if (!query.data?.payouts) return [];
    return query.data.payouts.filter((item) => {
      if (selectedListing !== 'all' && item.listing_id !== selectedListing) {
        return false;
      }
      if (selectedRange === 'this-year') {
        const year = new Date().getFullYear().toString();
        if (!item.check_in.startsWith(year)) return false;
      }
      return true;
    });
  }, [query.data?.payouts, selectedListing, selectedRange]);

  // Aggregate monthly payouts dynamically from real DB payouts
  const monthlyChartData = useMemo(() => {
    if (!query.data?.payouts?.length) return [];
    const monthTotals = new Map<string, number>();

    for (const item of query.data.payouts) {
      if (item.payout.status === 'released' || item.payout.status === 'scheduled') {
        const monthKey = item.check_in.slice(0, 7); // "YYYY-MM"
        monthTotals.set(monthKey, (monthTotals.get(monthKey) || 0) + item.payout.net_minor);
      }
    }

    const sortedMonths = Array.from(monthTotals.keys()).sort();
    if (sortedMonths.length === 0) return [];

    const maxVal = Math.max(...Array.from(monthTotals.values()), 1);
    const currentMonthKey = new Date().toISOString().slice(0, 7);

    return sortedMonths.map((mKey) => {
      const totalMinor = monthTotals.get(mKey) || 0;
      const date = new Date(`${mKey}-01T00:00:00Z`);
      const monthShort = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
      const barLabel =
        totalMinor >= 100000
          ? `€${(totalMinor / 100000).toFixed(1)}k`
          : `€${Math.round(totalMinor / 100)}`;
      return {
        key: mKey,
        month: monthShort,
        totalMinor,
        label: barLabel,
        heightPct: Math.max(10, Math.round((totalMinor / maxVal) * 100)),
        active: mKey === currentMonthKey,
      };
    });
  }, [query.data?.payouts, currency]);

  // Upcoming and held items directly from DB payouts
  const upcomingAndHeld = useMemo(() => {
    if (!query.data?.payouts) return [];
    return query.data.payouts.filter(
      (item) => item.payout.status === 'scheduled' || item.payout.status === 'held',
    );
  }, [query.data?.payouts]);

  if (access.isPending) {
    return (
      <section className="host-earnings-page">
        <Skeleton label="Checking earnings access" />
      </section>
    );
  }

  if (!allowed) {
    return (
      <section className="host-earnings-page">
        <EmptyState title="Earnings access is required">
          Earnings are available for listings you own or where you have insights permission.
        </EmptyState>
      </section>
    );
  }

  if (query.isPending && !query.data) {
    return (
      <section className="host-earnings-page">
        <Skeleton label="Loading earnings" />
      </section>
    );
  }

  const paidOutText = formatMoney(query.data?.paid_minor || 0, currency);
  const upcomingText = formatMoney(query.data?.upcoming_minor || 0, currency);
  const heldText = formatMoney(query.data?.held_minor || 0, currency);
  const cancelledText = formatMoney(query.data?.cancelled_minor || 0, currency);

  return (
    <section className="host-earnings-page">
      {toastMsg && (
        <div className="host-toast" role="status">
          {toastMsg}
        </div>
      )}

      {/* Top Header Row with dropdowns & action buttons */}
      <div className="host-page-top-bar">
        <div className="host-page-title-controls">
          <h1 className="host-page-main-title">Earnings</h1>
          <div className="host-select-group">
            <select
              className="host-pill-select"
              value={selectedListing}
              onChange={(e) => setSelectedListing(e.target.value)}
              aria-label="Filter listings"
            >
              <option value="all">All listings</option>
              {access.data?.listings?.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title || 'Listing'}
                </option>
              ))}
            </select>

            <select
              className="host-pill-select"
              value={selectedRange}
              onChange={(e) => setSelectedRange(e.target.value)}
              aria-label="Select date range"
            >
              <option value="all">All time</option>
              <option value="this-year">This year ({new Date().getFullYear()})</option>
            </select>
          </div>
        </div>

        <div className="host-page-top-actions">
          <button
            type="button"
            className="host-outline-action-btn"
            onClick={() => showToast('Payout methods: default bank transfer active.')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
            <span>Payout methods</span>
          </button>

          <button
            type="button"
            className="host-outline-action-btn"
            onClick={() => showToast('Tax summary ready for download.')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <span>Tax documents</span>
          </button>

          <button
            type="button"
            className="host-outline-action-btn"
            onClick={() => {
              if (!filteredPayouts.length) {
                showToast('No transaction data to export.');
                return;
              }
              const rows = [
                ['Code', 'Listing', 'Check-in', 'Check-out', 'Gross', 'Fee', 'Net', 'Status'],
                ...filteredPayouts.map((i) => [
                  i.reservation_code,
                  i.listing_title,
                  i.check_in,
                  i.check_out,
                  (i.payout.gross_minor / 100).toFixed(2),
                  (i.payout.host_fee_minor / 100).toFixed(2),
                  (i.payout.net_minor / 100).toFixed(2),
                  i.payout.status,
                ]),
              ];
              const csv = rows.map((r) => r.join(',')).join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `stayhub-earnings-${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
              showToast('Exported earnings CSV.');
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Stat Cards with real DB data */}
      <div className="host-kpi-grid">
        <article className="host-kpi-card">
          <p className="host-kpi-eyebrow">PAID OUT</p>
          <strong className="host-kpi-value">{paidOutText}</strong>
          <span className="host-kpi-subtext">after host fees</span>
        </article>

        <article className="host-kpi-card">
          <p className="host-kpi-eyebrow">UPCOMING PAYOUTS</p>
          <strong className="host-kpi-value">{upcomingText}</strong>
          <span className="host-kpi-subtext">
            {query.data?.payouts?.filter((p) => p.payout.status === 'scheduled').length || 0} reservation(s) scheduled
          </span>
        </article>

        <article className="host-kpi-card">
          <p className="host-kpi-eyebrow">HELD</p>
          <strong className="host-kpi-value">{heldText}</strong>
          <span className="host-kpi-subtext">
            {query.data?.payouts?.filter((p) => p.payout.status === 'held').length || 0} reservation(s) under review
          </span>
        </article>

        <article className="host-kpi-card">
          <p className="host-kpi-eyebrow">CANCELLED</p>
          <strong className="host-kpi-value">{cancelledText}</strong>
          <span className="host-kpi-subtext">cancelled reservation refunds</span>
        </article>
      </div>

      {/* 2-Column Main Section */}
      <div className="host-earnings-two-columns">
        {/* Left Column: Monthly payouts chart + Upcoming & Held + Payout destination */}
        <div className="host-earnings-left-col">
          {/* Monthly Payouts Bar Chart Card from DB */}
          <div className="host-chart-card">
            <div className="host-card-header-simple">
              <h2 className="host-card-title">Monthly payouts</h2>
            </div>

            <div className="host-chart-body">
              {monthlyChartData.length === 0 ? (
                <p className="muted" style={{ padding: '24px 0', textAlign: 'center', fontSize: '13px' }}>
                  No historical payout records in database yet.
                </p>
              ) : (
                <div className="host-chart-canvas">
                  <div className="host-chart-grid-lines">
                    <div className="host-chart-grid-line" />
                    <div className="host-chart-grid-line" />
                    <div className="host-chart-grid-line" />
                  </div>
                  <div className="host-chart-bars">
                    {monthlyChartData.map((bar) => (
                      <div className="host-chart-col" key={bar.key}>
                        <span className="host-chart-bar-value">{bar.label}</span>
                        <div className="host-chart-bar-track">
                          <div
                            className={`host-chart-bar-fill ${bar.active ? 'active' : ''}`}
                            style={{ height: `${bar.heightPct}%` }}
                          />
                        </div>
                        <span className="host-chart-bar-month">{bar.month}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="host-chart-footer">
              <span>{filteredPayouts.length} total transaction(s) recorded</span>
              <span>Currency: {currency}</span>
            </div>
          </div>

          {/* Upcoming & Held Card from DB */}
          <div className="host-upcoming-held-card">
            <div className="host-card-header-simple">
              <h2 className="host-card-eyebrow-title">UPCOMING AND HELD</h2>
            </div>

            <div className="host-upcoming-held-list">
              {upcomingAndHeld.length === 0 ? (
                <p className="muted" style={{ fontSize: '13px', margin: 0 }}>
                  No payouts currently scheduled or held.
                </p>
              ) : (
                upcomingAndHeld.map((item) => (
                  <div className="host-upcoming-held-row" key={item.payout.id}>
                    <div className="host-upcoming-row-left">
                      <span className="host-upcoming-guest-desc">
                        {item.guest_name ? `${item.guest_name} · ` : ''}
                        {item.reservation_code}
                      </span>
                      <small className="host-tx-res-code">
                        {item.listing_title} ({item.check_in.slice(5)} – {item.check_out.slice(5)})
                      </small>
                    </div>
                    <div className="host-upcoming-row-right">
                      <span className="host-upcoming-amount">
                        Net: {formatMoney(item.payout.net_minor, item.payout.currency || currency)}
                      </span>
                      <span className={`host-status-badge host-status-badge--${item.payout.status}`}>
                        Payout {item.payout.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Payout Destination Info Box */}
            <div className="host-payout-destination-box">
              <div className="host-payout-dest-left">
                <div className="host-payout-dest-icon" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="2" y="5" width="20" height="14" rx="2" />
                    <line x1="2" y1="10" x2="22" y2="10" />
                  </svg>
                </div>
                <div className="host-payout-dest-info">
                  <strong className="host-payout-dest-title">Standard Host Payout Account</strong>
                  <span className="host-payout-dest-sub">Automatic bank transfer · 24h after check-in</span>
                </div>
              </div>
              <button
                type="button"
                className="host-pill-small-btn"
                onClick={() => showToast('Payout accounts managed in host settings.')}
              >
                Settings
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Real DB Transactions Card & Table */}
        <div className="host-earnings-right-col">
          <div className="host-transactions-card">
            <div className="host-transactions-header">
              <h2 className="host-card-title">Transactions</h2>
              <span className="host-transactions-subnote">
                Gross = nights × rate + cleaning fee · payouts release 24 h after check-in
              </span>
            </div>

            <div className="host-transactions-table-wrap">
              <table className="host-transactions-table">
                <thead>
                  <tr>
                    <th scope="col" style={{ width: '24%' }}>RESERVATION / GUEST</th>
                    <th scope="col" style={{ width: '18%' }}>LISTING</th>
                    <th scope="col" style={{ width: '15%' }}>DATES</th>
                    <th scope="col" className="text-right" style={{ width: '11%' }}>GROSS</th>
                    <th scope="col" className="text-right" style={{ width: '12%' }}>HOST FEE</th>
                    <th scope="col" className="text-right" style={{ width: '11%' }}>NET</th>
                    <th scope="col" className="text-center" style={{ width: '9%' }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayouts.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '36px 12px', color: '#6b7280' }}>
                        No transactions recorded in database for this selection.
                      </td>
                    </tr>
                  ) : (
                    filteredPayouts.map((item) => {
                      const guestName = item.guest_name || item.reservation_code;
                      const initials = guestName
                        .split(' ')
                        .map((p) => p[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2) || 'ST';

                      return (
                        <tr key={item.payout.id}>
                          <td>
                            <div className="host-tx-guest-cell">
                              <span className="host-tx-avatar">{initials}</span>
                              <div className="host-tx-guest-text">
                                <span className="host-tx-guest-name">{guestName}</span>
                                <small className="host-tx-res-code">
                                  <Link to={`/host/reservations/${item.payout.reservation_id}`}>
                                    {item.reservation_code}
                                  </Link>
                                </small>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="host-tx-listing-name">{item.listing_title}</span>
                          </td>
                          <td>
                            <span className="host-tx-dates">
                              {formatStayDate(item.check_in.slice(0, 10))} – {formatStayDate(item.check_out.slice(0, 10))}
                            </span>
                          </td>
                          <td className="text-right host-tx-number">
                            {formatMoney(item.payout.gross_minor, item.payout.currency || currency)}
                          </td>
                          <td className="text-right host-tx-number">
                            <span className="host-fee-sign">-</span>
                            <span>{formatMoney(item.payout.host_fee_minor, item.payout.currency || currency)}</span>
                          </td>
                          <td className="text-right host-tx-number font-medium">
                            {formatMoney(item.payout.net_minor, item.payout.currency || currency)}
                          </td>
                          <td className="text-center">
                            <span className={`host-status-badge host-status-badge--${item.payout.status}`}>
                              {item.payout.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="host-transactions-footer">
              <span>
                Showing {filteredPayouts.length} of {query.data?.payouts?.length || 0} payout record(s) from database · payout date = check-in + 24 h
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}