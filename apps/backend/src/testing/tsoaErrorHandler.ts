import type { Application, ErrorRequestHandler } from 'express';
import { ValidateError } from 'tsoa';
import {
  getHttpErrorMessage,
  getHttpErrorStatus,
} from '../helpers/httpErrorStatus';

/**
 * Last-resort TSOA/Express error mapper used by HTTP integration tests that
 * call RegisterRoutes without booting main.ts. Status mapping is the same
 * helper production uses in main.ts so 400–599 bounds cannot drift.
 */
export function attachTsoaErrorHandler(app: Application): void {
  const tsoaErrorHandler: ErrorRequestHandler = (err, _req, res, next) => {
    if (err instanceof ValidateError) {
      res.status(422).json({
        message: 'Validation Failed',
        details: err?.fields,
      });
      return;
    }

    const httpStatus = getHttpErrorStatus(err);
    if (httpStatus) {
      const message = getHttpErrorMessage(err);
      res.status(httpStatus).json({ message });
      return;
    }

    if (err instanceof Error) {
      res.status(500).json({ message: 'Internal Server Error' });
      return;
    }

    next(err);
  };

  app.use(tsoaErrorHandler);
}
