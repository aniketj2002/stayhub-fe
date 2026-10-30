// NOTE: Backend API for host recent activity feed is not yet implemented.
// This component renders dummy activity items matching the reference design specification
// so that the UI remains stable and ready to consume real data once the backend endpoint is provided.

export interface ActivityItem {
  id: string;
  iconType: 'star' | 'eye' | 'gear' | 'pencil';
  title: string;
  timestamp: string;
}

const DEFAULT_ACTIVITIES: ActivityItem[] = [
  {
    id: 'act-1',
    iconType: 'star',
    title: 'New 5-star review from Rui on Azulejo Loft',
    timestamp: 'Today',
  },
  {
    id: 'act-2',
    iconType: 'eye',
    title: 'Garden house sent for review · automated checks passed',
    timestamp: 'Yesterday',
  },
  {
    id: 'act-3',
    iconType: 'gear',
    title: 'Smart Pricing adjusted 6 nights on Riverside studio',
    timestamp: 'Oct 2',
  },
  {
    id: 'act-4',
    iconType: 'pencil',
    title: 'You updated house rules on Azulejo Loft',
    timestamp: 'Sep 28',
  },
];

export function HostRecentActivity({
  activities = DEFAULT_ACTIVITIES,
}: {
  activities?: ActivityItem[];
}) {
  return (
    <section className="host-activity-section" aria-label="Recent activity">
      <div className="host-activity-card">
        <h3 className="host-activity-heading">RECENT ACTIVITY</h3>
        <ul className="host-activity-list">
          {activities.map((item) => (
            <li key={item.id} className="host-activity-item">
              <div className="host-activity-left">
                <span
                  className={`host-activity-icon host-activity-icon--${item.iconType}`}
                  aria-hidden="true"
                >
                  {item.iconType === 'star' && (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      stroke="currentColor"
                      strokeWidth="1"
                    >
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  )}
                  {item.iconType === 'eye' && (
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                  {item.iconType === 'gear' && (
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                  )}
                  {item.iconType === 'pencil' && (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                    </svg>
                  )}
                </span>
                <span className="host-activity-title">{item.title}</span>
              </div>
              <span className="host-activity-time">{item.timestamp}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
