import jwt, { TokenExpiredError } from 'jsonwebtoken';

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
    console.log(err);
    if (err instanceof TokenExpiredError) {
      return err as TokenExpiredError;
    } else {
      return err as Error;
    }
  }
};
