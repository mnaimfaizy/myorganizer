import { NextFunction, Router } from 'express';
import authController from '../controllers/AuthController';
import userController from '../controllers/UserController';
import apiTokens from '../helpers/ApiTokens';
import { getExpiry } from '../helpers/cookieHelper';
import isOwner from '../middleware/isOwner';
import { FilteredUserInterface, UserInterface } from '../types';
import passport from '../utils/passport';

const router = Router();

router.post(
  '/login',
  passport.authenticate('local', { session: false, failureMessage: false }),
  async (req, res, next: NextFunction) => {
    try {
      const requestUser = req.user as UserInterface;
      const { token, refreshToken } = apiTokens.createTokens(requestUser);

      const expiry = getExpiry();

      const user: FilteredUserInterface = {
        id: requestUser.id,
        name: requestUser.name,
        email: requestUser.email,
      };

      res
        .cookie('refresh_cookie', refreshToken, {
          expires: expiry,
          httpOnly: true,
          // sameSite: "None",
          // secure: true,
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

router.post('/register', async (req, res) => {
  try {
    const user = await userController.createUser(req.body);
    res.status(201).json(user);
  } catch (error) {
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

export default router;
