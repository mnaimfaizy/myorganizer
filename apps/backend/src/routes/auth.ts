import { NextFunction, Router } from 'express';
import authController from '../controllers/AuthController';
import apiTokens from '../helpers/ApiTokens';
import { getExpiry } from '../helpers/cookieHelper';
import filterUser from '../helpers/filterUser';
import isOwner from '../middleware/isOwner';
import { LoginSchema, refreshTokenSchema } from '../schemas/auth.schema';
import { UserSchema } from '../schemas/user.schema';
import userService from '../services/UserService';
import { FilteredUserInterface, UserInterface } from '../types';
import passport from '../utils/passport';

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
  (req, res, next: NextFunction) => {
    passport.authenticate(
      'local',
      { session: false, failureMessage: false },
      async (err: unknown, user: unknown, info?: { message?: string }) => {
        try {
          if (err) {
            next(err);
            return;
          }

          if (!user) {
            res.status(401).json({ message: info?.message ?? 'Unauthorized' });
            return;
          }

          const requestUser = user as UserInterface;
          const isVerified = Boolean(
            (requestUser as any)?.email_verification_timestamp
          );

          if (!isVerified) {
            res.status(403).json({
              message: 'Email not verified. Please verify your email first.',
            });
            return;
          }

          const { token, refreshToken } = apiTokens.createTokens(requestUser);

          if (token instanceof Error || refreshToken instanceof Error) {
            res.status(500).json({ message: 'Failed to create auth tokens' });
            return;
          }

          const expiry = getExpiry();

          const filteredUser: FilteredUserInterface = filterUser(requestUser);

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
              user: filteredUser,
            });
        } catch (caught) {
          next(caught);
        }
      }
    )(req, res, next);
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

    const email = (req.body as any)?.email as string | undefined;
    if (email) {
      const existing = await userService.getByEmail(email);
      if (existing) {
        const isVerified = Boolean(
          (existing as any)?.email_verification_timestamp
        );
        if (isVerified) {
          res
            .status(409)
            .json({ message: 'Email already registered. Please log in.' });
          return;
        }

        const token = await userService.sendVerificationMail(existing);
        if (token instanceof Error) {
          if (token.message.includes('already sent recently')) {
            res.status(429).json({
              message:
                'A verification email was already sent recently. Please check your inbox and try again later.',
              user: filterUser(existing as UserInterface),
            });
            return;
          }

          res.status(500).json({
            message: 'Failed to send verification email.',
          });
          return;
        }

        await userService.update(existing.id, {
          email_verification_token: token,
        });

        res.status(409).json({
          message:
            "Email already registered but isn't verified yet. We've resent the verification email.",
          user: filterUser(existing as UserInterface),
        });
        return;
      }
    }

    const created = await userService.create(req.body);
    const token = await userService.sendVerificationMail(created);
    if (token instanceof Error) {
      try {
        await userService.deleteById(created.id);
      } catch {
        // best-effort rollback
      }

      res.status(500).json({
        message:
          'Account was not created because we could not send a verification email. Please try again.',
      });
      return;
    }

    await userService.update(created.id, {
      email_verification_token: token,
    });

    res.status(201).json({
      message: 'Account created. Verification email sent.',
      user: filterUser(created as unknown as UserInterface),
    });
  } catch (error) {
    if (error?.name === 'ZodError') {
      res.status(422).json({ message: 'Validation Failed' });
      return;
    }

    const errorMessage = String((error as any)?.message ?? '');
    const isUniqueConstraint =
      (error as any)?.code === 'P2002' ||
      errorMessage.includes('Unique constraint failed');

    if (isUniqueConstraint) {
      const email = (req.body as any)?.email as string | undefined;
      if (email) {
        const existing = await userService.getByEmail(email);
        if (existing && !(existing as any)?.email_verification_timestamp) {
          const token = await userService.sendVerificationMail(existing);
          if (token instanceof Error) {
            if (token.message.includes('already sent recently')) {
              res.status(429).json({
                message:
                  'A verification email was already sent recently. Please check your inbox and try again later.',
                user: filterUser(existing as UserInterface),
              });
              return;
            }

            res.status(500).json({
              message: 'Failed to send verification email.',
            });
            return;
          }

          await userService.update(existing.id, {
            email_verification_token: token,
          });

          res.status(409).json({
            message:
              "Email already registered but isn't verified yet. We've resent the verification email.",
            user: filterUser(existing as UserInterface),
          });
          return;
        }
      }

      res
        .status(409)
        .json({ message: 'Email already registered. Please log in.' });
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
      const user = req.user as UserInterface;

      if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
      } else {
        const token = await userService.sendVerificationMail(user);

        if (token instanceof Error) {
          if (token.message.includes('already sent recently')) {
            res.status(429).json({
              message:
                'A verification email was already sent recently. Please check your inbox and try again later.',
            });
            return;
          }

          if (token.message.includes('already verified')) {
            res.status(409).json({
              message: 'Email already verified. Please log in.',
            });
            return;
          }

          res.status(500).json({
            message: 'Failed to resend verification email.',
          });
          return;
        }

        await userService.update(user.id, {
          email_verification_token: token,
        });

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

router.post('/verify/resend', async (req, res) => {
  const result = await authController.resendVerificationEmailByEmail(req.body);
  res.status(result.status).json({ message: result.message });
});

router.post('/password/reset', async (req, res) => {
  const result = await authController.resetPassword(req.body);
  res.status(result.status).json({ message: result.message });
});

router.patch('/password/reset/confirm', async (req, res) => {
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

    const isVerified = Boolean((user as any)?.email_verification_timestamp);
    if (!isVerified) {
      res.clearCookie('refresh_cookie');
      res.status(403).json({
        message: 'Email not verified. Please verify your email first.',
      });
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
