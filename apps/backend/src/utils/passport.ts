import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import passport from 'passport';
import jwtStrat, { ExtractJwt } from 'passport-jwt';
import localStrat from 'passport-local';
import { User } from '../models/User';
import { PrismaClient } from '../prisma';
dotenv.config();

const LocalStrategy = localStrat.Strategy;
const JwtStrategy = jwtStrat.Strategy;

const db = new PrismaClient();

passport.use(
  new LocalStrategy(
    {
      usernameField: 'username',
      passwordField: 'password',
    },
    function verify(username, password, done) {
      db.user
        .findFirstOrThrow({ where: { email: username } })
        .then((user: User) => {
          if (!user) {
            return done(null, false, {
              message: 'Incorrect username or password!',
            });
          }
          bcrypt.compare(password, user.password, (err, result) => {
            if (err) {
              return done(err);
            }
            if (!result) {
              return done(null, false, {
                message: 'Incorrect username or password!',
              });
            }
            return done(null, user);
          });
        })
        .catch((err) => {
          console.log(err);
          return done(err, false);
        });
    }
  )
);

passport.use(
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.ACCESS_JWT_SECRET,
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
    }
  )
);

export default passport;
