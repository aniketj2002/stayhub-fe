import type { ListingVersion, WorkingPatch } from './types';
export const wizardSteps = [
  'The place',
  'Guests & amenities',
  'Photos',
  'Title & story',
  'Pricing',
  'Rules & policy',
  'Review',
];
export type WizardForm = Record<
  | 'property_type'
  | 'address_line1'
  | 'address_line2'
  | 'city'
  | 'region'
  | 'country'
  | 'postal_code'
  | 'timezone'
  | 'max_guests'
  | 'title'
  | 'description'
  | 'price'
  | 'cleaning'
  | 'check_in_time'
  | 'check_out_time'
  | 'house_rules'
  | 'cancellation_policy',
  string
> & { amenities: string[]; media_ids: string[]; instant_book: boolean };
export function toMinor(value: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(value))
    throw new Error('Enter a non-negative amount with at most two decimal places.');
  const [whole, fraction = ''] = value.split('.');
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(minor)) throw new Error('This amount is too large.');
  return minor;
}
export function toForm(version: ListingVersion): WizardForm {
  return {
    property_type: version.property_type || '',
    address_line1: version.address_line1 || '',
    address_line2: version.address_line2 || '',
    city: version.city || '',
    region: version.region || '',
    country: version.country || '',
    postal_code: version.postal_code || '',
    timezone: version.timezone || 'Europe/Lisbon',
    max_guests: String(version.max_guests || 1),
    title: version.title || '',
    description: version.description || '',
    price: version.base_price_minor == null ? '' : (version.base_price_minor / 100).toFixed(2),
    cleaning: (version.cleaning_fee_minor / 100).toFixed(2),
    check_in_time: version.check_in_time || '15:00',
    check_out_time: version.check_out_time || '11:00',
    house_rules: version.house_rules || '',
    cancellation_policy: version.cancellation_policy || '',
    amenities: version.amenities || [],
    media_ids: version.media_ids || [],
    instant_book: version.instant_book,
  };
}
export function wizardPatch(form: WizardForm, step: number, next: number): WorkingPatch {
  const patch: WorkingPatch = { wizard_step: next };
  switch (step) {
    case 1:
      return {
        ...patch,
        property_type: form.property_type,
        address_line1: form.address_line1,
        address_line2: form.address_line2,
        city: form.city,
        region: form.region,
        country: form.country.toUpperCase(),
        postal_code: form.postal_code,
        timezone: form.timezone,
      };
    case 2:
      if (!Number.isSafeInteger(Number(form.max_guests)) || Number(form.max_guests) < 1)
        throw new Error('Guest capacity must be a positive whole number.');
      return { ...patch, max_guests: Number(form.max_guests), amenities: form.amenities };
    case 3:
      return { ...patch, media_ids: [...new Set(form.media_ids)] };
    case 4:
      return { ...patch, title: form.title, description: form.description };
    case 5:
      return {
        ...patch,
        ...(form.price ? { base_price_minor: toMinor(form.price) } : {}),
        cleaning_fee_minor: toMinor(form.cleaning || '0'),
        currency: 'EUR',
        instant_book: form.instant_book,
      };
    case 6:
      return {
        ...patch,
        check_in_time: form.check_in_time,
        check_out_time: form.check_out_time,
        house_rules: form.house_rules,
        ...(form.cancellation_policy ? { cancellation_policy: form.cancellation_policy } : {}),
      };
    default:
      return patch;
  }
}
