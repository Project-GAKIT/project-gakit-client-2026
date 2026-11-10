export function validateSearchText(
  value: string,
  { minLength = 0, maxLength = 120 }: { minLength?: number; maxLength?: number } = {}
): string | null {
  if (minLength > 0 && value.trim().length < minLength) return `Enter at least ${minLength} characters.`;
  if (value.length > maxLength) return `Search must be ${maxLength} characters or fewer.`;
  if (/[\u0000-\u001f\u007f-\u009f]/.test(value)) return 'Search cannot contain control characters.';
  return null;
}

export function isValidFloodDepthCm(value: string): boolean {
  return /^\d{1,3}$/.test(value) && Number(value) >= 1 && Number(value) <= 999;
}

export function validateObservationTime(value: string, now: number): string | null {
  if (!value) return 'Enter the date and time observed.';
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return 'Enter a valid date and time.';
  if (timestamp > now + 300000) return 'Observation time cannot be more than 5 minutes in the future.';
  return null;
}
