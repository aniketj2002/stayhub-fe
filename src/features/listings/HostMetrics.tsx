// NOTE: Backend API for host dashboard overview metrics (occupancy, booked revenue,
// average rating, response rate) is not yet implemented.
// This component renders dummy data matching the reference design specification so that
// the UI remains stable and ready to consume real data once the backend endpoint is provided.

export interface HostMetricsProps {
  occupancyPercent?: number;
  occupancyMonth?: string;
  occupancySubtext?: string;
  bookedRevenue?: string;
  bookedRevenueMonth?: string;
  bookedRevenueSubtext?: string;
  averageRating?: string;
  ratingSubtext?: string;
  responseRatePercent?: number;
  responseRateSubtext?: string;
}

export function HostMetrics({
  occupancyPercent = 54,
  occupancyMonth = 'OCT',
  occupancySubtext = '2 listed homes',
  bookedRevenue = '€4,120',
  bookedRevenueMonth = 'OCT',
  bookedRevenueSubtext = 'after host fee',
  averageRating = '4.93',
  ratingSubtext = '276 reviews · 2 listings',
  responseRatePercent = 96,
  responseRateSubtext = 'avg 42 min',
}: HostMetricsProps) {
  return (
    <section className="host-metrics-section" aria-label="Hosting metrics overview">
      <div className="host-metrics-grid">
        <div className="host-metric-card">
          <span className="host-metric-label">OCCUPANCY · {occupancyMonth}</span>
          <div className="host-metric-value">{occupancyPercent}%</div>
          <span className="host-metric-subtext">{occupancySubtext}</span>
        </div>

        <div className="host-metric-card">
          <span className="host-metric-label">BOOKED REVENUE · {bookedRevenueMonth}</span>
          <div className="host-metric-value">{bookedRevenue}</div>
          <span className="host-metric-subtext">{bookedRevenueSubtext}</span>
        </div>

        <div className="host-metric-card">
          <span className="host-metric-label">AVERAGE RATING</span>
          <div className="host-metric-value">{averageRating}</div>
          <span className="host-metric-subtext">{ratingSubtext}</span>
        </div>

        <div className="host-metric-card">
          <span className="host-metric-label">RESPONSE RATE</span>
          <div className="host-metric-value">{responseRatePercent}%</div>
          <span className="host-metric-subtext">{responseRateSubtext}</span>
        </div>
      </div>
    </section>
  );
}
