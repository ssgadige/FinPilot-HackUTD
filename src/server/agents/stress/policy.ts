export function unsupportedProbabilityClaim(text:string):boolean {
  return /\b\d+(?:\.\d+)?\s*%\s*(?:chance|probability|likelihood|likely|risk of)/i.test(text) ||
    /\b(?:probability|likelihood|chance|odds)\b[^.!?\n]{0,40}\b\d+(?:\.\d+)?/i.test(text) ||
    /\b(?:likely|unlikely|probably)\b/i.test(text) ||
    /\b(?:guaranteed safe|guaranteed resilient|guaranteed resilience|will never fail|cannot fail|risk[- ]free)\b/i.test(text);
}
