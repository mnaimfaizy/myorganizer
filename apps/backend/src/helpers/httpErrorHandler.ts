import type { ErrorRequestHandler, Request } from 'express';
import { ValidateError } from 'tsoa';
import { getHttpErrorMessage, getHttpErrorStatus } from './httpErrorStatus';

export type TsoaErrorHandlerHooks = {
  onValidateError?: (err: ValidateError, req: Request) => void;
  onUnhandledError?: (err: Error, req: Request) => void;
};

/**
 * ValidateError → 422, integer HTTP status → that status, Error → 500.
 * Callers add logging via hooks; tests attach the handler with none.
 */
export function createTsoaErrorHandler(
  hooks: TsoaErrorHandlerHooks = {},
): ErrorRequestHandler {
  return (err, req, res, next) => {
    if (err instanceof ValidateError) {
      hooks.onValidateError?.(err, req);
      res.status(422).json({
        message: 'Validation Failed',
        details: err?.fields,
      });
      return;
    }

    const httpStatus = getHttpErrorStatus(err);
    if (httpStatus) {
      res.status(httpStatus).json({
        message: getHttpErrorMessage(err),
      });
      return;
    }

    if (err instanceof Error) {
      hooks.onUnhandledError?.(err, req);
      res.status(500).json({
        message: 'Internal Server Error',
      });
      return;
    }

    next();
  };
}
