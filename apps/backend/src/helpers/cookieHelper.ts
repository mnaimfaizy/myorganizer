export const getExpiry = () => {
  const date = new Date();
  const expiration = new Date(date.setDate(date.getDate() + 7));
  return expiration;
};
