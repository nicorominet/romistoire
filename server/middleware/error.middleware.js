export const handleError = (res, error) => {
  console.error('Error:', error);
  if (error.sqlMessage) {
    return res.status(500).json({ error: 'Database error', details: error.message });
  }
  return res.status(500).json({ error: error.message || 'Internal server error' });
};
