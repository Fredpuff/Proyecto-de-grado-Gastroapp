function notFound(req, res) {
  res.status(404).json({ message: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
}

function errorHandler(err, _req, res, _next) {
  console.error(err);

  // err.status is only set on errors we throw intentionally (validation, ownership
  // checks, 404s) — those messages are safe to show. Anything else (DB failures,
  // unexpected exceptions) could leak internal details, so return a generic message.
  if (err.status) {
    return res.status(err.status).json({ message: err.message, errors: err.errors });
  }
  res.status(500).json({ message: 'Error interno del servidor' });
}

module.exports = { notFound, errorHandler };
