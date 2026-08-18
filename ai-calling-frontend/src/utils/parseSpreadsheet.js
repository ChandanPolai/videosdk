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

const NAME_HEADER_PATTERNS = [
  /full\s*name/i,
  /client\s*name/i,
  /customer\s*name/i,
  /participant/i,
  /^name$/i,
  /\bnaam\b/i,
  /first\s*name/i,
  /^client$/i,
  /^customer$/i
];

const cellToText = (value) => {
  if (value == null || value === '') return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.round(value));
  }
  return String(value).trim();
};

const looksLikePhone = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15;
};

const looksLikeName = (value) => {
  const text = String(value || '').trim();
  if (!text || looksLikePhone(text)) return false;
  return /[A-Za-z\u0900-\u097F]/.test(text);
};

export const detectNameAndPhoneColumns = (headers = [], rows = []) => {
  const sample = rows.slice(0, 80);

  const phoneRank = headers.map((header) => {
    const headerBonus = PHONE_HEADER_PATTERNS.some((pattern) => pattern.test(String(header))) ? 3 : 0;
    const valueScore = sample.filter((row) => looksLikePhone(row[header])).length;
    return { header, score: valueScore + headerBonus };
  });
  phoneRank.sort((a, b) => b.score - a.score);

  const phoneColumn =
    phoneRank.find((item) => item.score > 0)?.header || headers[1] || headers[0] || '';

  const nameRank = headers
    .filter((header) => header !== phoneColumn)
    .map((header) => {
      const headerBonus = NAME_HEADER_PATTERNS.some((pattern) => pattern.test(String(header))) ? 3 : 0;
      const valueScore = sample.filter((row) => looksLikeName(row[header])).length;
      return { header, score: valueScore + headerBonus };
    });
  nameRank.sort((a, b) => b.score - a.score);

  const nameColumn =
    nameRank.find((item) => item.score > 0)?.header ||
    headers.find((header) => header !== phoneColumn) ||
    headers[0] ||
    '';

  return { nameColumn, phoneColumn };
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

        const { nameColumn, phoneColumn } = detectNameAndPhoneColumns(headerRow, rows);

        resolve({
          sheetName,
          headers: headerRow,
          rows,
          fileName: file.name,
          nameColumn,
          phoneColumn
        });
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Failed to parse Excel file'));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
