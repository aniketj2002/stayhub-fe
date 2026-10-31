// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { downloadCSV } from './export';

describe('downloadCSV Utility', () => {
  it('formats objects into CSV and triggers anchor download', () => {
    const createObjectURLMock = vi.fn().mockReturnValue('blob:mock-url');
    const revokeObjectURLMock = vi.fn();
    window.URL.createObjectURL = createObjectURLMock;
    window.URL.revokeObjectURL = revokeObjectURLMock;

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const testData = [
      { id: '1', name: 'Alice, "Smith"', role: 'Admin' },
      { id: '2', name: 'Bob\nJones', role: 'Host' },
    ];

    downloadCSV(testData, 'test-export');

    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-url');

    clickSpy.mockRestore();
  });

  it('handles empty data gracefully without throwing', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    downloadCSV([]);
    expect(warnSpy).toHaveBeenCalledWith('downloadCSV called with empty data');
    warnSpy.mockRestore();
  });
});

