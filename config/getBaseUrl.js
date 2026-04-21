const getBaseUrl = (req) => {
  // If behind proxy (e.g., Nginx), trust 'x-forwarded-proto' header
  const protocol = req.get("x-forwarded-proto") || req.protocol;
  return `${protocol}://${req.get("host")}/uploads/`;
};

module.exports = getBaseUrl;
