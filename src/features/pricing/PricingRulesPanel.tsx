import { useEffect, useState } from 'react';
import { usePricingRules, useUpdatePricingRules } from './api';
import { Button, Field, RequestError, Skeleton, SuccessNotice } from '../../components/ui';

interface Props {
  listingId: string;
  basePriceMinor?: number;
  currency?: string;
}

export function PricingRulesPanel({ listingId, basePriceMinor, currency = 'EUR' }: Props) {
  const { data: rules, isLoading, error, refetch } = usePricingRules(listingId);
  const updateMutation = useUpdatePricingRules();

  const [weekendPriceEuros, setWeekendPriceEuros] = useState('');
  const [minNights, setMinNights] = useState('1');
  const [weeklyDiscountPct, setWeeklyDiscountPct] = useState('0');
  const [monthlyDiscountPct, setMonthlyDiscountPct] = useState('0');

  const [validationError, setValidationError] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (rules) {
      setWeekendPriceEuros(
        rules.weekend_price_minor ? (rules.weekend_price_minor / 100).toFixed(2) : '',
      );
      setMinNights(String(rules.min_nights || 1));
      setWeeklyDiscountPct(String(Math.round((rules.weekly_discount_bps || 0) / 100)));
      setMonthlyDiscountPct(String(Math.round((rules.monthly_discount_bps || 0) / 100)));
    }
  }, [rules]);

  if (isLoading) {
    return (
      <div className="pricing-rules-panel">
        <Skeleton label="Loading pricing rules" rows={4} />
      </div>
    );
  }

  if (error) {
    return <RequestError error={error} onRetry={() => void refetch()} />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');
    setSavedSuccess(false);

    const minNightsNum = parseInt(minNights, 10);
    if (isNaN(minNightsNum) || minNightsNum < 1) {
      setValidationError('Minimum nights must be at least 1.');
      return;
    }

    const weeklyPct = parseFloat(weeklyDiscountPct) || 0;
    const monthlyPct = parseFloat(monthlyDiscountPct) || 0;

    if (weeklyPct < 0 || weeklyPct >= 100) {
      setValidationError('Weekly discount must be between 0% and 99%.');
      return;
    }

    if (monthlyPct < 0 || monthlyPct >= 100) {
      setValidationError('Monthly discount must be between 0% and 99%.');
      return;
    }

    const weekendMinor = weekendPriceEuros ? Math.round(parseFloat(weekendPriceEuros) * 100) : null;
    if (weekendMinor !== null && weekendMinor < 0) {
      setValidationError('Weekend price cannot be negative.');
      return;
    }

    await updateMutation.mutateAsync({
      listingId,
      input: {
        weekend_price_minor: weekendMinor,
        min_nights: minNightsNum,
        weekly_discount_bps: Math.round(weeklyPct * 100),
        monthly_discount_bps: Math.round(monthlyPct * 100),
      },
    });

    setSavedSuccess(true);
  };

  return (
    <div className="pricing-rules-panel">
      <div className="pricing-rules-header">
        <h2>Pricing & Length-of-Stay Rules</h2>
        <p className="pricing-rules-subtitle">
          Customize pricing variations for weekends and length-of-stay discounts.
        </p>
      </div>

      {savedSuccess && <SuccessNotice>Pricing rules updated successfully.</SuccessNotice>}
      {validationError && <p className="field-error" role="alert">{validationError}</p>}
      {updateMutation.error && <RequestError error={updateMutation.error} />}

      <form onSubmit={handleSubmit} className="pricing-rules-form">
        {/* Base Price Reference */}
        {basePriceMinor !== undefined && (
          <div className="pricing-base-reference">
            <span className="reference-label">Standard Base Price:</span>
            <strong className="reference-value">
              €{(basePriceMinor / 100).toFixed(2)} {currency} / night
            </strong>
          </div>
        )}

        <div className="field">
          <Field
            id="weekend-price-input"
            label="Weekend Price (€ / night)"
            type="number"
            step="0.01"
            min="0"
            placeholder="e.g. 130.00 (leave blank to use base price)"
            value={weekendPriceEuros}
            onChange={(e) => {
              setWeekendPriceEuros(e.target.value);
              setSavedSuccess(false);
            }}
            hint="Applies to Friday and Saturday nights."
          />
        </div>

        <div className="field">
          <Field
            id="min-nights-input"
            label="Minimum Stay (nights)"
            type="number"
            min="1"
            max="365"
            value={minNights}
            onChange={(e) => {
              setMinNights(e.target.value);
              setSavedSuccess(false);
            }}
            required
            hint="Must be at least 1 night."
          />
        </div>

        <div className="pricing-discounts-group">
          <h3>Length of Stay Discounts</h3>
          <p className="pricing-discounts-desc">
            Encourage longer stays by offering a percentage discount off the nightly rate.
          </p>

          <div className="pricing-discounts-grid">
            <div className="field">
              <Field
                id="weekly-discount-input"
                label="Weekly Discount (7+ nights)"
                type="number"
                min="0"
                max="99"
                value={weeklyDiscountPct}
                onChange={(e) => {
                  setWeeklyDiscountPct(e.target.value);
                  setSavedSuccess(false);
                }}
                hint="e.g. 10 for 10% off"
              />
            </div>

            <div className="field">
              <Field
                id="monthly-discount-input"
                label="Monthly Discount (28+ nights)"
                type="number"
                min="0"
                max="99"
                value={monthlyDiscountPct}
                onChange={(e) => {
                  setMonthlyDiscountPct(e.target.value);
                  setSavedSuccess(false);
                }}
                hint="e.g. 20 for 20% off"
              />
            </div>
          </div>
        </div>

        <div className="pricing-rules-actions">
          <Button type="submit" variant="primary" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Saving…' : 'Save Pricing Rules'}
          </Button>
        </div>
      </form>
    </div>
  );
}

