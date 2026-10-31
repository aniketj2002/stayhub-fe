/**
 * Utility to trigger CSV download from an array of objects or rows.
 */
export function downloadCSV(
  rows: Record<string, unknown>[] | (string | number | boolean | null | undefined)[][],
  filename: string = 'export.csv',
  headers?: string[],
): void {
  if (!rows || rows.length === 0) {
    console.warn('downloadCSV called with empty data');
    return;
  }

  let csvContent = '';

  const formatCell = (val: unknown): string => {
    if (val === null || val === undefined) return '';
    const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  if (Array.isArray(rows[0])) {
    const matrix = rows as (string | number | boolean | null | undefined)[][];
    if (headers && headers.length > 0) {
      csvContent += headers.map(formatCell).join(',') + '\r\n';
    }
    csvContent += matrix.map((row) => row.map(formatCell).join(',')).join('\r\n');
  } else {
    const objRows = rows as Record<string, unknown>[];
    const columnKeys = headers || Object.keys(objRows[0]);
    csvContent += columnKeys.map(formatCell).join(',') + '\r\n';
    csvContent += objRows
      .map((row) => columnKeys.map((key) => formatCell(row[key])).join(','))
      .join('\r\n');
  }

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

