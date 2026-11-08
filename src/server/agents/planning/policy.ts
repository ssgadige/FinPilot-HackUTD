// Deterministic rejection of numerical score claims and affirmative approval promises.
// Disclaimers without score numbers remain allowed. This is not a general prose verifier.
export function unsupportedLendingClaim(text:string):boolean {
  return /\b(?:credit|fico)\s*score\b[^.!?\n]{0,40}\b\d{2,3}\b/i.test(text) ||
    /\b\d+\s*(?:points|pts)\b[^.!?\n]{0,35}\b(?:credit|fico|score)\b/i.test(text) ||
    /\b(?:credit|fico|score)\b[^.!?\n]{0,35}\b\d+\s*(?:points|pts)\b/i.test(text) ||
    /\b(?:you are|you're|your loan is|your mortgage is)\s+(?:pre[- ]?)?approved\b/i.test(text) ||
    /\bapproval\s+(?:is\s+)?guaranteed\b/i.test(text);
}
