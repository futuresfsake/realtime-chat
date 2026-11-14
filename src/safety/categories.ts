// What a person can report (US-29). The categories follow the Safe Spaces Act
// (RA 11313) and the Anti-OSAEC law (RA 11930). A report carries a category
// and nothing else: no transcript, because the server never had the messages.
export const REPORT_CATEGORIES = ["harassment", "sexual", "spam", "hate", "minor", "threats", "other"] as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

// These two are flagged for priority human review (US-29): a possible minor,
// or a threat of harm. There is no moderator tool yet, so for now the flag is
// a warning-level log line an operator can alert on.
export const PRIORITY_CATEGORIES: ReadonlySet<ReportCategory> = new Set(["minor", "threats"]);
