export type ExportFormat = 'csv' | 'excel' | 'pdf';

export function exportToCsv(data: Record<string, unknown>[], filename: string) {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','),
    ...data.map(row =>
      headers.map(h => {
        const val = String(row[h] ?? '');
        return val.includes(',') || val.includes('"') || val.includes('\n')
          ? `"${val.replace(/"/g, '""')}"`
          : val;
      }).join(',')
    ),
  ];
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}.csv`);
}

export async function exportToExcel(data: Record<string, unknown>[], filename: string) {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Attendees');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export async function exportToPdf(data: Record<string, unknown>[], filename: string, title: string) {
  const jsPDF = (await import('jspdf')).default;
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(16);
  doc.text(title, 14, 20);
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 28);

  if (data.length > 0) {
    const headers = Object.keys(data[0]);
    const rows = data.map(row => headers.map(h => String(row[h] ?? '')));
    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 34,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [235, 106, 61] },
    });
  }

  doc.save(`${filename}.pdf`);
}

export async function exportData(
  data: Record<string, unknown>[],
  filename: string,
  format: ExportFormat,
  title: string = filename,
) {
  switch (format) {
    case 'csv':
      exportToCsv(data, filename);
      break;
    case 'excel':
      exportToExcel(data, filename);
      break;
    case 'pdf':
      exportToPdf(data, filename, title);
      break;
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
