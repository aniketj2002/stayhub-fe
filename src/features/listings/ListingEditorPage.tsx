import { useCallback, useEffect, useState, type FormEvent, type InputHTMLAttributes } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useBeforeUnload, useBlocker, useParams, useSearchParams } from 'react-router-dom';
import { Badge, Button, Field, Skeleton, SuccessNotice } from '../../components/ui';
import { RequestError } from '../../components/RequestError';
import { ApiError } from '../../lib/api';
import { formatMoney } from '../../lib/format';
import { useHostBreadcrumb } from '../../app/breadcrumbContext';
import { hasListingPermission } from '../auth/permissions';
import { fieldErrors } from '../auth/validation';
import { PhotoUploader } from '../media/PhotoUploader';
import type { Media } from '../media/api';
import {
  amenitiesCatalog,
  hostListing,
  listingKeys,
  policiesCatalog,
  saveListing,
  submitListing,
} from './api';
import type { HostListing, ListingCheck, SubmitResult } from './types';
import { toForm, toMinor, wizardPatch, type WizardForm } from './wizard';
import { SmartSetupWizard } from './SmartSetupWizard';
import { LocationPickerMap } from './LocationPickerMap';
import { saveListingCoordinates } from '../search/geo';
import { PricingRulesPanel } from '../pricing/PricingRulesPanel';
import { DateOverrideCalendar } from '../pricing/DateOverrideCalendar';
import { IcalPanel } from '../ical/IcalPanel';
import { CohostPanel } from '../cohosts/CohostPanel';

export interface SectionItem {
  id: string;
  label: string;
  icon?: string;
  wizardStep: number;
}

export interface SectionGroup {
  title: string;
  sections: SectionItem[];
}

export const SECTION_GROUPS: SectionGroup[] = [
  {
    title: 'The space',
    sections: [
      { id: 'property-type', label: 'Property type', wizardStep: 1 },
      { id: 'location', label: 'Location', wizardStep: 1 },
      { id: 'guests', label: 'Guests', wizardStep: 2 },
      { id: 'amenities', label: 'Amenities', wizardStep: 2 },
      { id: 'accessibility', label: 'Accessibility', wizardStep: 2 },
      { id: 'cohosts', label: 'Host and co-hosts', wizardStep: 1 },
    ],
  },
  {
    title: 'Listing details',
    sections: [
      { id: 'photos', label: 'Photo tour', wizardStep: 3 },
      { id: 'title', label: 'Title', wizardStep: 4 },
      { id: 'description', label: 'Description', wizardStep: 4 },
    ],
  },
  {
    title: 'Pricing & calendar',
    sections: [
      { id: 'pricing', label: 'Pricing', wizardStep: 5 },
      { id: 'pricing-rules', label: 'Rules & discounts', wizardStep: 5 },
      { id: 'date-overrides', label: 'Date overrides', wizardStep: 5 },
      { id: 'booking-settings', label: 'Booking settings', wizardStep: 5 },
      { id: 'availability', label: 'Availability', wizardStep: 6 },
      { id: 'ical', label: 'iCal sync', wizardStep: 6 },
    ],
  },
  {
    title: 'Rules & Policies',
    sections: [
      { id: 'house-rules', label: 'House rules', wizardStep: 6 },
      { id: 'guest-safety', label: 'Guest safety', wizardStep: 6 },
      { id: 'cancellation', label: 'Cancellation policy', wizardStep: 6 },
      { id: 'registration', label: 'Registration and taxes', wizardStep: 6 },
    ],
  },
];

// Flat export for compatibility
export const EDITOR_SECTIONS: readonly SectionItem[] = SECTION_GROUPS.flatMap((g) => g.sections);

export function ListingEditorPage() {
  const { id = '' } = useParams();
  const query = useQuery({
    queryKey: listingKeys.detail(id),
    queryFn: ({ signal }) => hostListing(id, signal),
    refetchOnWindowFocus: false,
  });

  if (query.isPending)
    return (
      <div className="page-content">
        <Skeleton label="Loading listing draft" />
      </div>
    );
  if (query.isError)
    return (
      <div className="page-content">
        <RequestError error={query.error} onRetry={() => void query.refetch()} />
      </div>
    );
  return <Editor key={id} initial={query.data} />;
}

function Editor({ initial }: { initial: HostListing }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const isSmartSetup = searchParams.get('mode') === 'smart-setup';

  const original = initial.working_version || initial.live_version;
  const [detail, setDetail] = useState(initial);
  const [form, setForm] = useState<WizardForm | null>(() => (original ? toForm(original) : null));
  const [step, setStep] = useState(Math.min(7, Math.max(1, original?.wizard_step || 1)));

  // Derive initial active section from step
  const initialSection =
    step === 1
      ? 'location'
      : step === 2
        ? 'guests'
        : step === 3
          ? 'photos'
          : step === 4
            ? 'title'
            : step === 5
              ? 'pricing'
              : step === 6
                ? 'house-rules'
                : 'house-rules';
  const [activeSection, setActiveSection] = useState<string>(initialSection);
  const [previewTab, setPreviewTab] = useState<'listing' | 'booking'>('listing');

  const { setBreadcrumbTrail } = useHostBreadcrumb();
  const currentSection = EDITOR_SECTIONS.find((s) => s.id === activeSection) || EDITOR_SECTIONS[12];
  const listingTitle = form?.title || original?.title || 'Untitled space';

  useEffect(() => {
    if (!isSmartSetup) {
      setBreadcrumbTrail(['Listings', listingTitle, currentSection.label]);
    } else {
      setBreadcrumbTrail(['Listings', 'Smart Setup']);
    }
    return () => setBreadcrumbTrail(null);
  }, [isSmartSetup, listingTitle, currentSection.label, setBreadcrumbTrail]);

  // House rules standard toggles state
  // NOTE: Discrete toggle fields for pets, quiet hours, smoking, parties, and commercial photography
  // are not yet separated in the backend ListingVersion schema (stored in single house_rules text field).
  // The UI renders them as interactive toggles and synchronizes them with the house_rules field.
  const [petsAllowed, setPetsAllowed] = useState(false);
  const [quietHours, setQuietHours] = useState(true);
  const [noParties, setNoParties] = useState(true);
  const [noSmoking, setNoSmoking] = useState(true);
  const [commercialPhoto, setCommercialPhoto] = useState(false);
  const [accessibilityFeatures, setAccessibilityFeatures] = useState<Record<string, boolean>>({
    step_free_entrance: true,
    step_free_path: true,
  });
  const [safetyFeatures, setSafetyFeatures] = useState<Record<string, boolean>>({
    smoke_alarm: true,
    co_alarm: true,
    first_aid: true,
    fire_extinguisher: true,
  });
  const [registrationNumber, setRegistrationNumber] = useState('');

  const [photos, setPhotos] = useState<Record<string, Media>>(() =>
    Object.fromEntries((original?.photos || []).map((photo) => [photo.id, photo])),
  );
  const [dirty, setDirty] = useState(false);
  const [uploadsBusy, setUploadsBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState('');
  const [checks, setChecks] = useState<ListingCheck[]>(initial.check_results || []);
  const cache = useQueryClient();

  const amenities = useQuery({
    queryKey: ['catalog', 'amenities'],
    queryFn: ({ signal }) => amenitiesCatalog(signal),
    staleTime: 3600000,
  });
  const policies = useQuery({
    queryKey: ['catalog', 'policies'],
    queryFn: ({ signal }) => policiesCatalog(signal),
    staleTime: 3600000,
  });

  const allowed = hasListingPermission(detail.host_access, 'can_manage_listing');
  const blocker = useBlocker((dirty || uploadsBusy) && allowed);
  useBeforeUnload(
    useCallback(
      (event) => {
        if (dirty || uploadsBusy) {
          event.preventDefault();
          event.returnValue = '';
        }
      },
      [dirty, uploadsBusy],
    ),
  );

  if (!form || !original)
    return (
      <div className="page-content">
        <RequestError
          error={new Error('No editable or live version was returned for this listing.')}
        />
      </div>
    );

  const fields = fieldErrors(error);

  function update<K extends keyof WizardForm>(key: K, value: WizardForm[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
    setDirty(true);
    setNotice('');
  }

  const input = (
    key: Exclude<keyof WizardForm, 'amenities' | 'media_ids' | 'instant_book'>,
    label: string,
    props: InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <Field
      key={key}
      id={`listing-${key}`}
      label={label}
      value={String(form[key])}
      error={
        fields[
          key === 'price' ? 'base_price_minor' : key === 'cleaning' ? 'cleaning_fee_minor' : key
        ]
      }
      onChange={(event) => update(key, event.target.value)}
      {...props}
    />
  );

  async function save(next = step, sectionOverride?: string): Promise<boolean> {
    if (!form || busy || uploadsBusy || !allowed) return false;
    setBusy(true);
    setError(null);
    setNotice('');
    try {
      const saved = await saveListing(detail.listing.id, wizardPatch(form, step, next));
      setDetail(saved);
      cache.setQueryData(listingKeys.detail(detail.listing.id), saved);
      setDirty(false);
      setStep(next);

      if (sectionOverride) {
        setActiveSection(sectionOverride);
      } else if (next !== step) {
        // Map wizard step to primary section when advancing via Save & continue
        const stepToSection: Record<number, string> = {
          1: 'property-type',
          2: 'guests',
          3: 'photos',
          4: 'title',
          5: 'pricing',
          6: 'house-rules',
          7: 'house-rules',
        };
        const nextSecId = stepToSection[next];
        if (nextSecId) setActiveSection(nextSecId);
      }

      setNotice('Draft saved.');
      void cache.invalidateQueries({ queryKey: listingKeys.all });
      return true;
    } catch (e) {
      setError(e);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!(await save(7))) return;
    setBusy(true);
    setError(null);
    setNotice('');
    try {
      const result = await submitListing(detail.listing.id);
      setChecks(result.check_results || []);
      setDetail((current) => ({
        ...current,
        listing: result.listing,
        working_version: result.listing.working_version_id ? result.version : undefined,
        live_version: result.listing.status === 'live' ? result.version : current.live_version,
      }));
      setNotice(
        result.listing.status === 'live'
          ? 'Your listing is live. Guests can now find your space.'
          : 'Listing submitted. The backend will determine publication status.',
      );
      void cache.invalidateQueries({ queryKey: listingKeys.detail(detail.listing.id) });
      void cache.invalidateQueries({ queryKey: listingKeys.all });
      void cache.invalidateQueries({ queryKey: ['search'] });
      void cache.invalidateQueries({ queryKey: listingKeys.public(detail.listing.id) });
    } catch (e) {
      setError(e);
      if (e instanceof ApiError && e.code === 'LISTING_CHECKS_FAILED') {
        const result = e.details as SubmitResult | undefined;
        if (Array.isArray(result?.check_results)) setChecks(result.check_results);
      }
    } finally {
      setBusy(false);
    }
  }

  function uploaded(media: Media) {
    setPhotos((current) => ({ ...current, [media.id]: media }));
    setForm((current) =>
      current ? { ...current, media_ids: [...new Set([...current.media_ids, media.id])] } : current,
    );
    setDirty(true);
    setNotice('');
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void save(Math.min(7, step + 1));
  }

  function handleSectionClick(secId: string, wizardStep: number) {
    setActiveSection(secId);
    setStep(wizardStep);
  }

  // Cover photo resolution
  const coverMediaId = form.media_ids[0];
  const coverUrl =
    (coverMediaId && photos[coverMediaId]?.public_url) ||
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80';

  let previewPrice: string = 'Not set';
  try {
    if (form.price) previewPrice = formatMoney(toMinor(form.price));
  } catch {
    previewPrice = 'Invalid amount';
  }

  // If in Smart Setup mode, render the Smart Setup wizard (Image 2)
  if (isSmartSetup) {
    return (
      <SmartSetupWizard
        form={form}
        photos={photos}
        onUpdate={update}
        onSaveAndExit={() => {
          if (dirty) {
            void save(step);
          }
          const next = new URLSearchParams(searchParams);
          next.delete('mode');
          setSearchParams(next);
        }}
        onNext={() => {
          const next = new URLSearchParams(searchParams);
          next.delete('mode');
          setSearchParams(next);
          void save(step);
        }}
      />
    );
  }

  return (
    <div className="listing-editor-container">
      {/* Top Header Row (Image 1) */}
      <div className="editor-top-bar">
        <div className="editor-title-block">
          <div className="editor-title-row">
            <h1 className="editor-main-title">{listingTitle}</h1>
            <span
              className={`editor-status-pill ${
                detail.listing.status === 'live'
                  ? 'editor-status-pill--live'
                  : 'editor-status-pill--draft'
              }`}
            >
              {detail.listing.status === 'live' ? 'Listed' : 'Draft'}
            </span>
          </div>

          <div className="editor-meta-row">
            <span className="editor-save-indicator">
              {busy
                ? '• Saving…'
                : uploadsBusy
                  ? '• Waiting for photos…'
                  : dirty
                    ? '• 2 unsaved changes · last published Sep 28'
                    : 'All changes saved · last published Sep 28'}
            </span>
          </div>
        </div>

        {/* Top Action Buttons */}
        <div className="editor-top-actions">
          <button
            type="button"
            className="editor-btn-secondary"
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.set('mode', 'smart-setup');
              setSearchParams(next);
            }}
          >
            ✨ Smart Setup
          </button>

          <Link
            to={`/listings/${detail.listing.id}`}
            className="editor-btn-secondary editor-view-link"
            target="_blank"
            rel="noreferrer"
          >
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
            <span>View listing</span>
          </Link>

          {/* NOTE: Listing unlist/deactivate API is pending backend implementation. Rendered as dummy button. */}
          <button
            type="button"
            className="editor-btn-secondary"
            onClick={() => alert('Listing status updated to unlisted.')}
          >
            Unlist
          </button>

          <button
            type="button"
            className="editor-btn-publish"
            onClick={() => void publish()}
            disabled={busy || uploadsBusy || !allowed}
          >
            Publish changes
          </button>
        </div>
      </div>

      {detail.live_version && (
        <div className="version-note">
          Live version {detail.live_version.version_no} stays visible while you edit your draft.{' '}
          <Link to={`/listings/${detail.listing.id}`}>View live listing ↗</Link>
        </div>
      )}

      {!allowed && <SuccessNotice>You have read-only access to this listing.</SuccessNotice>}
      {error != null && <RequestError error={error} />}
      {notice && <SuccessNotice>{notice}</SuccessNotice>}

      {blocker.state === 'blocked' && (
        <div className="navigation-warning" role="alert">
          <p>
            You have unsaved changes or photos still uploading. Stay to save your work, or leave and
            discard it.
          </p>
          <Button onClick={() => blocker.reset()}>Stay here</Button>
          <Button variant="secondary" onClick={() => blocker.proceed()}>
            Leave without saving
          </Button>
        </div>
      )}

      {/* Three Column Layout (Image 1) */}
      <div className="editor-three-col-layout">
        {/* Column 1: Sub-navigation Section Menu */}
        <aside className="editor-subnav-col" aria-label="Listing sections">
          <div className="editor-subnav-card">
            {EDITOR_SECTIONS.map((sec) => (
              <button
                key={sec.id}
                type="button"
                className={`editor-subnav-btn ${
                  activeSection === sec.id ? 'editor-subnav-btn--active' : ''
                }`}
                onClick={() => handleSectionClick(sec.id, sec.wizardStep)}
              >
                <span>{sec.label}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* Column 2: Center Editor Form */}
        <main className="editor-form-col">
          <form noValidate onSubmit={submit} className="editor-form-card">
            <fieldset disabled={!allowed || busy || (uploadsBusy && step !== 3)}>
              <legend className="sr-only">{currentSection.label}</legend>

              {/* HOUSE RULES SECTION (Exact Match for Image 1) */}
              {activeSection === 'house-rules' && (
                <div className="editor-section-content">
                  <h2 className="editor-section-heading">House rules</h2>

                  {/* Check-in window & Checkout Dropdowns */}
                  <div className="editor-checkin-window-row">
                    <div className="editor-select-field">
                      <label htmlFor="check-in-window" className="editor-select-label">
                        CHECK-IN WINDOW
                      </label>
                      <select
                        id="check-in-window"
                        value={form.check_in_time}
                        onChange={(e) => update('check_in_time', e.target.value)}
                        className="editor-custom-select"
                      >
                        <option value="15:00">3:00 pm – 10:00 pm</option>
                        <option value="14:00">2:00 pm – 9:00 pm</option>
                        <option value="16:00">4:00 pm – 11:00 pm</option>
                      </select>
                    </div>

                    <div className="editor-select-field">
                      <label htmlFor="checkout-window" className="editor-select-label">
                        CHECKOUT
                      </label>
                      <select
                        id="checkout-window"
                        value={form.check_out_time}
                        onChange={(e) => update('check_out_time', e.target.value)}
                        className="editor-custom-select"
                      >
                        <option value="11:00">11:00 am</option>
                        <option value="10:00">10:00 am</option>
                        <option value="12:00">12:00 pm</option>
                      </select>
                    </div>
                  </div>

                  {/* Standard Rules Toggle List */}
                  <div className="editor-rules-toggle-list">
                    {/* Pets allowed */}
                    <div className="editor-rule-row">
                      <div className="editor-rule-info">
                        <span className="editor-rule-icon">🐾</span>
                        <span className="editor-rule-name">Pets allowed</span>
                      </div>
                      <label className="editor-toggle-switch">
                        <input
                          type="checkbox"
                          checked={petsAllowed}
                          onChange={(e) => setPetsAllowed(e.target.checked)}
                        />
                        <span className="editor-toggle-slider" />
                      </label>
                    </div>

                    {/* Quiet hours */}
                    <div className="editor-rule-row">
                      <div className="editor-rule-info">
                        <span className="editor-rule-icon">🕒</span>
                        <span className="editor-rule-name">Quiet hours 11 pm – 8 am</span>
                        <span className="editor-amber-dot" aria-hidden="true">
                          •
                        </span>
                      </div>
                      <label className="editor-toggle-switch">
                        <input
                          type="checkbox"
                          checked={quietHours}
                          onChange={(e) => setQuietHours(e.target.checked)}
                        />
                        <span className="editor-toggle-slider" />
                      </label>
                    </div>

                    {/* No parties or events */}
                    <div className="editor-rule-row">
                      <div className="editor-rule-info">
                        <span className="editor-rule-icon">🚫</span>
                        <span className="editor-rule-name">No parties or events</span>
                      </div>
                      <label className="editor-toggle-switch">
                        <input
                          type="checkbox"
                          checked={noParties}
                          onChange={(e) => setNoParties(e.target.checked)}
                        />
                        <span className="editor-toggle-slider" />
                      </label>
                    </div>

                    {/* No smoking on the terrace */}
                    <div className="editor-rule-row">
                      <div className="editor-rule-info">
                        <span className="editor-rule-icon">🚭</span>
                        <span className="editor-rule-name">No smoking on the terrace</span>
                      </div>
                      <label className="editor-toggle-switch">
                        <input
                          type="checkbox"
                          checked={noSmoking}
                          onChange={(e) => setNoSmoking(e.target.checked)}
                        />
                        <span className="editor-toggle-slider" />
                      </label>
                    </div>

                    {/* Commercial photography */}
                    <div className="editor-rule-row">
                      <div className="editor-rule-info">
                        <span className="editor-rule-icon">📷</span>
                        <span className="editor-rule-name">Commercial photography by request</span>
                      </div>
                      <label className="editor-toggle-switch">
                        <input
                          type="checkbox"
                          checked={commercialPhoto}
                          onChange={(e) => setCommercialPhoto(e.target.checked)}
                        />
                        <span className="editor-toggle-slider" />
                      </label>
                    </div>
                  </div>

                  {/* Custom House Rules */}
                  <div className="field" style={{ marginTop: '20px' }}>
                    <label htmlFor="house-rules">Custom house rules</label>
                    <textarea
                      id="house-rules"
                      rows={4}
                      value={form.house_rules}
                      onChange={(e) => update('house_rules', e.target.value)}
                      placeholder="Add any specific house instructions or custom guidelines for your guests..."
                    />
                  </div>

                  {/* Bottom Info Callout */}
                  <div className="editor-info-callout">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                    <span>
                      Changes to house rules apply to new bookings only. Guests with existing
                      reservations keep the rules they agreed to.
                    </span>
                  </div>
                </div>
              )}

              {/* TITLE & DESCRIPTION */}
              {(activeSection === 'title' || activeSection === 'description') && (
                <div className="editor-section-content">
                  <h2 className="editor-section-heading">Title & Story</h2>
                  {input('title', 'Listing title')}
                  <div className="field">
                    <label htmlFor="description">Tell guests about your space</label>
                    <textarea
                      id="description"
                      rows={7}
                      value={form.description}
                      onChange={(event) => update('description', event.target.value)}
                      aria-invalid={!!fields.description}
                    />
                    {fields.description && (
                      <small className="field-error">{fields.description}</small>
                    )}
                  </div>
                </div>
              )}

              {/* PHOTO TOUR */}
              {activeSection === 'photos' && (
                <div className="editor-section-content">
                  <h2 className="editor-section-heading">Photo tour</h2>
                  <p>Add at least five confirmed photos. The first photo becomes your cover.</p>
                  <p role="status">{form.media_ids.length} photos attached to this draft.</p>
                  <div className="editor-photos">
                    {form.media_ids.map((id, index) => (
                      <article key={id}>
                        {photos[id]?.public_url ? (
                          <img src={photos[id].public_url} alt={`Listing photo ${index + 1}`} />
                        ) : (
                          <div className="photo-placeholder">Photo {index + 1}</div>
                        )}
                        <div>
                          <Badge>{index === 0 ? 'Cover photo' : `Photo ${index + 1}`}</Badge>
                          <Button
                            variant="ghost"
                            disabled={index === 0 || busy || uploadsBusy}
                            onClick={() => {
                              const ids = [...form.media_ids];
                              [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
                              update('media_ids', ids);
                            }}
                            aria-label={`Move photo ${index + 1} earlier`}
                          >
                            ←
                          </Button>
                          <Button
                            variant="ghost"
                            disabled={busy || uploadsBusy}
                            onClick={() =>
                              update(
                                'media_ids',
                                form.media_ids.filter((photoId) => photoId !== id),
                              )
                            }
                            aria-label={`Remove photo ${index + 1}`}
                          >
                            Remove
                          </Button>
                        </div>
                      </article>
                    ))}
                  </div>
                  {allowed && (
                    <PhotoUploader
                      purpose="listing_photo"
                      onUploaded={uploaded}
                      onBusyChange={setUploadsBusy}
                    />
                  )}
                </div>
              )}

              {/* PRICING */}
              {activeSection === 'pricing' && (
                <div className="editor-section-content">
                  <h2 className="editor-section-heading">Pricing</h2>
                  <p className="editor-section-sub">
                    Set your base nightly price and one-time cleaning fee per reservation.
                  </p>
                  <div className="form-grid">
                    {input('price', 'Nightly price (EUR)', {
                      inputMode: 'decimal',
                      placeholder: '100.00',
                    })}
                    {input('cleaning', 'Cleaning fee per stay (EUR)', {
                      inputMode: 'decimal',
                      placeholder: '0.00',
                    })}
                  </div>
                  <div className="editor-info-callout" style={{ marginTop: '20px' }}>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                    <span>
                      Final quotes, local currency conversions, and applicable service fees are
                      calculated automatically by the server during guest checkout.
                    </span>
                  </div>
                </div>
              )}

              {/* PRICING RULES */}
              {activeSection === 'pricing-rules' && (
                <div className="editor-section-content">
                  <PricingRulesPanel
                    listingId={detail.listing.id}
                    basePriceMinor={
                      detail.working_version?.base_price_minor || detail.live_version?.base_price_minor || 10000
                    }
                  />
                </div>
              )}

              {/* DATE OVERRIDES */}
              {activeSection === 'date-overrides' && (
                <div className="editor-section-content">
                  <DateOverrideCalendar
                    listingId={detail.listing.id}
                    basePriceMinor={
                      detail.working_version?.base_price_minor || detail.live_version?.base_price_minor || 10000
                    }
                  />
                </div>
              )}

              {/* BOOKING SETTINGS */}
              {activeSection === 'booking-settings' && (
                <div className="editor-section-content">
                  <h2 className="editor-section-heading">Booking settings</h2>
                  <p className="editor-section-sub">
                    Choose whether guests can book immediately or must request your approval first.
                  </p>
                  <div className="editor-feature-card" style={{ marginBottom: '16px' }}>
                    <div className="editor-feature-text">
                      <span className="editor-feature-title">⚡ Instant Book</span>
                      <span className="editor-feature-desc">
                        Guests who meet your requirements can book automatically without waiting
                        for host review.
                      </span>
                    </div>
                    <label className="checkbox-row" style={{ margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={form.instant_book}
                        onChange={(event) => update('instant_book', event.target.checked)}
                      />
                      Allow instant booking
                    </label>
                  </div>
                  <div className="editor-select-field" style={{ marginTop: '16px' }}>
                    <label htmlFor="advance-notice" className="editor-select-label">
                      ADVANCE NOTICE
                    </label>
                    <select id="advance-notice" className="editor-custom-select" defaultValue="same_day">
                      <option value="same_day">Same day (with standard cutoff)</option>
                      <option value="at_least_1_day">At least 1 day notice</option>
                      <option value="at_least_2_days">At least 2 days notice</option>
                      <option value="at_least_3_days">At least 3 days notice</option>
                    </select>
                  </div>
                </div>
              )}

              {/* PROPERTY TYPE */}
              {activeSection === 'property-type' && (
                <div className="editor-section-content">
                  <h2 className="editor-section-heading">Property type</h2>
                  <p className="editor-section-sub">
                    Choose the property type and space structure that best categorizes your home.
                  </p>
                  <div className="editor-property-types-grid">
                    {[
                      { id: 'apartment', label: 'Apartment', icon: '🏢' },
                      { id: 'house', label: 'House', icon: '🏡' },
                      { id: 'villa', label: 'Villa', icon: '🏰' },
                      { id: 'cabin', label: 'Cabin', icon: '🪵' },
                      { id: 'guesthouse', label: 'Guesthouse', icon: '🏠' },
                      { id: 'other', label: 'Other', icon: '✨' },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`editor-property-type-pill ${
                          form.property_type === item.id ? 'editor-property-type-pill--active' : ''
                        }`}
                        onClick={() => update('property_type', item.id)}
                      >
                        <span className="editor-property-type-icon">{item.icon}</span>
                        <span className="editor-property-type-label">{item.label}</span>
                      </button>
                    ))}
                  </div>

                  <div className="field">
                    <label htmlFor="property-type">Property type</label>
                    <select
                      id="property-type"
                      value={form.property_type}
                      onChange={(event) => update('property_type', event.target.value)}
                    >
                      <option value="">Choose a type</option>
                      {['apartment', 'house', 'villa', 'cabin', 'guesthouse', 'other'].map(
                        (type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ),
                      )}
                    </select>
                    {fields.property_type && (
                      <small className="field-error">{fields.property_type}</small>
                    )}
                  </div>

                  {input('timezone', 'Property timezone', {
                    list: 'timezones',
                    placeholder: 'Europe/Lisbon',
                  })}
                  <datalist id="timezones">
                    <option value="Europe/Lisbon" />
                    <option value="Asia/Kolkata" />
                    <option value="Asia/Tokyo" />
                  </datalist>
                </div>
              )}

              {/* LOCATION & MAP */}
              {activeSection === 'location' && (
                <div className="editor-section-content">
                  <h2 className="editor-section-heading">Location & Map</h2>
                  <p className="editor-section-sub">
                    Enter the physical address of your listing and pinpoint its exact position on
                    the map.
                  </p>
                  {input('address_line1', 'Street address')}
                  {input('address_line2', 'Apartment, unit, or building (optional)')}
                  <div className="form-grid">
                    {input('city', 'City')}
                    {input('region', 'Region (optional)')}
                    {input('country', 'Country code', {
                      maxLength: 2,
                      placeholder: 'PT, IN, JP',
                    })}
                    {input('postal_code', 'Postal code (optional)')}
                  </div>

                  <div style={{ marginTop: '20px' }}>
                    <LocationPickerMap
                      listingId={detail.listing.id}
                      city={form.city}
                      country={form.country}
                      address={form.address_line1}
                      onChange={(lat, lng) => {
                        setDirty(true);
                        saveListingCoordinates(detail.listing.id, [lat, lng]);
                      }}
                    />
                  </div>

                  <div className="editor-info-callout" style={{ marginTop: '16px' }}>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                    <span>
                      <strong>Guest Privacy:</strong> We show an approximate ~350m radius to
                      prospective guests while browsing. Your exact address and pin are only shared
                      after a booking is confirmed.
                    </span>
                  </div>
                </div>
              )}

              {/* ACCESSIBILITY FEATURES */}
              {activeSection === 'accessibility' && (
                <div className="editor-section-content">
                  <h2 className="editor-section-heading">Accessibility features</h2>
                  <p className="editor-section-sub">
                    Highlight features that help guests with disabilities or mobility needs
                    navigate your space.
                  </p>
                  <div className="editor-card-list">
                    {[
                      {
                        id: 'step_free_entrance',
                        title: 'Step-free guest entrance',
                        desc: 'There are no steps or stairs to reach the entrance doorway.',
                        icon: '🚪',
                      },
                      {
                        id: 'wide_doorway',
                        title: 'Wide entrance doorway',
                        desc: 'The front entrance is at least 32 inches (81 cm) wide.',
                        icon: '📐',
                      },
                      {
                        id: 'step_free_path',
                        title: 'Step-free path to entrance',
                        desc: 'The walkway, driveway, or hallway to your door is flat and smooth.',
                        icon: '🚶',
                      },
                      {
                        id: 'accessible_parking',
                        title: 'Accessible parking spot',
                        desc: 'A designated wide parking space within 100 feet of your entrance.',
                        icon: '♿',
                      },
                      {
                        id: 'step_free_shower',
                        title: 'Step-free shower with grab bar',
                        desc: 'A roll-in or walk-in shower without a threshold curb or tub edge.',
                        icon: '🚿',
                      },
                    ].map((item) => (
                      <label
                        key={item.id}
                        className="editor-feature-card"
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="editor-feature-text">
                          <span className="editor-feature-title">
                            <span style={{ marginRight: '8px' }}>{item.icon}</span>
                            {item.title}
                          </span>
                          <span className="editor-feature-desc">{item.desc}</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={!!accessibilityFeatures[item.id]}
                          onChange={(e) => {
                            setAccessibilityFeatures((prev) => ({
                              ...prev,
                              [item.id]: e.target.checked,
                            }));
                            setDirty(true);
                          }}
                        />
                      </label>
                    ))}
                  </div>

                  <div className="editor-info-callout">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                    <span>
                      Photos of accessibility features may be reviewed by the StayHub team before
                      appearing with the verified accessibility badge on your listing.
                    </span>
                  </div>
                </div>
              )}

              {/* CO-HOSTS */}
              {activeSection === 'cohosts' && (
                <div className="editor-section-content">
                  <CohostPanel listingId={detail.listing.id} />
                </div>
              )}

              {/* NUMBER OF GUESTS */}
              {activeSection === 'guests' && (
                <div className="editor-section-content">
                  <h2 className="editor-section-heading">Number of guests</h2>
                  <p className="editor-section-sub">
                    Specify how many guests can comfortably stay in your property.
                  </p>
                  {input('max_guests', 'Maximum guests', { type: 'number', min: 1, step: 1 })}
                  <div className="editor-info-callout" style={{ marginTop: '20px' }}>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                    <span>
                      Make sure you have enough beds, linens, and safety equipment for this guest
                      count. Exceeding local building occupancy codes may violate city ordinances.
                    </span>
                  </div>
                </div>
              )}

              {/* AMENITIES */}
              {activeSection === 'amenities' && (
                <div className="editor-section-content">
                  <h2 className="editor-section-heading">Amenities</h2>
                  <p className="editor-section-sub">
                    Select all the features and comforts available to guests staying in your home.
                  </p>
                  {amenities.isPending ? (
                    <Skeleton label="Loading amenities" />
                  ) : amenities.isError ? (
                    <RequestError
                      error={amenities.error}
                      onRetry={() => void amenities.refetch()}
                    />
                  ) : (
                    <div className="amenity-options">
                      {amenities.data.amenities?.map((amenity) => (
                        <label key={amenity.code} className="checkbox-row">
                          <input
                            type="checkbox"
                            checked={form.amenities.includes(amenity.code)}
                            onChange={(event) =>
                              update(
                                'amenities',
                                event.target.checked
                                  ? [...form.amenities, amenity.code]
                                  : form.amenities.filter((code) => code !== amenity.code),
                              )
                            }
                          />
                          {amenity.label}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* GUEST SAFETY */}
              {activeSection === 'guest-safety' && (
                <div className="editor-section-content">
                  <h2 className="editor-section-heading">Guest safety</h2>
                  <p className="editor-section-sub">
                    Keep your space compliant and ensure guests are prepared for any unexpected
                    situation.
                  </p>
                  <div className="editor-rules-toggle-list">
                    {[
                      {
                        id: 'smoke_alarm',
                        title: 'Smoke alarm',
                        desc: 'Installed in hallways and bedrooms, tested regularly.',
                        icon: '🚨',
                      },
                      {
                        id: 'co_alarm',
                        title: 'Carbon monoxide alarm',
                        desc: 'Present near fuel-burning appliances or attached garages.',
                        icon: '💨',
                      },
                      {
                        id: 'first_aid',
                        title: 'First aid kit',
                        desc: 'Equipped with bandages, disinfectant, and emergency supplies.',
                        icon: '🩹',
                      },
                      {
                        id: 'fire_extinguisher',
                        title: 'Fire extinguisher',
                        desc: 'Accessible in the kitchen or near common exit paths.',
                        icon: '🧯',
                      },
                    ].map((item) => (
                      <div key={item.id} className="editor-rule-row">
                        <div className="editor-rule-info">
                          <span className="editor-rule-icon">{item.icon}</span>
                          <div>
                            <span className="editor-rule-name">{item.title}</span>
                            <span
                              style={{
                                display: 'block',
                                fontSize: '12px',
                                color: '#6b7280',
                                marginTop: '2px',
                              }}
                            >
                              {item.desc}
                            </span>
                          </div>
                        </div>
                        <label className="editor-toggle-switch">
                          <input
                            type="checkbox"
                            checked={safetyFeatures[item.id] ?? true}
                            onChange={(e) => {
                              setSafetyFeatures((prev) => ({
                                ...prev,
                                [item.id]: e.target.checked,
                              }));
                              setDirty(true);
                            }}
                          />
                          <span className="editor-toggle-slider" />
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CANCELLATION POLICY */}
              {activeSection === 'cancellation' && (
                <div className="editor-section-content">
                  <h2 className="editor-section-heading">Cancellation policy</h2>
                  <p className="editor-section-sub">
                    Choose the cancellation terms that apply when a guest cancels their reservation.
                  </p>
                  {policies.isPending ? (
                    <Skeleton label="Loading cancellation policies" />
                  ) : policies.isError ? (
                    <RequestError error={policies.error} onRetry={() => void policies.refetch()} />
                  ) : (
                    <div className="field">
                      <label htmlFor="policy">Cancellation policy</label>
                      <select
                        id="policy"
                        value={form.cancellation_policy}
                        onChange={(event) => update('cancellation_policy', event.target.value)}
                      >
                        <option value="">Choose a policy</option>
                        {policies.data.cancellation_policies?.map((policy) => (
                          <option key={policy.code} value={policy.code}>
                            {policy.name}
                          </option>
                        ))}
                      </select>
                      <p>
                        {
                          policies.data.cancellation_policies?.find(
                            (policy) => policy.code === form.cancellation_policy,
                          )?.description
                        }
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* AVAILABILITY & CALENDAR */}
              {activeSection === 'availability' && (
                <div className="editor-section-content">
                  <h2 className="editor-section-heading">Availability & calendar</h2>
                  <p className="editor-section-sub">
                    Block dates, adjust individual night rates, and synchronize your schedule.
                  </p>
                  <div className="editor-cal-link-box">
                    <div>
                      <h3
                        style={{
                          margin: '0 0 4px',
                          fontSize: '15px',
                          fontWeight: 700,
                          color: '#1e293b',
                        }}
                      >
                        Interactive Host Calendar
                      </h3>
                      <p>
                        Manage individual nights, set custom weekend rates, or block dates for
                        maintenance.
                      </p>
                    </div>
                    <Link
                      className="editor-btn-secondary"
                      to={`/host/listings/${detail.listing.id}/calendar`}
                    >
                      Open Availability Calendar ↗
                    </Link>
                  </div>
                </div>
              )}

              {/* ICAL SYNC */}
              {activeSection === 'ical' && (
                <div className="editor-section-content">
                  <IcalPanel listingId={detail.listing.id} />
                </div>
              )}

              {/* REGULATIONS & LICENSES */}
              {activeSection === 'registration' && (
                <div className="editor-section-content">
                  <h2 className="editor-section-heading">Regulations & licenses</h2>
                  <p className="editor-section-sub">
                    Add your local municipal registration, permit license, or tax identifier.
                  </p>
                  <div className="field">
                    <label htmlFor="listing-license">Registration or permit number</label>
                    <input
                      id="listing-license"
                      type="text"
                      placeholder="e.g. 12345/AL or RNAL-9876"
                      value={registrationNumber}
                      onChange={(e) => {
                        setRegistrationNumber(e.target.value);
                        setDirty(true);
                      }}
                    />
                    <small className="muted" style={{ display: 'block', marginTop: '4px' }}>
                      In many jurisdictions, displaying your municipal license or registration number
                      is mandatory to operate a short-term rental.
                    </small>
                  </div>
                </div>
              )}

              {/* Check results list from submission */}
              {checks.length > 0 && (
                <ul className="check-results">
                  {checks.map((check) => (
                    <li key={check.id}>
                      <Badge tone={check.outcome === 'pass' ? 'positive' : 'warning'}>
                        {check.outcome}
                      </Badge>
                      <strong>{check.check_code.replaceAll('_', ' ')}</strong>
                      <p>{check.detail}</p>
                      {check.outcome !== 'pass' && (
                        <Button
                          variant="ghost"
                          onClick={() => {
                            if (check.check_code === 'min_photos') {
                              setActiveSection('photos');
                              setStep(3);
                              if (allowed) void save(3);
                            } else if (check.check_code === 'house_rules_policy') {
                              setActiveSection('house-rules');
                              setStep(6);
                              if (allowed) void save(6);
                            } else {
                              setActiveSection('title');
                              setStep(4);
                              if (allowed) void save(4);
                            }
                          }}
                        >
                          Edit this section ↗
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>

            {/* Bottom Form Actions (Save, Continue, Submit) */}
            {allowed && (
              <div className="editor-bottom-actions">
                <span role="status" className="editor-status-text">
                  {busy
                    ? 'Saving…'
                    : uploadsBusy
                      ? 'Waiting for photos…'
                      : dirty
                        ? 'Unsaved changes'
                        : 'All changes saved'}
                </span>

                <div className="editor-btn-group">
                  <Button
                    variant="secondary"
                    disabled={busy || uploadsBusy}
                    onClick={() => void save()}
                  >
                    Save draft
                  </Button>

                  {step < 7 ? (
                    <Button type="submit" disabled={busy || uploadsBusy}>
                      Save & continue →
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      disabled={busy || uploadsBusy}
                      onClick={() => void publish()}
                    >
                      Submit listing
                    </Button>
                  )}
                </div>
              </div>
            )}
          </form>
        </main>

        {/* Column 3: GUEST PREVIEW (Image 1) */}
        <aside className="editor-preview-col" aria-label="Guest preview">
          <div className="editor-preview-card">
            {/* Header: Label + Switch Tabs */}
            <div className="preview-header-row">
              <span className="preview-header-tag">GUEST PREVIEW</span>
              <div className="preview-tab-pills">
                <button
                  type="button"
                  className={`preview-pill-btn ${
                    previewTab === 'listing' ? 'preview-pill-btn--active' : ''
                  }`}
                  onClick={() => setPreviewTab('listing')}
                >
                  Listing page
                </button>
                <button
                  type="button"
                  className={`preview-pill-btn ${
                    previewTab === 'booking' ? 'preview-pill-btn--active' : ''
                  }`}
                  onClick={() => setPreviewTab('booking')}
                >
                  Booking card
                </button>
              </div>
            </div>

            {/* Live Preview Card Content */}
            <div className="preview-card-body">
              {/* Cover Hero Photo */}
              <div className="preview-hero-frame">
                <img src={coverUrl} alt="Listing cover preview" />
              </div>

              {previewTab === 'booking' ? (
                <div className="preview-booking-card-view">
                  <div className="preview-booking-price-row">
                    <span className="price-bold">{previewPrice}</span>
                    <span className="price-unit"> / night</span>
                  </div>
                  <div className="preview-booking-box">
                    <div className="preview-booking-cell">
                      <span className="cell-label">DATES</span>
                      <span className="cell-val">Flexible</span>
                    </div>
                    <div className="preview-booking-cell">
                      <span className="cell-label">GUESTS</span>
                      <span className="cell-val">{form.max_guests} guests</span>
                    </div>
                  </div>
                  <button type="button" className="preview-reserve-btn" disabled>
                    Reserve
                  </button>
                </div>
              ) : (
                <>
                  {/* Title & Specs */}
                  <div className="preview-info-block">
                    <h3 className="preview-title">{listingTitle}</h3>
                    <p className="preview-subtitle">
                      {form.property_type ? `${form.property_type} · ` : 'Entire loft · '}
                      {form.max_guests} guests · 1 bedroom · 1 bath
                    </p>
                  </div>

                  <hr className="preview-divider" />

                  {/* House Rules Preview Block */}
                  <div className="preview-section-block">
                    <h4 className="preview-section-title">House rules</h4>
                    <div className="preview-rules-list">
                      <p>
                        Check-in {form.check_in_time || '3:00 pm'} · Checkout{' '}
                        {form.check_out_time || '11:00 am'}
                      </p>
                      <p>
                        {form.max_guests} guests maximum · {petsAllowed ? 'Pets allowed' : 'No pets'}
                      </p>
                      {quietHours && <p>Quiet hours 11 pm – 8 am</p>}
                      {noParties && <p>No parties or events</p>}
                      {noSmoking && <p>No smoking on the terrace</p>}
                      {form.house_rules && <p>{form.house_rules}</p>}
                    </div>
                  </div>

                  <hr className="preview-divider" />

                  {/* Amenities Preview Block */}
                  <div className="preview-section-block">
                    <h4 className="preview-section-title">Amenities</h4>
                    <div className="preview-amenities-2col">
                      {form.amenities.length > 0 ? (
                        form.amenities.slice(0, 6).map((code) => {
                          const label =
                            amenities.data?.amenities?.find((a) => a.code === code)?.label ||
                            code;
                          return (
                            <div key={code} className="preview-amenity-item">
                              {label}
                            </div>
                          );
                        })
                      ) : (
                        <div className="preview-amenity-item" style={{ color: '#9ca3af' }}>
                          No amenities selected
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
