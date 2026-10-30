import { CheckoutPage } from '../features/reservations/CheckoutPage';
import { TripsPage } from '../features/reservations/TripsPage';
import { ReservationPage } from '../features/reservations/ReservationPage';
import { HostTodayPage } from '../features/reservations/HostTodayPage';
import { EarningsPage } from '../features/earnings/EarningsPage';
import { Navigate } from 'react-router-dom';
import { HostListingsPage } from '../features/listings/HostListingsPage';
import { ListingEditorPage } from '../features/listings/ListingEditorPage';
import { HostCalendarPage } from '../features/calendar/HostCalendarPage';
import { SearchPage } from '../features/search/SearchPage';
import { ListingDetailPage } from '../features/search/ListingDetailPage';
import { createBrowserRouter } from 'react-router-dom';
import { AuthPage, AccountPage, MediaPage } from '../features/auth/pages';
import { RequireSession } from '../features/auth/guards';
import { AuthLayout, HostLayout, SiteLayout } from './layouts';
import { HealthPage, HomePage, NotFoundPage, RouteErrorPage } from './pages';

export const router = createBrowserRouter([
  {
    element: <SiteLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'system', element: <HealthPage /> },
      {
        path: 'account',
        element: (
          <RequireSession>
            <AccountPage />
          </RequireSession>
        ),
      },
      {
        path: 'account/media',
        element: (
          <RequireSession role="user">
            <MediaPage />
          </RequireSession>
        ),
      },
      {
        path: 'search',
        element: <SearchPage />,
      },
      {
        path: 'listings/:id',
        element: <ListingDetailPage />,
      },
      {
        path: 'checkout/:listingId',
        element: (
          <RequireSession role="user">
            <CheckoutPage />
          </RequireSession>
        ),
      },
      {
        path: 'trips',
        element: (
          <RequireSession role="user">
            <TripsPage />
          </RequireSession>
        ),
      },
      {
        path: 'trips/:id',
        element: (
          <RequireSession role="user">
            <ReservationPage />
          </RequireSession>
        ),
      },
      {
        element: <AuthLayout />,
        children: [
          {
            path: 'login',
            element: <AuthPage mode="login" />,
          },
          {
            path: 'register',
            element: <AuthPage mode="register" />,
          },
          {
            path: 'admin/login',
            element: <AuthPage mode="admin" />,
          },
        ],
      },
      {
        path: 'host',
        element: (
          <RequireSession role="host">
            <HostLayout />
          </RequireSession>
        ),
        children: [
          {
            index: true,
            element: <Navigate to="/host/listings" replace />,
          },
          {
            path: 'reservations/:id',
            element: <ReservationPage host />,
          },
          {
            path: 'today',
            element: <HostTodayPage />,
          },
          {
            path: 'listings',
            element: <HostListingsPage />,
          },
          {
            path: 'listings/:id/edit',
            element: <ListingEditorPage />,
          },
          {
            path: 'listings/:id/calendar',
            element: <HostCalendarPage />,
          },
          {
            path: 'earnings',
            element: <EarningsPage />,
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
