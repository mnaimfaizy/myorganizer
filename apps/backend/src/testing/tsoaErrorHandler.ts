import type { Application } from 'express';
import { createTsoaErrorHandler } from '../helpers/httpErrorHandler';

/**
 * Last-resort TSOA/Express error mapper used by HTTP integration tests that
 * call RegisterRoutes without booting main.ts. Same handler production uses.
 */
export function attachTsoaErrorHandler(app: Application): void {
  app.use(createTsoaErrorHandler());
}
