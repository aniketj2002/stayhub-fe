import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureAuth } from '../../lib/api';
import { changeCalendar, getQuote, publicListing, saveListing } from './api';
import { hostDetail, json, publicDetail, quote } from '../../test/fixtures';
afterEach(() => {
  vi.unstubAllGlobals();
  configureAuth(
    () => null,
    () => {},
  );
});

describe('Phase 3 backend contracts', () => {
  it('reads nested public detail and quote responses without attaching account credentials', async () => {
    configureAuth(
      () => 'private-token',
      () => {},
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ listing: publicDetail }))
      .mockResolvedValueOnce(json({ quote: quote() }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(publicListing('home-1')).resolves.toMatchObject({ listing: { id: 'home-1' } });
    await expect(
      getQuote('home-1', { check_in: '2030-02-01', check_out: '2030-02-03', guests: 1 }),
    ).resolves.toMatchObject({ quote: { breakdown: { guest_total_minor: 23940 } } });
    expect(
      fetchMock.mock.calls.every(([, init]) => !new Headers(init.headers).has('Authorization')),
    ).toBe(true);
  });
  it('uses PATCH working-version and DELETE calendar bodies with an exclusive end date', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(hostDetail))
      .mockResolvedValueOnce(json({ nights: [] }));
    vi.stubGlobal('fetch', fetchMock);
    await saveListing('home-1', { title: 'Updated draft', wizard_step: 5 });
    await changeCalendar('home-1', '2030-02-01', '2030-02-03', false);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/host/listings/home-1/working-version');
    expect(fetchMock.mock.calls[0][1].method).toBe('PATCH');
    expect(fetchMock.mock.calls[1][1].method).toBe('DELETE');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      start_date: '2030-02-01',
      end_date: '2030-02-03',
    });
  });
});
