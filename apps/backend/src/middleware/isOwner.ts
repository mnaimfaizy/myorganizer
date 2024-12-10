import { NextFunction } from 'express';
import { MyError } from '../types';

export default async (req: any, res: any, next: NextFunction) => {
  try {
    if (req.params.userId !== req.user.id) {
      const error = new MyError('Forbidden', 403);

      throw error;
    }
    next();
  } catch (err: any) {
    next(err);
    return err;
  }
};
