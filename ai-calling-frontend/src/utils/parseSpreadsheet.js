import * as XLSX from 'xlsx';

const PHONE_HEADER_PATTERNS = [
  /mobile/i,
  /phone/i,
  /\bmob\b/i,
  /cell/i,
  /msisdn/i,
  /whatsapp/i,
  /contact/i,
  /number/i,
  /num/i
];

const cellToText = (value) => {
  if (value == null || value === '') return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.round(value));
  }
  return String(value).trim();
};

export const parseSpreadsheetFile = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];

        if (!sheetName) {
          throw new Error('Excel file has no sheets');
        }

        const sheet = workbook.Sheets[sheetName];
        const matrix = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: '',
          raw: true,
          blankrows: false
        });

        const headerRow = (matrix[0] || []).map((cell, index) => {
          const label = cellToText(cell);
          return label || `Column ${index + 1}`;
        });

        if (!headerRow.length) {
          throw new Error('Could not find any columns in the first sheet');
        }

        const rows = matrix.slice(1).map((row) => {
          const record = {};
          headerRow.forEach((header, index) => {
            record[header] = cellToText(row?.[index]);
          });
          return record;
        });

        resolve({
          sheetName,
          headers: headerRow,
          rows,
          fileName: file.name
        });
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Failed to parse Excel file'));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });

export const guessPhoneColumn = (headers = []) => {
  for (const pattern of PHONE_HEADER_PATTERNS) {
    const match = headers.find((header) => pattern.test(String(header)));
    if (match) return match;
  }
  return headers[0] || '';
};
