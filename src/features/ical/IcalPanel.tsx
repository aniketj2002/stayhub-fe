import { useState } from 'react';
import { useIcalFeeds, useAddIcalFeed, useDeleteIcalFeed, useRegenerateExportToken } from './api';
import { Button, Field, RequestError, Skeleton } from '../../components/ui';

interface Props {
  listingId: string;
}

export function IcalPanel({ listingId }: Props) {
  const { data: feeds, isLoading, error, refetch } = useIcalFeeds(listingId);
  const addFeedMutation = useAddIcalFeed();
  const deleteFeedMutation = useDeleteIcalFeed();
  const regenerateMutation = useRegenerateExportToken();

  const [feedName, setFeedName] = useState('');
  const [feedUrl, setFeedUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [validationError, setValidationError] = useState('');

  // Compute export URL
  const exportUrl = `${window.location.origin}/api/v1/listings/${listingId}/calendar.ics`;

  const handleAddFeed = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (!feedName.trim()) {
      setValidationError('Feed name is required (e.g. Airbnb, VRBO).');
      return;
    }

    if (!feedUrl.trim().startsWith('http://') && !feedUrl.trim().startsWith('https://')) {
      setValidationError('Please provide a valid web calendar URL starting with http:// or https://.');
      return;
    }

    await addFeedMutation.mutateAsync({
      listingId,
      input: {
        name: feedName.trim(),
        url: feedUrl.trim(),
      },
    });

    setFeedName('');
    setFeedUrl('');
  };

  const handleDeleteFeed = async (feedId: string) => {
    await deleteFeedMutation.mutateAsync({ listingId, feedId });
  };

  const handleCopyExportUrl = () => {
    void navigator.clipboard.writeText(exportUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = async () => {
    await regenerateMutation.mutateAsync(listingId);
  };

  return (
    <div className="ical-panel">
      <div className="ical-header">
        <h2>Calendar Sync & iCal Feeds</h2>
        <p className="ical-subtitle">
          Import availability from other platforms and export your StayHub calendar to avoid double-bookings.
        </p>
      </div>

      {/* Export Section */}
      <div className="ical-section-card">
        <h3>Export your StayHub Calendar</h3>
        <p className="ical-section-desc">
          Paste this link into other calendar apps (Google Calendar, Apple Calendar, Airbnb, VRBO) to sync your reservations.
        </p>

        <div className="ical-export-box">
          <input
            type="text"
            readOnly
            value={exportUrl}
            className="ical-export-input"
            aria-label="Export calendar URL"
          />
          <Button variant="secondary" onClick={handleCopyExportUrl}>
            {copied ? 'Copied!' : 'Copy Link'}
          </Button>
          <Button
            variant="ghost"
            onClick={handleRegenerate}
            disabled={regenerateMutation.isPending}
            title="Invalidate current link and generate a new token"
          >
            {regenerateMutation.isPending ? 'Regenerating…' : 'Regenerate'}
          </Button>
        </div>
      </div>

      {/* Import Feeds List */}
      <div className="ical-section-card" style={{ marginTop: 24 }}>
        <h3>Imported Calendars ({feeds?.length || 0})</h3>
        <p className="ical-section-desc">
          StayHub synchronizes external calendars periodically to block dates when bookings occur on other channels.
        </p>

        {error && <RequestError error={error} onRetry={() => void refetch()} />}

        {isLoading ? (
          <Skeleton label="Loading feeds" rows={3} />
        ) : !feeds || feeds.length === 0 ? (
          <p className="empty-inline-text">No external calendar feeds added yet.</p>
        ) : (
          <div className="ical-feeds-list">
            {feeds.map((feed) => (
              <div key={feed.id} className="ical-feed-item">
                <div className="ical-feed-info">
                  <strong>{feed.name}</strong>
                  <span className="ical-feed-url" title={feed.url}>
                    {feed.url}
                  </span>
                  <div className="ical-feed-meta">
                    {feed.last_synced_at ? (
                      <small>Last synced: {new Date(feed.last_synced_at).toLocaleString()}</small>
                    ) : (
                      <small>Pending initial sync</small>
                    )}
                    {feed.last_sync_error && (
                      <small className="field-error" style={{ marginLeft: 12 }}>
                        Sync error: {feed.last_sync_error}
                      </small>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  className="button--danger button--sm"
                  onClick={() => handleDeleteFeed(feed.id)}
                  disabled={deleteFeedMutation.isPending}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Add Feed Form */}
        <form onSubmit={handleAddFeed} className="ical-add-form" style={{ marginTop: 20 }}>
          <h4>Connect Another Calendar</h4>
          {validationError && <p className="field-error" role="alert">{validationError}</p>}
          {addFeedMutation.error && <RequestError error={addFeedMutation.error} />}

          <div className="ical-form-row">
            <div className="field" style={{ flex: 1 }}>
              <Field
                id="ical-feed-name"
                label="Calendar Name"
                placeholder="e.g. Airbnb Calendar"
                value={feedName}
                onChange={(e) => setFeedName(e.target.value)}
                required
              />
            </div>
            <div className="field" style={{ flex: 2 }}>
              <Field
                id="ical-feed-url"
                label="Calendar .ics Address (URL)"
                placeholder="https://www.airbnb.com/calendar/ical/..."
                value={feedUrl}
                onChange={(e) => setFeedUrl(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              disabled={addFeedMutation.isPending || !feedName || !feedUrl}
              style={{ alignSelf: 'flex-end', height: 40 }}
            >
              {addFeedMutation.isPending ? 'Connecting…' : 'Add Calendar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
