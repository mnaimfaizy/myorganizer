import jwt, { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';

export const generateToken = (
  payload: object,
  key: string,
  expiry: string
): string | Error => {
  return jwt.sign({ ...payload }, key, { expiresIn: expiry });
};

export const decodeToken = (
  token: string,
  secret: string
): string | jwt.JwtPayload | Error | TokenExpiredError => {
  try {
    const decoded = jwt.verify(token, secret);
    return decoded;
  } catch (err) {
    console.error(err);
    if (err instanceof TokenExpiredError) {
      return err as TokenExpiredError;
    } else if (err instanceof JsonWebTokenError) {
      return err as JsonWebTokenError;
    } else {
      return err as Error;
    }
  }
};
