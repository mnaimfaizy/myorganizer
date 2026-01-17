import bcrypt from 'bcrypt';
import passport from 'passport';
import jwtStrat, { ExtractJwt } from 'passport-jwt';
import localStrat from 'passport-local';
import { User } from '../models/User';
import { createPrismaClient } from '../prisma';

const LocalStrategy = localStrat.Strategy;
const JwtStrategy = jwtStrat.Strategy;

function getAccessJwtSecret(): string {
  const configured = process.env.ACCESS_JWT_SECRET;
  if (configured && configured.trim().length > 0) return configured;

  // In CI/unit tests we don't require real secrets; provide a deterministic default.
  // This avoids passport-jwt throwing at module import time.
  if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
    return 'test-access-jwt-secret';
  }

  throw new Error(
    'ACCESS_JWT_SECRET is required to initialize JWT auth. ' +
      'Set ACCESS_JWT_SECRET (and other JWT secrets) in the environment.',
  );
}

const db = createPrismaClient();

passport.use(
  new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password',
    },
    function verify(username, password, done) {
      db.user
        .findFirst({ where: { email: username } })
        .then((user: User | null) => {
          if (!user) {
            return done(null, false, {
              message: 'Incorrect email or password!',
            });
          }
          bcrypt.compare(password, user.password, (err, result) => {
            if (err) {
              return done(err);
            }
            if (!result) {
              return done(null, false, {
                message: 'Incorrect email or password!',
              });
            }
            return done(null, user);
          });
        })
        .catch((err) => {
          console.log(err);
          return done(err, false);
        });
    },
  ),
);

passport.use(
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: getAccessJwtSecret(),
    },
    function (jwt_payload, done) {
      db.user
        .findFirst({
          where: { id: jwt_payload.userId },
        })
        .then((user: User) => {
          // if (user) {
          //   return done(null, user)
          // } else {
          //   return done(null, false)
          // }
          return done(null, user || false);
        })
        .catch((err: Error) => {
          return done(err, false);
        });
    },
  ),
);

export default passport;
