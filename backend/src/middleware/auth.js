const { verifyToken } = require('../utils/jwt');

// Adjunta req.user si hay un token válido; si no hay token, continúa como anónimo.
function optionalAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      req.user = verifyToken(header.split(' ')[1]);
    } catch (err) {
      // token inválido/expirado: se ignora, sigue anónimo
    }
  }
  next();
}

// Exige un token válido.
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token no proporcionado' });
  }
  try {
    req.user = verifyToken(header.split(' ')[1]);
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token inválido o expirado' });
  }
}

// Exige que req.user.role esté dentro de los roles permitidos.
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'No tienes permisos para esta acción' });
    }
    next();
  };
}

module.exports = { optionalAuth, requireAuth, requireRole };
