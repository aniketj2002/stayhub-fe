// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { DataTable } from './ui';

interface SampleItem {
  id: string;
  name: string;
  role: string;
  amount: number;
}

const sampleColumns = [
  { key: 'id', header: 'ID', sortable: true },
  { key: 'name', header: 'Full Name', sortable: true },
  { key: 'role', header: 'Role' },
  { key: 'amount', header: 'Amount', align: 'right' as const },
];

const sampleData: SampleItem[] = [
  { id: '1', name: 'Alice Smith', role: 'Admin', amount: 120 },
  { id: '2', name: 'Bob Jones', role: 'Host', amount: 350 },
  { id: '3', name: 'Charlie Brown', role: 'Guest', amount: 75 },
  { id: '4', name: 'Diana Prince', role: 'Super Admin', amount: 900 },
  { id: '5', name: 'Evan Wright', role: 'Host', amount: 210 },
];

describe('DataTable Primitive', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders headers and data rows correctly', () => {
    render(
      <DataTable
        columns={sampleColumns}
        data={sampleData.slice(0, 2)}
      />,
    );

    expect(screen.getByText('ID')).toBeTruthy();
    expect(screen.getByText('Full Name')).toBeTruthy();
    expect(screen.getByText('Alice Smith')).toBeTruthy();
    expect(screen.getByText('Bob Jones')).toBeTruthy();
  });

  it('handles client-side pagination correctly', () => {
    render(
      <DataTable
        columns={sampleColumns}
        data={sampleData}
        pageSize={2}
      />,
    );

    // Page 1 should display 1 & 2
    expect(screen.getByText('Alice Smith')).toBeTruthy();
    expect(screen.getByText('Bob Jones')).toBeTruthy();
    expect(screen.queryByText('Charlie Brown')).toBeNull();

    // Check pagination status
    expect(screen.getByText('Page 1 of 3')).toBeTruthy();
    const info = document.querySelector('.data-table-pagination-info');
    expect(info?.textContent).toContain('Showing 1–2 of 5');

    // Click Next
    const nextBtn = screen.getByRole('button', { name: /next page/i });
    fireEvent.click(nextBtn);

    // Page 2 should display 3 & 4
    expect(screen.getByText('Charlie Brown')).toBeTruthy();
    expect(screen.getByText('Diana Prince')).toBeTruthy();
    expect(screen.queryByText('Alice Smith')).toBeNull();
    expect(screen.getByText('Page 2 of 3')).toBeTruthy();

    // Click Previous
    const prevBtn = screen.getByRole('button', { name: /previous page/i });
    fireEvent.click(prevBtn);
    expect(screen.getByText('Alice Smith')).toBeTruthy();
  });

  it('triggers onPageChange in controlled pagination mode', () => {
    const handlePageChange = vi.fn();
    render(
      <DataTable
        columns={sampleColumns}
        data={sampleData.slice(0, 2)}
        currentPage={1}
        pageSize={2}
        totalCount={5}
        onPageChange={handlePageChange}
      />,
    );

    const nextBtn = screen.getByRole('button', { name: /next page/i });
    fireEvent.click(nextBtn);
    expect(handlePageChange).toHaveBeenCalledWith(2);
  });

  it('triggers onSort when clicking a sortable column header', () => {
    const handleSort = vi.fn();
    render(
      <DataTable
        columns={sampleColumns}
        data={sampleData.slice(0, 2)}
        sortKey="name"
        sortDirection="asc"
        onSort={handleSort}
      />,
    );

    const sortTrigger = screen.getByRole('button', { name: /full name/i });
    fireEvent.click(sortTrigger);
    expect(handleSort).toHaveBeenCalledWith('name', 'desc');
  });

  it('displays custom emptyState when data is empty', () => {
    render(
      <DataTable
        columns={sampleColumns}
        data={[]}
        emptyState={<div>Custom Empty Notice</div>}
      />,
    );

    expect(screen.getByText('Custom Empty Notice')).toBeTruthy();
  });

  it('displays loading spinner when loading is true', () => {
    render(
      <DataTable
        columns={sampleColumns}
        data={[]}
        loading={true}
      />,
    );

    expect(screen.getByText('Loading records…')).toBeTruthy();
  });
});
