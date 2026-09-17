import type { Application, ErrorRequestHandler } from 'express';
import { ValidateError } from 'tsoa';

/**
 * Last-resort TSOA/Express error mapper used by HTTP integration tests that
 * call RegisterRoutes without booting main.ts. Keep this in one place so the
 * two auth suites cannot drift apart on 422 / status / 500 mapping.
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

    const anyErr = err as {
      status?: number;
      statusCode?: number;
      message?: string;
    };
    const httpStatus = anyErr?.status ?? anyErr?.statusCode;
    if (
      anyErr &&
      typeof anyErr === 'object' &&
      typeof httpStatus === 'number'
    ) {
      res.status(httpStatus).json({ message: anyErr.message });
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
