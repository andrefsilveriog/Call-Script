export const quoteApiConfig = {
  rapidApiKey: "13f48093camsh327fb2e22872c41p19ff28jsn9ac49867622f",
  rapidApiHost: "private-zillow.p.rapidapi.com",
};

export const isQuoteApiConfigured = !Object.values(quoteApiConfig).some(
  (value) => !value || value === "REPLACE_ME"
);
