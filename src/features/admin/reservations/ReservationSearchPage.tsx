import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAdminReservations } from './api';
import type { AdminReservationSummary } from './types';
import { Badge, Button, DataTable, EmptyState, Field, RequestError, type BadgeTone } from '../../../components/ui';

function getStatusTone(status: string): BadgeTone {
  switch (status.toLowerCase()) {
    case 'confirmed':
    case 'completed':
      return 'success';
    case 'pending':
    case 'awaiting_payment':
      return 'warning';
    case 'cancelled':
    case 'expired':
      return 'danger';
    case 'disputed':
      return 'accent';
    default:
      return 'neutral';
  }
}

export function ReservationSearchPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const codeFromUrl = searchParams.get('code') ?? '';
  const [codeFilter, setCodeFilter] = useState(codeFromUrl);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    setCodeFilter(codeFromUrl);
    setPage(1);
  }, [codeFromUrl]);

  const { data, isLoading, error, refetch } = useAdminReservations({
    code: codeFilter || undefined,
    status: statusFilter || undefined,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  const reservations = data?.reservations || [];
  const totalCount = data?.total ?? 0;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Reservations</h1>
          <p className="admin-page-subtitle">
            Search all bookings, inspect financial transactions, and manage reservations.
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="admin-filters-bar">
        <div className="admin-filter-field">
          <Field
            id="search-code"
            label="Reservation Code"
            placeholder="e.g. HMR7Q2KD"
            value={codeFilter}
            onChange={(e) => {
              setCodeFilter(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="admin-filter-field select-field">
          <label htmlFor="filter-status">Status</label>
          <select
            id="filter-status"
            className="admin-select"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {(codeFilter || statusFilter) && (
          <Button
            variant="ghost"
            className="admin-clear-filter-btn"
            onClick={() => {
              setCodeFilter('');
              setStatusFilter('');
              setPage(1);
            }}
          >
            Reset
          </Button>
        )}
      </div>

      {error ? (
        <RequestError error={error} onRetry={() => void refetch()} />
      ) : (
        <div className="admin-card">
          <DataTable<AdminReservationSummary>
            columns={[
              {
                key: 'code',
                header: 'Code',
                sortable: true,
                render: (row) => (
                  <span className="admin-code-cell">{row.reservation.code}</span>
                ),
              },
              {
                key: 'guest',
                header: 'Guest',
                render: (row) => (
                  <div className="admin-user-cell">
                    <strong>{row.guest.full_name}</strong>
                    <small>{row.guest.email}</small>
                  </div>
                ),
              },
              {
                key: 'host',
                header: 'Host',
                render: (row) => (
                  <div className="admin-user-cell">
                    <span>{row.host.full_name}</span>
                  </div>
                ),
              },
              {
                key: 'listing',
                header: 'Listing',
                render: (row) => (
                  <div className="admin-listing-cell">
                    <span>{row.listing.title}</span>
                    <small>{row.listing.city}, {row.listing.country}</small>
                  </div>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (row) => (
                  <Badge tone={getStatusTone(row.reservation.status)}>
                    {row.reservation.status}
                  </Badge>
                ),
              },
              {
                key: 'dates',
                header: 'Dates',
                render: (row) => (
                  <span className="admin-date-range">
                    {row.reservation.check_in} → {row.reservation.check_out}
                  </span>
                ),
              },
              {
                key: 'total',
                header: 'Total',
                align: 'right',
                render: (row) => (
                  <strong>
                    €
                    {(
                      (row.reservation.guest_total_minor ?? row.reservation.total_price_minor ?? 0) /
                      100
                    ).toFixed(2)}
                  </strong>
                ),
              },
            ]}
            data={reservations}
            keyField={(row) => row.reservation.id}
            loading={isLoading}
            currentPage={page}
            pageSize={pageSize}
            totalCount={totalCount}
            onPageChange={setPage}
            onRowClick={(row) => navigate(`/admin/reservations/${row.reservation.id}`)}
            emptyState={
              <EmptyState title="No Reservations Found">
                Try adjusting your search filters or check back later.
              </EmptyState>
            }
          />
        </div>
      )}
    </div>
  );
}

