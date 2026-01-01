import { NextFunction, Router } from 'express';
import authController from '../controllers/AuthController';
import userController from '../controllers/UserController';
import apiTokens from '../helpers/ApiTokens';
import { getExpiry } from '../helpers/cookieHelper';
import filterUser from '../helpers/filterUser';
import isOwner from '../middleware/isOwner';
import { LoginSchema, refreshTokenSchema } from '../schemas/auth.schema';
import { UserSchema } from '../schemas/user.schema';
import { FilteredUserInterface, UserInterface } from '../types';
import passport from '../utils/passport';
import userService from '../services/UserService';

const router = Router();

router.post(
  '/login',
  (req, res, next) => {
    try {
      LoginSchema.parse(req.body);
      next();
    } catch (err) {
      res.status(422).json({ message: 'Validation Failed' });
    }
  },
  passport.authenticate('local', { session: false, failureMessage: false }),
  async (req, res, next: NextFunction) => {
    try {
      const requestUser = req.user as UserInterface;
      const { token, refreshToken } = apiTokens.createTokens(requestUser);

      if (token instanceof Error || refreshToken instanceof Error) {
        res.status(500).json({ message: 'Failed to create auth tokens' });
        return;
      }

      const expiry = getExpiry();

      const user: FilteredUserInterface = filterUser(requestUser);

      res
        .cookie('refresh_cookie', refreshToken, {
          expires: expiry,
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
        })
        .status(200)
        .json({
          token: token,
          expires_in: 600_000,
          user: user,
        });
    } catch (err) {
      console.log('Error: ', err);
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
      return err;
    }
  }
);

router.post(
  '/logout/:userId',
  passport.authenticate('jwt', { session: false }),
  isOwner,
  async (req, res, next: NextFunction) => {
    try {
      const user = req.user as UserInterface;
      const refreshToken = req.cookies?.refresh_cookie as string | undefined;

      if (!user || !refreshToken) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const result = await userService.logout(user.id, refreshToken);
      if (result instanceof Error) {
        res.status(500).json({ message: 'Failed to logout' });
        return;
      }

      res.clearCookie('refresh_cookie');

      req.logout(function (err) {
        if (err) {
          console.log('Error: ', err);
          res.status(500).json({ message: 'Failed to logout' });
          return next(err);
        }
        res.status(200).json({ message: 'Logged out successfully' });
      });
    } catch (err) {
      next(err);
    }
  }
);

router.post('/register', async (req, res) => {
  try {
    UserSchema.parse(req.body);
    const user = await userController.createUser(req.body);
    res.status(201).json(user);
  } catch (error) {
    if (error?.name === 'ZodError') {
      res.status(422).json({ message: 'Validation Failed' });
      return;
    }
    res
      .status(500)
      .json({ message: `Failed to create user: ${error.message}` });
  }
});

router.patch('/verify/email', async (req, res) => {
  authController
    .verifyEmail(req.body)
    .then((user) => {
      if (!user) {
        res.status(400).json({ message: 'Failed to verify email' });
      } else {
        res.status(200).json({ message: 'Email verified successfully' });
      }
    })
    .catch((error) => {
      res
        .status(500)
        .json({ message: `Failed to verify email: ${error.message}` });
    });
});

router.post(
  '/verify/resend/:userId',
  passport.authenticate('jwt', { session: false }),
  isOwner,
  async (req, res) => {
    try {
      const user = req.user;

      if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
      } else {
        res
          .status(200)
          .json({ message: 'Verification email sent successfully' });
      }
    } catch (error) {
      res.status(500).json({
        message: `Failed to resend verification email: ${error.message}`,
      });
    }
  }
);

router.post('/password/reset', async (req, res) => {
  const result = await authController.resetPassword(req.body);
  res.status(result.status).json({ message: result.message });
});

router.post('/password/reset/confirm', async (req, res) => {
  const result = await authController.confirmResetPassword(req.body);
  res.status(result.status).json({ message: result.message });
});

router.post('/refresh', async (req, res, next: NextFunction) => {
  try {
    const requestBody = req.body ?? {};
    refreshTokenSchema.parse(requestBody);

    const refreshTokenFromBody = (requestBody as any)?.refresh_token as
      | string
      | undefined;
    const refreshTokenFromCookie = req.cookies?.refresh_cookie as
      | string
      | undefined;

    const refreshToken = refreshTokenFromBody ?? refreshTokenFromCookie;
    if (!refreshToken) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const user = await userService.refreshToken(refreshToken);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    if (user.blacklisted_tokens?.includes(refreshToken)) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { token, refreshToken: newRefreshToken } = apiTokens.createTokens(
      user as unknown as UserInterface
    );

    if (token instanceof Error || newRefreshToken instanceof Error) {
      res.status(500).json({ message: 'Failed to create auth tokens' });
      return;
    }

    const filteredUser: FilteredUserInterface = filterUser(
      user as unknown as UserInterface
    );

    const expiry = getExpiry();

    res
      .cookie('refresh_cookie', newRefreshToken, {
        expires: expiry,
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      })
      .status(200)
      .json({
        token,
        expires_in: 600_000,
        user: filteredUser,
      });
  } catch (error) {
    if (error?.name === 'ZodError') {
      res.status(422).json({ message: 'Validation Failed' });
      return;
    }
    res
      .status(500)
      .json({ message: `Failed to refresh token. Error: ${error}` });
    next(error);
  }
});

export default router;
