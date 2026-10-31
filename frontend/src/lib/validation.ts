export const PASSWORD_RULES = [
  { label: 'More than 8 characters', test: (p: string) => p.length > 8 },
  { label: 'An uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'A lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'A special character', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export const passwordIssues = (p: string) =>
  PASSWORD_RULES.filter((r) => !r.test(p)).map((r) => r.label);
export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
