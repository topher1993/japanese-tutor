export interface ExternalBetaFeedbackFormAccess {
  label: string;
  url: string;
  helperText: string;
}

const betaFeedbackFormUrl = 'https://docs.google.com/forms/d/e/1FAIpQLScU5_buXQqNTOvhqerBUqPZkbqZ3EPXJBIvo-TkzDM7KMcSmQ/viewform';

export function getExternalBetaFeedbackFormAccess(): ExternalBetaFeedbackFormAccess {
  return {
    label: 'Open full beta tester form',
    url: betaFeedbackFormUrl,
    helperText: 'Use this full form for complete beta review. If screenshot upload is not available, paste a Drive link or send screenshots directly to Chris.',
  };
}

export function isGoogleFormsResponderUrl(url: string): boolean {
  return /^https:\/\/docs\.google\.com\/forms\/d\/e\/[^/]+\/viewform$/.test(url);
}
