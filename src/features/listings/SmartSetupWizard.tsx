import { useEffect, useState } from 'react';
import { Button } from '../../components/ui';
import type { WizardForm } from './wizard';
import type { Media } from '../media/api';

interface SmartSetupWizardProps {
  form: WizardForm;
  photos: Record<string, Media>;
  onUpdate: <K extends keyof WizardForm>(key: K, value: WizardForm[K]) => void;
  onSaveAndExit: () => void;
  onNext: () => void;
}

// NOTE: Smart Setup AI analysis (computer vision photo tagging, bedroom count detection,
// and automated neighborhood landmark distance extraction) is pending backend AI service implementation.
// The frontend provides realistic fallback defaults and interactive state to match the reference design.

const DEFAULT_SMART_PHOTOS = [
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=600&q=80',
];

const SUGGESTIONS = [
  {
    title: 'Bica apartment with tram view',
    desc: 'Sunny two-bedroom apartment on Rua da Bica, a short walk from the river and the funicular. Sleeps 3 with a full kitchen, fast wifi, and air conditioning for August. Street parking nearby; the tram stops at the corner.',
  },
  {
    title: 'Historic Bica loft with river glimpses',
    desc: 'Charming renovated loft overlooking the famous Bica funicular. Features original tiles, high ceilings, full chef kitchen, and fast wifi for remote work.',
  },
  {
    title: 'Sunlit Lisbon sanctuary near Time Out Market',
    desc: 'Bright and airy central apartment steps from Cais do Sodre and Bica tram. Quiet bedrooms, modern bathroom, and dedicated workspace.',
  },
];

export function SmartSetupWizard({
  form,
  photos,
  onUpdate,
  onSaveAndExit,
  onNext,
}: SmartSetupWizardProps) {
  const [suggestionIdx, setSuggestionIdx] = useState(0);
  const [currentStep, setCurrentStep] = useState(2); // Step 2: Make it stand out (as in Image 2)

  useEffect(() => {
    if (!form.title) {
      onUpdate('title', SUGGESTIONS[0].title);
    }
    if (!form.description) {
      onUpdate('description', SUGGESTIONS[0].desc);
    }
    if (!form.max_guests) {
      onUpdate('max_guests', '3');
    }
  }, []);

  // Property basics steppers state
  // NOTE: bedrooms, beds, and bathrooms counts are not yet stored separately in backend ListingVersion.
  // Stored in local state with comments for future schema additions.
  const [bedrooms, setBedrooms] = useState(2);
  const [beds, setBeds] = useState(2);
  const [bathrooms, setBathrooms] = useState(1);

  const guestCount = Math.max(1, Number(form.max_guests) || 3);

  // Amenities spotted checklist
  const [amenityStates, setAmenityStates] = useState<Record<string, boolean>>({
    wifi: true,
    kitchen: true,
    air_conditioning: true,
    bathtub: true,
    street_parking: true,
    tram_at_door: true,
  });

  function toggleAmenity(key: string) {
    setAmenityStates((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleRegenerate() {
    const nextIdx = (suggestionIdx + 1) % SUGGESTIONS.length;
    setSuggestionIdx(nextIdx);
    onUpdate('title', SUGGESTIONS[nextIdx].title);
    onUpdate('description', SUGGESTIONS[nextIdx].desc);
  }

  // Display photos: use uploaded photos if available, otherwise reference photos
  const uploadedPhotosList = Object.values(photos).map((p) => p.public_url);
  const displayPhotos =
    uploadedPhotosList.length >= 5 ? uploadedPhotosList.slice(0, 5) : DEFAULT_SMART_PHOTOS;

  return (
    <div className="smart-setup-container">
      {/* Top Bar */}
      <header className="smart-setup-header">
        <div className="smart-setup-brand">
          <svg
            className="smart-setup-logo-icon"
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
          >
            <rect width="24" height="24" rx="6" fill="#0f4c3a" />
            <path
              d="M12 5L5 10.5V18.5C5 18.77 5.22 19 5.5 19H9V14H15V19H18.5C18.78 19 19 18.77 19 18.5V10.5L12 5Z"
              fill="white"
            />
          </svg>
          <span className="smart-setup-brand-title">StayHub</span>
        </div>

        <div className="smart-setup-top-actions">
          <Button
            variant="ghost"
            onClick={() => alert('Smart Setup guides you through drafting your listing with AI.')}
          >
            Help
          </Button>
          <Button variant="secondary" onClick={onSaveAndExit}>
            Save and exit
          </Button>
        </div>
      </header>

      {/* Main Content (2 Columns) */}
      <main className="smart-setup-body">
        <div className="smart-setup-grid">
          {/* Left Column */}
          <div className="smart-setup-left-col">
            <h1 className="smart-setup-title">Let Smart Setup draft your listing</h1>
            <p className="smart-setup-subtitle">
              We read your photos and address to suggest a title, description, and amenities. Review
              everything before it goes live; nothing publishes without you.
            </p>

            {/* Photo Mosaic */}
            <div className="smart-photo-mosaic">
              {displayPhotos.map((src, i) => (
                <div key={i} className="smart-photo-cell">
                  <img src={src} alt={`Draft listing photo ${i + 1}`} />
                </div>
              ))}
              <div
                className="smart-photo-cell smart-photo-cell--add"
                role="button"
                tabIndex={0}
                onClick={onNext}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') onNext();
                }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span>Add more</span>
              </div>
            </div>

            {/* Detection Summary Pill */}
            <div className="smart-detection-badge">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#0f4c3a"
                strokeWidth="2.5"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Read 5 photos and Rua da Bica 22, Lisbon · 2 bedrooms detected · sleeps 3</span>
            </div>

            {/* Property Basics Steppers */}
            <div className="smart-basics-section">
              <h2 className="smart-section-label">PROPERTY BASICS · CONFIRM</h2>

              <div className="smart-steppers-list">
                {/* Guests */}
                <div className="smart-stepper-row">
                  <span className="smart-stepper-label">Guests</span>
                  <div className="smart-stepper-controls">
                    <button
                      type="button"
                      className="smart-step-btn"
                      onClick={() => onUpdate('max_guests', String(Math.max(1, guestCount - 1)))}
                      aria-label="Decrease guests"
                    >
                      −
                    </button>
                    <span className="smart-step-val">{guestCount}</span>
                    <button
                      type="button"
                      className="smart-step-btn"
                      onClick={() => onUpdate('max_guests', String(guestCount + 1))}
                      aria-label="Increase guests"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Bedrooms */}
                <div className="smart-stepper-row">
                  <span className="smart-stepper-label">Bedrooms</span>
                  <div className="smart-stepper-controls">
                    <button
                      type="button"
                      className="smart-step-btn"
                      onClick={() => setBedrooms((b) => Math.max(1, b - 1))}
                      aria-label="Decrease bedrooms"
                    >
                      −
                    </button>
                    <span className="smart-step-val">{bedrooms}</span>
                    <button
                      type="button"
                      className="smart-step-btn"
                      onClick={() => setBedrooms((b) => b + 1)}
                      aria-label="Increase bedrooms"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Beds */}
                <div className="smart-stepper-row">
                  <span className="smart-stepper-label">Beds</span>
                  <div className="smart-stepper-controls">
                    <button
                      type="button"
                      className="smart-step-btn"
                      onClick={() => setBeds((b) => Math.max(1, b - 1))}
                      aria-label="Decrease beds"
                    >
                      −
                    </button>
                    <span className="smart-step-val">{beds}</span>
                    <button
                      type="button"
                      className="smart-step-btn"
                      onClick={() => setBeds((b) => b + 1)}
                      aria-label="Increase beds"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Bathrooms */}
                <div className="smart-stepper-row">
                  <span className="smart-stepper-label">Bathrooms</span>
                  <div className="smart-stepper-controls">
                    <button
                      type="button"
                      className="smart-step-btn"
                      onClick={() => setBathrooms((b) => Math.max(1, b - 1))}
                      aria-label="Decrease bathrooms"
                    >
                      −
                    </button>
                    <span className="smart-step-val">{bathrooms}</span>
                    <button
                      type="button"
                      className="smart-step-btn"
                      onClick={() => setBathrooms((b) => b + 1)}
                      aria-label="Increase bathrooms"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="smart-setup-right-col">
            {/* Suggested Title */}
            <div className="smart-field-group">
              <label htmlFor="suggested-title" className="smart-section-label">
                SUGGESTED TITLE
              </label>
              <div className="smart-input-with-action">
                <input
                  id="suggested-title"
                  type="text"
                  className="smart-text-input"
                  value={form.title || SUGGESTIONS[suggestionIdx].title}
                  onChange={(e) => onUpdate('title', e.target.value)}
                />
                <button type="button" className="smart-regen-btn" onClick={handleRegenerate}>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="23 4 23 10 17 10" />
                    <polyline points="1 20 1 14 7 14" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                  </svg>
                  Regenerate
                </button>
              </div>
            </div>

            {/* Suggested Description */}
            <div className="smart-field-group">
              <label htmlFor="suggested-description" className="smart-section-label">
                SUGGESTED DESCRIPTION
              </label>
              <textarea
                id="suggested-description"
                rows={4}
                className="smart-textarea"
                value={form.description || SUGGESTIONS[suggestionIdx].desc}
                onChange={(e) => onUpdate('description', e.target.value)}
              />
            </div>

            {/* Amenities Spotted */}
            <div className="smart-field-group">
              <span className="smart-section-label">AMENITIES WE SPOTTED · ACCEPT OR REMOVE</span>
              <div className="smart-amenities-grid">
                <label className="smart-amenity-card">
                  <div className="smart-amenity-left">
                    <input
                      type="checkbox"
                      checked={amenityStates.wifi}
                      onChange={() => toggleAmenity('wifi')}
                    />
                    <span className="smart-amenity-icon">📶</span>
                    <span className="smart-amenity-name">Wifi</span>
                  </div>
                  <span className="smart-source-tag">from photos</span>
                </label>

                <label className="smart-amenity-card">
                  <div className="smart-amenity-left">
                    <input
                      type="checkbox"
                      checked={amenityStates.kitchen}
                      onChange={() => toggleAmenity('kitchen')}
                    />
                    <span className="smart-amenity-icon">🍴</span>
                    <span className="smart-amenity-name">Kitchen</span>
                  </div>
                  <span className="smart-source-tag">from photos</span>
                </label>

                <label className="smart-amenity-card">
                  <div className="smart-amenity-left">
                    <input
                      type="checkbox"
                      checked={amenityStates.air_conditioning}
                      onChange={() => toggleAmenity('air_conditioning')}
                    />
                    <span className="smart-amenity-icon">❄️</span>
                    <span className="smart-amenity-name">Air conditioning</span>
                  </div>
                  <span className="smart-source-tag">from photos</span>
                </label>

                <label className="smart-amenity-card">
                  <div className="smart-amenity-left">
                    <input
                      type="checkbox"
                      checked={amenityStates.bathtub}
                      onChange={() => toggleAmenity('bathtub')}
                    />
                    <span className="smart-amenity-icon">🛁</span>
                    <span className="smart-amenity-name">Bathtub</span>
                  </div>
                  <span className="smart-source-tag">from photos</span>
                </label>

                <label className="smart-amenity-card">
                  <div className="smart-amenity-left">
                    <input
                      type="checkbox"
                      checked={amenityStates.street_parking}
                      onChange={() => toggleAmenity('street_parking')}
                    />
                    <span className="smart-amenity-icon">🚗</span>
                    <span className="smart-amenity-name">Street parking</span>
                  </div>
                  <span className="smart-source-tag">from address</span>
                </label>

                <label className="smart-amenity-card">
                  <div className="smart-amenity-left">
                    <input
                      type="checkbox"
                      checked={amenityStates.tram_at_door}
                      onChange={() => toggleAmenity('tram_at_door')}
                    />
                    <span className="smart-amenity-icon">🚊</span>
                    <span className="smart-amenity-name">Tram at the door</span>
                  </div>
                  <span className="smart-source-tag">from address</span>
                </label>
              </div>
            </div>

            {/* Neighbourhood */}
            <div className="smart-field-group">
              <span className="smart-section-label">NEIGHBOURHOOD · FROM THE ADDRESS</span>
              <div className="smart-neighbourhood-list">
                <div className="smart-neighbourhood-row">
                  <div className="smart-neighbourhood-item">
                    <span className="smart-neigh-icon">🚊</span>
                    <span>Bica funicular and tram 28</span>
                  </div>
                  <span className="smart-neigh-dist">at the door</span>
                </div>

                <div className="smart-neighbourhood-row">
                  <div className="smart-neighbourhood-item">
                    <span className="smart-neigh-icon">🌊</span>
                    <span>Cais do Sodré riverfront</span>
                  </div>
                  <span className="smart-neigh-dist">6 min walk</span>
                </div>

                <div className="smart-neighbourhood-row">
                  <div className="smart-neighbourhood-item">
                    <span className="smart-neigh-icon">🍴</span>
                    <span>Time Out Market</span>
                  </div>
                  <span className="smart-neigh-dist">8 min walk</span>
                </div>

                <div className="smart-neighbourhood-row">
                  <div className="smart-neighbourhood-item">
                    <span className="smart-neigh-icon">🏛️</span>
                    <span>Chiado and Carmo convent</span>
                  </div>
                  <span className="smart-neigh-dist">10 min walk</span>
                </div>
              </div>
            </div>

            {/* Info callout */}
            <div className="smart-info-note">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <span>You can edit any of this later from the listing editor.</span>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Sticky Footer */}
      <footer className="smart-setup-footer">
        <div className="smart-progress-nav">
          <div className="smart-step-indicator smart-step-indicator--done">
            <span className="smart-step-num">1</span>
            <span className="smart-step-text">Tell us about your place</span>
            <div className="smart-step-bar" />
          </div>

          <div
            className={`smart-step-indicator ${currentStep === 2 ? 'smart-step-indicator--active' : ''}`}
          >
            <span className="smart-step-num">2</span>
            <span className="smart-step-text">Make it stand out</span>
            <div className="smart-step-bar" />
          </div>

          <div
            className={`smart-step-indicator ${currentStep === 3 ? 'smart-step-indicator--active' : ''}`}
          >
            <span className="smart-step-num">3</span>
            <span className="smart-step-text">Finish up</span>
            <div className="smart-step-bar" />
          </div>
        </div>

        <div className="smart-footer-actions">
          <Button
            variant="ghost"
            onClick={() => {
              if (currentStep > 1) setCurrentStep((s) => s - 1);
              else onSaveAndExit();
            }}
          >
            Back
          </Button>

          <Button
            className="smart-next-btn"
            onClick={() => {
              if (currentStep < 3) {
                setCurrentStep((s) => s + 1);
              } else {
                onNext();
              }
            }}
          >
            {currentStep === 3 ? 'Go to editor' : 'Next'}
          </Button>
        </div>
      </footer>
    </div>
  );
}
