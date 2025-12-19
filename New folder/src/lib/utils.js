import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function exportToCSV(data, headers, filename) {
  const csvRows = [];
  
  // Headers
  csvRows.push(headers.map(h => `"${h}"`).join(','));
  
  // Data
  for (const row of data) {
    const values = row.map(value => {
      const val = value === null || value === undefined ? '' : value;
      const stringVal = String(val);
      const escaped = stringVal.replace(/"/g, '""'); 
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  }
  
  const csvContent = csvRows.join('\n');
  const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}