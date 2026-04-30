const jwt = require('jsonwebtoken');

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET nao configurado. Defina a variavel de ambiente antes de iniciar o servidor.');
}

const SEGREDO_JWT = process.env.JWT_SECRET;

const middlewareAutenticacao = (req, res, next) => {
  const cabecalhoAuth = req.headers.authorization;

  if (!cabecalhoAuth) {
    return res.status(401).json({ erro: 'Token nao fornecido' });
  }

  const partes = cabecalhoAuth.split(' ');
  if (partes.length !== 2 || partes[0] !== 'Bearer' || !partes[1]) {
    return res.status(401).json({ erro: 'Formato de token invalido' });
  }

  const token = partes[1];

  try {
    const decodificado = jwt.verify(token, SEGREDO_JWT);
    req.usuario = decodificado;
    return next();
  } catch (erro) {
    return res.status(401).json({ erro: 'Token invalido ou expirado' });
  }
};

module.exports = middlewareAutenticacao;
module.exports.SEGREDO_JWT = SEGREDO_JWT;
