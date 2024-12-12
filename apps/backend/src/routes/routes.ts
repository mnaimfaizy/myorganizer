/* tslint:disable */
/* eslint-disable */
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import type { TsoaRoute } from '@tsoa/runtime';
import { fetchMiddlewares, ExpressTemplateService } from '@tsoa/runtime';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { UserController } from './../controllers/UserController';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { TodoController } from './../controllers/TodoController';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { AuthController } from './../controllers/AuthController';
import { expressAuthentication } from './../middleware/authentication';
// @ts-ignore - no great way to install types from subpackage
import type {
  Request as ExRequest,
  Response as ExResponse,
  RequestHandler,
  Router,
} from 'express';

const expressAuthenticationRecasted = expressAuthentication as (
  req: ExRequest,
  securityName: string,
  scopes?: string[],
  res?: ExResponse
) => Promise<any>;

// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

const models: TsoaRoute.Models = {
  User: {
    dataType: 'refObject',
    properties: {
      id: { dataType: 'string', required: true },
      name: { dataType: 'string' },
      email: { dataType: 'string', required: true },
      password: { dataType: 'string' },
      reset_password_token: { dataType: 'string' },
      email_verification_timestamp: { dataType: 'datetime' },
      blacklisted_tokens: { dataType: 'array', array: { dataType: 'string' } },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  ValidateErrorJSON: {
    dataType: 'refObject',
    properties: {
      message: {
        dataType: 'enum',
        enums: ['Validation failed'],
        required: true,
      },
      details: {
        dataType: 'nestedObjectLiteral',
        nestedProperties: {},
        additionalProperties: { dataType: 'any' },
        required: true,
      },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  UserCreationBody: {
    dataType: 'refObject',
    properties: {
      name: { dataType: 'string' },
      email: { dataType: 'string', required: true },
      password: { dataType: 'string', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  Todo: {
    dataType: 'refObject',
    properties: {
      id: { dataType: 'double', required: true },
      todo: { dataType: 'string', required: true },
      createdAt: { dataType: 'datetime' },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  TodoRequestBody: {
    dataType: 'refObject',
    properties: {
      todo: { dataType: 'string', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  UserLoginBody: {
    dataType: 'refObject',
    properties: {
      email: { dataType: 'string', required: true },
      password: { dataType: 'string', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  FilteredUserInterface: {
    dataType: 'refObject',
    properties: {
      id: { dataType: 'string', required: true },
      name: { dataType: 'string', required: true },
      email: { dataType: 'string', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  ConfirmResetPasswordBody: {
    dataType: 'refObject',
    properties: {
      token: { dataType: 'string', required: true },
      password: { dataType: 'string', required: true },
      confirm_password: { dataType: 'string', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
};
const templateService = new ExpressTemplateService(models, {
  noImplicitAdditionalProperties: 'throw-on-extras',
  bodyCoercion: true,
});

// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

export function RegisterRoutes(app: Router) {
  // ###########################################################################################################
  //  NOTE: If you do not see routes for all of your controllers in this file, then you might not have informed tsoa of where to look
  //      Please look into the "controllerPathGlobs" config option described in the readme: https://github.com/lukeautry/tsoa
  // ###########################################################################################################

  app.get(
    '/user',
    authenticateMiddleware([{ jwt: [] }]),
    ...fetchMiddlewares<RequestHandler>(UserController),
    ...fetchMiddlewares<RequestHandler>(UserController.prototype.getAllUsers),

    async function UserController_getAllUsers(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      const args: Record<string, TsoaRoute.ParameterSchema> = {};

      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args,
          request,
          response,
        });

        const controller = new UserController();

        await templateService.apiHandler({
          methodName: 'getAllUsers',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: undefined,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  app.get(
    '/user/:userId',
    ...fetchMiddlewares<RequestHandler>(UserController),
    ...fetchMiddlewares<RequestHandler>(UserController.prototype.getUserById),

    async function UserController_getUserById(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      const args: Record<string, TsoaRoute.ParameterSchema> = {
        userId: {
          in: 'path',
          name: 'userId',
          required: true,
          dataType: 'string',
        },
      };

      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args,
          request,
          response,
        });

        const controller = new UserController();

        await templateService.apiHandler({
          methodName: 'getUserById',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: undefined,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  app.post(
    '/user',
    ...fetchMiddlewares<RequestHandler>(UserController),
    ...fetchMiddlewares<RequestHandler>(UserController.prototype.createUser),

    async function UserController_createUser(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      const args: Record<string, TsoaRoute.ParameterSchema> = {
        requestBody: {
          in: 'body',
          name: 'requestBody',
          required: true,
          ref: 'UserCreationBody',
        },
      };

      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args,
          request,
          response,
        });

        const controller = new UserController();

        await templateService.apiHandler({
          methodName: 'createUser',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: undefined,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  app.get(
    '/todo',
    ...fetchMiddlewares<RequestHandler>(TodoController),
    ...fetchMiddlewares<RequestHandler>(TodoController.prototype.getAllTodos),

    async function TodoController_getAllTodos(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      const args: Record<string, TsoaRoute.ParameterSchema> = {};

      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args,
          request,
          response,
        });

        const controller = new TodoController();

        await templateService.apiHandler({
          methodName: 'getAllTodos',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: undefined,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  app.post(
    '/todo',
    ...fetchMiddlewares<RequestHandler>(TodoController),
    ...fetchMiddlewares<RequestHandler>(TodoController.prototype.createTodo),

    async function TodoController_createTodo(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      const args: Record<string, TsoaRoute.ParameterSchema> = {
        requestBody: {
          in: 'body',
          name: 'requestBody',
          required: true,
          ref: 'TodoRequestBody',
        },
      };

      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args,
          request,
          response,
        });

        const controller = new TodoController();

        await templateService.apiHandler({
          methodName: 'createTodo',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: undefined,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  app.delete(
    '/todo/:todoId',
    ...fetchMiddlewares<RequestHandler>(TodoController),
    ...fetchMiddlewares<RequestHandler>(TodoController.prototype.deleteTodo),

    async function TodoController_deleteTodo(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      const args: Record<string, TsoaRoute.ParameterSchema> = {
        todoId: {
          in: 'path',
          name: 'todoId',
          required: true,
          dataType: 'double',
        },
      };

      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args,
          request,
          response,
        });

        const controller = new TodoController();

        await templateService.apiHandler({
          methodName: 'deleteTodo',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: undefined,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  app.post(
    '/auth/login',
    ...fetchMiddlewares<RequestHandler>(AuthController),
    ...fetchMiddlewares<RequestHandler>(AuthController.prototype.login),

    async function AuthController_login(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      const args: Record<string, TsoaRoute.ParameterSchema> = {
        requestBody: {
          in: 'body',
          name: 'requestBody',
          required: true,
          ref: 'UserLoginBody',
        },
      };

      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args,
          request,
          response,
        });

        const controller = new AuthController();

        await templateService.apiHandler({
          methodName: 'login',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: undefined,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  app.post(
    '/auth/logout/:userId',
    authenticateMiddleware([{ jwt: [] }]),
    ...fetchMiddlewares<RequestHandler>(AuthController),
    ...fetchMiddlewares<RequestHandler>(AuthController.prototype.logout),

    async function AuthController_logout(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      const args: Record<string, TsoaRoute.ParameterSchema> = {
        req: { in: 'request', name: 'req', required: true, dataType: 'object' },
        userId: {
          in: 'path',
          name: 'userId',
          required: true,
          dataType: 'string',
        },
      };

      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args,
          request,
          response,
        });

        const controller = new AuthController();

        await templateService.apiHandler({
          methodName: 'logout',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: 200,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  app.post(
    '/auth/refresh',
    ...fetchMiddlewares<RequestHandler>(AuthController),
    ...fetchMiddlewares<RequestHandler>(AuthController.prototype.refreshToken),

    async function AuthController_refreshToken(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      const args: Record<string, TsoaRoute.ParameterSchema> = {
        requestBody: {
          in: 'body',
          name: 'requestBody',
          required: true,
          dataType: 'nestedObjectLiteral',
          nestedProperties: {
            refresh_token: { dataType: 'string', required: true },
          },
        },
      };

      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args,
          request,
          response,
        });

        const controller = new AuthController();

        await templateService.apiHandler({
          methodName: 'refreshToken',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: undefined,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  app.post(
    '/auth/register',
    ...fetchMiddlewares<RequestHandler>(AuthController),
    ...fetchMiddlewares<RequestHandler>(AuthController.prototype.createUser),

    async function AuthController_createUser(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      const args: Record<string, TsoaRoute.ParameterSchema> = {
        requestBody: {
          in: 'body',
          name: 'requestBody',
          required: true,
          ref: 'UserCreationBody',
        },
      };

      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args,
          request,
          response,
        });

        const controller = new AuthController();

        await templateService.apiHandler({
          methodName: 'createUser',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: undefined,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  app.patch(
    '/auth/verify/email',
    ...fetchMiddlewares<RequestHandler>(AuthController),
    ...fetchMiddlewares<RequestHandler>(AuthController.prototype.verifyEmail),

    async function AuthController_verifyEmail(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      const args: Record<string, TsoaRoute.ParameterSchema> = {
        requestBody: {
          in: 'body',
          name: 'requestBody',
          required: true,
          dataType: 'nestedObjectLiteral',
          nestedProperties: { token: { dataType: 'string', required: true } },
        },
      };

      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args,
          request,
          response,
        });

        const controller = new AuthController();

        await templateService.apiHandler({
          methodName: 'verifyEmail',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: undefined,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  app.post(
    '/auth/verify/resend/:userId',
    authenticateMiddleware([{ jwt: [] }]),
    ...fetchMiddlewares<RequestHandler>(AuthController),
    ...fetchMiddlewares<RequestHandler>(
      AuthController.prototype.resendVerificationEmail
    ),

    async function AuthController_resendVerificationEmail(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      const args: Record<string, TsoaRoute.ParameterSchema> = {
        userId: {
          in: 'path',
          name: 'userId',
          required: true,
          dataType: 'string',
        },
      };

      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args,
          request,
          response,
        });

        const controller = new AuthController();

        await templateService.apiHandler({
          methodName: 'resendVerificationEmail',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: undefined,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  app.post(
    '/auth/password/reset',
    ...fetchMiddlewares<RequestHandler>(AuthController),
    ...fetchMiddlewares<RequestHandler>(AuthController.prototype.resetPassword),

    async function AuthController_resetPassword(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      const args: Record<string, TsoaRoute.ParameterSchema> = {
        requestBody: {
          in: 'body',
          name: 'requestBody',
          required: true,
          dataType: 'nestedObjectLiteral',
          nestedProperties: { email: { dataType: 'string', required: true } },
        },
      };

      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args,
          request,
          response,
        });

        const controller = new AuthController();

        await templateService.apiHandler({
          methodName: 'resetPassword',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: undefined,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  app.patch(
    '/auth/password/reset/confirm',
    ...fetchMiddlewares<RequestHandler>(AuthController),
    ...fetchMiddlewares<RequestHandler>(
      AuthController.prototype.confirmResetPassword
    ),

    async function AuthController_confirmResetPassword(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      const args: Record<string, TsoaRoute.ParameterSchema> = {
        requestBody: {
          in: 'body',
          name: 'requestBody',
          required: true,
          ref: 'ConfirmResetPasswordBody',
        },
      };

      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args,
          request,
          response,
        });

        const controller = new AuthController();

        await templateService.apiHandler({
          methodName: 'confirmResetPassword',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: undefined,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

  function authenticateMiddleware(security: TsoaRoute.Security[] = []) {
    return async function runAuthenticationMiddleware(
      request: any,
      response: any,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      // keep track of failed auth attempts so we can hand back the most
      // recent one.  This behavior was previously existing so preserving it
      // here
      const failedAttempts: any[] = [];
      const pushAndRethrow = (error: any) => {
        failedAttempts.push(error);
        throw error;
      };

      const secMethodOrPromises: Promise<any>[] = [];
      for (const secMethod of security) {
        if (Object.keys(secMethod).length > 1) {
          const secMethodAndPromises: Promise<any>[] = [];

          for (const name in secMethod) {
            secMethodAndPromises.push(
              expressAuthenticationRecasted(
                request,
                name,
                secMethod[name],
                response
              ).catch(pushAndRethrow)
            );
          }

          // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

          secMethodOrPromises.push(
            Promise.all(secMethodAndPromises).then((users) => {
              return users[0];
            })
          );
        } else {
          for (const name in secMethod) {
            secMethodOrPromises.push(
              expressAuthenticationRecasted(
                request,
                name,
                secMethod[name],
                response
              ).catch(pushAndRethrow)
            );
          }
        }
      }

      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      try {
        request['user'] = await Promise.any(secMethodOrPromises);

        // Response was sent in middleware, abort
        if (response.writableEnded) {
          return;
        }

        next();
      } catch (err) {
        // Show most recent error as response
        const error = failedAttempts.pop();
        error.status = error.status || 401;

        // Response was sent in middleware, abort
        if (response.writableEnded) {
          return;
        }
        next(error);
      }

      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    };
  }

  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
}

// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
