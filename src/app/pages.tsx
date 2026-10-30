import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { Badge, Button, EmptyState, ErrorPanel, Skeleton } from '../components/ui';
import { ApiError } from '../lib/api';
import { getHealth } from '../lib/health';
import { searchListings } from '../features/listings/api';
import { CategoryBar } from '../features/search/CategoryBar';
import { ListingCardGrid } from '../features/search/ListingCardGrid';
import { SearchForm } from '../features/search/SearchForm';

export function HomePage() {
  const navigate = useNavigate();
  const [selectedCat, setSelectedCat] = useState('homes');
  const [totalBeforeTaxes, setTotalBeforeTaxes] = useState(true);

  // Consume live backend listings for explore sections
  const lisbonQuery = useQuery({
    queryKey: ['home', 'lisbon-stays'],
    queryFn: ({ signal }) =>
      searchListings(new URLSearchParams({ city: 'Lisbon', limit: '4' }), signal),
  });

  const trendingQuery = useQuery({
    queryKey: ['home', 'trending-stays'],
    queryFn: ({ signal }) => searchListings(new URLSearchParams({ limit: '4' }), signal),
  });

  const guestFavorites = lisbonQuery.data?.listings || [];
  const trendingStays = trendingQuery.data?.listings || [];

  const defaultParams = new URLSearchParams({
    city: 'Lisbon',
    country: 'PT',
    guests: '1',
  });

  return (
    <div className="explore-home">
      {/* Hero Section (Screen 01) */}
      <section className="explore-hero">
        <div className="explore-hero-content">
          <div className="explore-hero-text">
            <h1 className="explore-hero-title">Find a place to stay</h1>
            <p className="explore-hero-subtitle">
              Homes, experiences, and services in 260 cities, chosen by the people who live there.
            </p>
          </div>

          <div className="explore-hero-filter">
            <SearchForm
              params={defaultParams}
              onSearch={(next) => navigate(`/search?${next.toString()}`)}
              variant="hero"
            />
          </div>
        </div>
      </section>

      {/* Category Icons Bar (Screen 01) */}
      <section className="explore-categories-section">
        <CategoryBar
          selected={selectedCat}
          onSelect={setSelectedCat}
          onOpenFilters={() => navigate('/search')}
          totalBeforeTaxes={totalBeforeTaxes}
          onToggleTotalBeforeTaxes={setTotalBeforeTaxes}
        />
      </section>

      {/* Section 1: Guest favorites in Lisbon */}
      <section className="explore-section">
        <div className="explore-section-header">
          <div>
            <h2 className="explore-section-title">Guest favorites in Lisbon</h2>
            <p className="explore-section-subtitle">
              The most loved stays this season, by rating and return visits
            </p>
          </div>
          <Link to="/search?city=Lisbon&country=PT" className="section-see-all-link">
            See all stays
          </Link>
        </div>

        {lisbonQuery.isPending ? (
          <Skeleton label="Loading stays" rows={2} />
        ) : guestFavorites.length > 0 ? (
          <div className="explore-cards-grid">
            {guestFavorites.map((listing) => (
              <ListingCardGrid
                key={listing.id}
                listing={listing}
                paramsString={defaultParams.toString()}
                badge={listing.instant_book ? 'guest_favorite' : null}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No stays in Lisbon yet"
            action={
              <Link className="button button--secondary" to="/search">
                Explore all stays
              </Link>
            }
          >
            Check back soon or discover stays across other destinations.
          </EmptyState>
        )}
      </section>

      {/* Section 2: Trending this month */}
      <section className="explore-section">
        <div className="explore-section-header">
          <div>
            <h2 className="explore-section-title">Trending this month</h2>
            <p className="explore-section-subtitle">Goa and Kyoto are up 30% in searches</p>
          </div>
          <Link to="/search" className="section-see-all-link">
            Explore destinations
          </Link>
        </div>

        {trendingQuery.isPending ? (
          <Skeleton label="Loading trending stays" rows={2} />
        ) : trendingStays.length > 0 ? (
          <div className="explore-cards-grid">
            {trendingStays.map((listing) => (
              <ListingCardGrid
                key={listing.id}
                listing={listing}
                paramsString={defaultParams.toString()}
                badge={listing.instant_book ? 'guest_favorite' : null}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Explore our collections"
            action={
              <Link className="button button--primary" to="/search">
                Browse available stays
              </Link>
            }
          >
            Search destinations around the world to find your next stay.
          </EmptyState>
        )}
      </section>

      <hr className="explore-section-divider" />

      <div className="foundation-status">
        <span>Building a thoughtful way to stay.</span>
        <Link to="/system">
          Service status <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </div>
  );
}

export function PlannedPage({
  title,
  eyebrow,
  description,
  phase,
}: {
  title: string;
  eyebrow: string;
  description: string;
  phase: string;
}) {
  return (
    <section className="page-content">
      <div className="page-heading">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <EmptyState
        title="This space is taking shape"
        action={
          <Link className="button button--secondary" to="/">
            Back to home
          </Link>
        }
      >
        Available in {phase}. No bookings, account changes, or payments can be made here yet.
      </EmptyState>
    </section>
  );
}

export function HealthPage() {
  const query = useQuery({
    queryKey: ['system', 'health'],
    queryFn: ({ signal }) => getHealth(signal),
    retry: false,
    refetchInterval: 30_000,
  });
  const error = query.error instanceof ApiError ? query.error : undefined;
  return (
    <section className="page-content">
      <div className="page-heading">
        <p className="eyebrow">SYSTEM</p>
        <h1>Service status</h1>
        <p>Live connection to the StayHub backend.</p>
      </div>
      {query.isPending ? (
        <Skeleton label="Checking backend health" />
      ) : query.isError ? (
        <ErrorPanel
          title="Backend unavailable"
          message={error?.message || 'Unable to check service health.'}
          requestId={error?.requestId}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <div className="health-card">
          <div className="health-heading">
            <h2>StayHub API</h2>
            <Badge tone={query.data.status === 'ok' ? 'positive' : 'warning'}>
              {query.data.status === 'ok' ? 'Operational' : 'Degraded'}
            </Badge>
          </div>
          <dl>
            <div>
              <dt>PostgreSQL</dt>
              <dd>{query.data.services.postgres}</dd>
            </div>
            <div>
              <dt>Redis</dt>
              <dd>{query.data.services.redis}</dd>
            </div>
            <div>
              <dt>Version mode</dt>
              <dd>{query.data.version_mode}</dd>
            </div>
            <div>
              <dt>Last response</dt>
              <dd>
                <time dateTime={query.data.timestamp}>
                  {new Date(query.data.timestamp).toLocaleString()}
                </time>
              </dd>
            </div>
          </dl>
          <Button
            variant="secondary"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            {query.isFetching ? 'Checking…' : 'Check again'}
          </Button>
        </div>
      )}
      <p className="muted status-note">Checks every 30 seconds while this page is open.</p>
    </section>
  );
}

export function NotFoundPage() {
  return (
    <section className="page-content">
      <EmptyState
        title="This place isn’t on the map"
        action={
          <Link className="button button--primary" to="/">
            Return home
          </Link>
        }
      >
        The page may have moved, or the address may be incorrect.
      </EmptyState>
    </section>
  );
}

export function RouteErrorPage() {
  const error = useRouteError();
  return (
    <main className="page-content">
      <ErrorPanel
        title={
          isRouteErrorResponse(error)
            ? `${error.status} — Unable to open this page`
            : 'Unable to open this page'
        }
        message="Please reload the page or return home."
        onRetry={() => window.location.reload()}
      />
      <Link className="text-link" to="/">
        Return home
      </Link>
    </main>
  );
}
