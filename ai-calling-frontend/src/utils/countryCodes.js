export const COUNTRY_CODES = [
  { code: 'IN', dial: '+91', label: 'India (+91)' },
  { code: 'US', dial: '+1', label: 'United States (+1)' },
  { code: 'GB', dial: '+44', label: 'United Kingdom (+44)' },
  { code: 'AE', dial: '+971', label: 'UAE (+971)' },
  { code: 'SG', dial: '+65', label: 'Singapore (+65)' },
  { code: 'AU', dial: '+61', label: 'Australia (+61)' },
  { code: 'CA', dial: '+1', label: 'Canada (+1)' },
  { code: 'DE', dial: '+49', label: 'Germany (+49)' },
  { code: 'FR', dial: '+33', label: 'France (+33)' },
  { code: 'SA', dial: '+966', label: 'Saudi Arabia (+966)' },
  { code: 'PK', dial: '+92', label: 'Pakistan (+92)' },
  { code: 'BD', dial: '+880', label: 'Bangladesh (+880)' },
  { code: 'NP', dial: '+977', label: 'Nepal (+977)' },
  { code: 'LK', dial: '+94', label: 'Sri Lanka (+94)' },
  { code: 'PH', dial: '+63', label: 'Philippines (+63)' },
  { code: 'MY', dial: '+60', label: 'Malaysia (+60)' },
  { code: 'ID', dial: '+62', label: 'Indonesia (+62)' },
  { code: 'TH', dial: '+66', label: 'Thailand (+66)' },
  { code: 'JP', dial: '+81', label: 'Japan (+81)' },
  { code: 'KR', dial: '+82', label: 'South Korea (+82)' }
];

export const getDialCode = (countryCode = 'IN') =>
  COUNTRY_CODES.find((item) => item.code === countryCode)?.dial || '+91';

export const buildE164 = (countryCode, localNumber = '') => {
  const dial = getDialCode(countryCode);
  let local = String(localNumber).trim().replace(/[\s()-]/g, '');
  if (!local) return '';

  if (local.startsWith('+')) {
    return local;
  }

  // Remove leading zeros (common for local numbers)
  local = local.replace(/^0+/, '');

  // If user already typed country dial digits, keep as +number
  const dialDigits = dial.replace('+', '');
  if (local.startsWith(dialDigits)) {
    return `+${local}`;
  }

  return `${dial}${local}`;
};
