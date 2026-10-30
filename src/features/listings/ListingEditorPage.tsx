import { useCallback, useState, type FormEvent, type InputHTMLAttributes } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useBeforeUnload, useBlocker, useParams } from 'react-router-dom';
import { Badge, Button, Field, Skeleton, SuccessNotice } from '../../components/ui';
import { RequestError } from '../../components/RequestError';
import { ApiError } from '../../lib/api';
import { formatMoney } from '../../lib/format';
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
import { toForm, toMinor, wizardPatch, wizardSteps, type WizardForm } from './wizard';

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
  const original = initial.working_version || initial.live_version;
  const [detail, setDetail] = useState(initial);
  const [form, setForm] = useState<WizardForm | null>(() => (original ? toForm(original) : null));
  const [step, setStep] = useState(Math.min(7, Math.max(1, original?.wizard_step || 1)));
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
  async function save(next = step): Promise<boolean> {
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
  let previewPrice: string = 'Not set';
  try {
    if (form.price) previewPrice = formatMoney(toMinor(form.price));
  } catch {
    previewPrice = 'Invalid amount';
  }
  return (
    <section className="page-content listing-editor">
      <Link className="text-link" to="/host/listings">
        ← Your listings
      </Link>
      <div className="heading-row editor-heading">
        <div>
          <p className="eyebrow">MAKE YOUR SPACE SHINE</p>
          <h1>{form.title || 'A place to call home'}</h1>
        </div>
        <Badge tone={detail.listing.status === 'live' ? 'positive' : 'neutral'}>
          {detail.listing.status.replaceAll('_', ' ')}
        </Badge>
      </div>
      {detail.live_version && (
        <div className="version-note">
          Live version {detail.live_version.version_no} stays visible while you edit your draft.{' '}
          <Link to={`/listings/${detail.listing.id}`}>View live listing ↗</Link>
        </div>
      )}
      {!allowed && <SuccessNotice>You have read-only access to this listing.</SuccessNotice>}
      <nav className="wizard-steps" aria-label="Listing setup steps">
        {wizardSteps.map((label, index) => (
          <button
            key={label}
            type="button"
            aria-current={step === index + 1 ? 'step' : undefined}
            disabled={busy || uploadsBusy}
            onClick={() => {
              if (allowed) void save(index + 1);
              else setStep(index + 1);
            }}
          >
            <span>{index + 1}</span>
            {label}
          </button>
        ))}
      </nav>
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
      <form noValidate onSubmit={submit}>
        <fieldset disabled={!allowed || busy || (uploadsBusy && step !== 3)}>
          <legend className="sr-only">{wizardSteps[step - 1]}</legend>
          <div className="wizard-panel">
            <p className="eyebrow">STEP {step} OF 7</p>
            <h2>{wizardSteps[step - 1]}</h2>
            {step === 1 && (
              <>
                <div className="field">
                  <label htmlFor="property-type">Property type</label>
                  <select
                    id="property-type"
                    value={form.property_type}
                    onChange={(event) => update('property_type', event.target.value)}
                  >
                    <option value="">Choose a type</option>
                    {['apartment', 'house', 'villa', 'cabin', 'guesthouse', 'other'].map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  {fields.property_type && (
                    <small className="field-error">{fields.property_type}</small>
                  )}
                </div>
                {input('address_line1', 'Street address')}
                {input('address_line2', 'Apartment, unit, or building (optional)')}
                <div className="form-grid">
                  {input('city', 'City')}
                  {input('region', 'Region (optional)')}
                  {input('country', 'Country code', { maxLength: 2, placeholder: 'PT, IN, JP' })}
                  {input('postal_code', 'Postal code (optional)')}
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
                <p className="muted">
                  Use the property’s IANA timezone. Booking and cancellation times follow this
                  timezone.
                </p>
              </>
            )}
            {step === 2 && (
              <>
                {input('max_guests', 'Maximum guests', { type: 'number', min: 1, step: 1 })}
                <h3>What does your space offer?</h3>
                {amenities.isPending ? (
                  <Skeleton label="Loading amenities" />
                ) : amenities.isError ? (
                  <RequestError error={amenities.error} onRetry={() => void amenities.refetch()} />
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
              </>
            )}
            {step === 3 && (
              <>
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
              </>
            )}
            {step === 4 && (
              <>
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
              </>
            )}
            {step === 5 && (
              <>
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
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={form.instant_book}
                    onChange={(event) => update('instant_book', event.target.checked)}
                  />
                  Allow instant booking
                </label>
                <p className="muted">
                  Otherwise guests request a booking for host approval. Final quotes and fees are
                  calculated by the server.
                </p>
              </>
            )}
            {step === 6 && (
              <>
                <div className="form-grid">
                  {input('check_in_time', 'Check-in time', { type: 'time' })}
                  {input('check_out_time', 'Checkout time', { type: 'time' })}
                </div>
                <div className="field">
                  <label htmlFor="house-rules">House rules</label>
                  <textarea
                    id="house-rules"
                    rows={5}
                    value={form.house_rules}
                    onChange={(event) => update('house_rules', event.target.value)}
                  />
                  <small>
                    Rules must follow the nondiscrimination policy and will be checked on
                    submission.
                  </small>
                </div>
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
              </>
            )}
            {step === 7 && (
              <>
                <div className="review-summary">
                  {form.media_ids.length > 0 && (
                    <div className="review-photos">
                      {form.media_ids
                        .slice(0, 5)
                        .map((id, index) =>
                          photos[id]?.public_url ? (
                            <img
                              key={id}
                              src={photos[id].public_url}
                              alt={`Preview photo ${index + 1}`}
                            />
                          ) : null,
                        )}
                    </div>
                  )}
                  <h3>{form.title || 'Title not set'}</h3>
                  <p>
                    {form.property_type || 'Property type not set'} ·{' '}
                    {[form.city, form.country].filter(Boolean).join(', ') || 'Location not set'}
                  </p>
                  <p>
                    {form.max_guests} guests · {previewPrice} / night · {form.media_ids.length}{' '}
                    photos
                  </p>
                  <p>{form.instant_book ? 'Instant booking' : 'Request to book'}</p>
                  <p className="preserve-lines">{form.description || 'Description not added'}</p>
                  <p className="preserve-lines">{form.house_rules || 'House rules not added'}</p>
                  <p>Cancellation: {form.cancellation_policy || 'Not selected'}</p>
                </div>
                <p>
                  Submission runs required-field, photo, and house-rule checks. Publication follows
                  the backend’s configured review mode.
                </p>
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
                            onClick={() =>
                              void save(
                                check.check_code === 'min_photos'
                                  ? 3
                                  : check.check_code === 'house_rules_policy'
                                    ? 6
                                    : 1,
                              )
                            }
                          >
                            Edit this section ↗
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </fieldset>
        {allowed && (
          <div className="wizard-actions">
            <span role="status">
              {busy
                ? 'Saving…'
                : uploadsBusy
                  ? 'Waiting for photos…'
                  : dirty
                    ? 'Unsaved changes'
                    : 'All changes saved'}
            </span>
            <div>
              {step > 1 && (
                <Button
                  variant="ghost"
                  disabled={busy || uploadsBusy}
                  onClick={() => void save(step - 1)}
                >
                  Back
                </Button>
              )}
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
                <Button disabled={busy || uploadsBusy} onClick={() => void publish()}>
                  Submit listing
                </Button>
              )}
            </div>
          </div>
        )}
      </form>
      <Link className="text-link" to={`/host/listings/${detail.listing.id}/calendar`}>
        Manage availability ↗
      </Link>
    </section>
  );
}
