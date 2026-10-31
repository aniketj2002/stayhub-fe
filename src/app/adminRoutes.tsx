/* eslint-disable react-refresh/only-export-components */
import { Navigate, type RouteObject } from 'react-router-dom';
import { ReservationSearchPage } from '../features/admin/reservations/ReservationSearchPage';
import { ReservationDetailPage } from '../features/admin/reservations/ReservationDetailPage';
import { ReviewQueuePage } from '../features/admin/listings/ReviewQueuePage';
import { VersionDiffPage } from '../features/admin/listings/VersionDiffPage';
import { FeeConfigPage } from '../features/admin/fees/FeeConfigPage';
import { AuditLogPage } from '../features/admin/audit/AuditLogPage';
import { AdminsPage } from '../features/admin/admins/AdminsPage';
import { EmptyState, DataTable } from '../components/ui';

/**
 * =========================================================================
 * PHASE 5 PLACEHOLDER / DUMMY COMPONENTS (PENDING B-P5 / F-P5)
 * =========================================================================
 * The Case management endpoints (GET /admin/cases, POST /cases, etc.) are
 * scheduled for Backend Phase 5. In compliance with the coordination rule,
 * these dummy components remain in place with explicit comments for the
 * Phase 5 agent to replace them once B-P5 is merged.
 */

/**
 * DUMMY COMPONENT - PENDING FRONTEND PHASE 5 (F-P5)
 * Backend endpoint: GET /admin/cases
 * Next agent: Replace with `CaseListPage` from `src/features/admin/cases/CaseListPage.tsx`.
 */
export function AdminCasesPage() {
  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Cases & Damage Claims</h1>
          <p className="admin-page-subtitle">Track disputes, security deposit claims, and support escalations.</p>
        </div>
      </div>
      <div className="admin-card">
        <DataTable
          columns={[
            { key: 'case_code', header: 'Case #' },
            { key: 'category', header: 'Category' },
            { key: 'priority', header: 'Priority' },
            { key: 'status', header: 'Status' },
            { key: 'assignee', header: 'Assignee' },
            { key: 'sla', header: 'SLA' },
          ]}
          data={[]}
          emptyState={
            <EmptyState
              title="No Open Cases"
              action={
                <p className="admin-pending-note">
                  {/* Backend Phase 5 pending: GET /admin/cases */}
                  Case management endpoints will be integrated in F-P5.
                </p>
              }
            >
              There are currently no active claims or escalated disputes.
            </EmptyState>
          }
        />
      </div>
    </div>
  );
}

/**
 * DUMMY COMPONENT - PENDING FRONTEND PHASE 5 (F-P5)
 * Backend endpoint: GET /admin/cases/:id
 * Next agent: Replace with `CaseDetailPage` from `src/features/admin/cases/CaseDetailPage.tsx`.
 */
export function AdminCaseDetailPage() {
  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Case Detail</h1>
          <p className="admin-page-subtitle">Case notes, evidence inspection, and resolution decisions.</p>
        </div>
      </div>
      <EmptyState title="Case Detail Pending F-P5">
        {/* Backend Phase 5 pending: GET /admin/cases/:id */}
        Case resolution workflow will be wired in Frontend Phase 5.
      </EmptyState>
    </div>
  );
}

/**
 * Route objects configuration mounted under `/admin/*`
 */
export const adminRoutes: RouteObject[] = [
  {
    index: true,
    element: <Navigate to="reservations" replace />,
  },
  {
    path: 'reservations',
    element: <ReservationSearchPage />,
  },
  {
    path: 'reservations/:id',
    element: <ReservationDetailPage />,
  },
  {
    path: 'listings',
    element: <Navigate to="/admin/listing-reviews" replace />,
  },
  {
    path: 'listing-reviews',
    element: <ReviewQueuePage />,
  },
  {
    path: 'listing-reviews/:versionId/diff',
    element: <VersionDiffPage />,
  },
  {
    path: 'cases',
    element: <AdminCasesPage />,
  },
  {
    path: 'cases/:id',
    element: <AdminCaseDetailPage />,
  },
  {
    path: 'fees',
    element: <FeeConfigPage />,
  },
  {
    path: 'audit',
    element: <AuditLogPage />,
  },
  {
    path: 'admins',
    element: <AdminsPage />,
  },
];
