const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const pool = require('../config/db');
const { signToken } = require('../utils/jwt');

const googleClient = process.env.GOOGLE_CLIENT_ID ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID) : null;

async function register(req, res, next) {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'name, email y password son obligatorios' });
    }

    const finalRole = role === 'admin' ? 'admin' : 'cliente';

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Ya existe un usuario con ese email' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, passwordHash, finalRole]
    );

    const user = { id: result.insertId, name, email, role: finalRole };
    const token = signToken({ id: user.id, role: user.role, name: user.name });

    res.status(201).json({ user, token });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'email y password son obligatorios' });
    }

    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    const dbUser = rows[0];
    if (!dbUser) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    if (!dbUser.password_hash) {
      return res.status(401).json({
        message: 'Esta cuenta se creó con Google. Usa el botón "Continuar con Google" para ingresar.'
      });
    }

    const valid = await bcrypt.compare(password, dbUser.password_hash);
    if (!valid) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const user = { id: dbUser.id, name: dbUser.name, email: dbUser.email, role: dbUser.role };
    const token = signToken({ id: user.id, role: user.role, name: user.name });

    res.json({ user, token });
  } catch (err) {
    next(err);
  }
}

async function googleLogin(req, res, next) {
  try {
    if (!googleClient) {
      return res.status(503).json({
        message: 'Login con Google no configurado en el servidor (falta GOOGLE_CLIENT_ID en backend/.env).'
      });
    }

    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ message: 'credential es obligatorio' });
    }

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID
      });
      payload = ticket.getPayload();
    } catch (err) {
      return res.status(401).json({ message: 'Token de Google inválido o expirado' });
    }

    const { sub: googleId, email, email_verified: emailVerified, name, picture } = payload;
    if (!email) {
      return res.status(400).json({ message: 'La cuenta de Google no tiene un email asociado' });
    }
    if (!emailVerified) {
      // Sin esto, alguien con un email no verificado en Google (ej. alias añadido por un
      // admin de Workspace sin confirmar) podría vincularse a una cuenta local ajena que
      // use ese mismo email y tomar control de ella. Ver guía de Google Sign-In.
      return res.status(403).json({ message: 'Tu email de Google no está verificado. Verifícalo con Google o usa el login tradicional.' });
    }

    const [rows] = await pool.query('SELECT * FROM users WHERE email = ? OR google_id = ?', [email, googleId]);
    let dbUser = rows[0];

    if (!dbUser) {
      const [result] = await pool.query(
        'INSERT INTO users (name, email, password_hash, role, google_id, avatar_url, auth_provider) VALUES (?, ?, NULL, ?, ?, ?, ?)',
        [name || email, email, 'cliente', googleId, picture || null, 'google']
      );
      dbUser = {
        id: result.insertId,
        name: name || email,
        email,
        role: 'cliente',
        google_id: googleId,
        avatar_url: picture || null,
        auth_provider: 'google'
      };
    } else if (!dbUser.google_id) {
      // Cuenta creada con login tradicional: se vincula con Google en vez de duplicarla.
      const newProvider = dbUser.password_hash ? 'ambos' : 'google';
      await pool.query(
        'UPDATE users SET google_id = ?, avatar_url = COALESCE(avatar_url, ?), auth_provider = ? WHERE id = ?',
        [googleId, picture || null, newProvider, dbUser.id]
      );
      dbUser.google_id = googleId;
      dbUser.auth_provider = newProvider;
    }

    const user = { id: dbUser.id, name: dbUser.name, email: dbUser.email, role: dbUser.role };
    const token = signToken({ id: user.id, role: user.role, name: user.name });

    res.json({ user, token });
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, email, role, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, googleLogin, me };
