const URL_REGEX = /https?:\/\/[^\s<>"')\]]+/g;

export const extractLinks = (text: string): string[] => {
  const matches = text.match(URL_REGEX);
  if (!matches) return [];
  return [...new Set(matches)];
};
