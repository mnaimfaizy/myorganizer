// Function parameter Decorator Factory

import express from 'express';
import { ZodSchema } from 'zod';
import { BaseError } from '../helpers/BaseError';

// Overrides tsoa Body Decorator
export function Body() {
  return function (
    target: object,
    propertyKey: string | symbol,
    parameterIndex: number,
  ) {
    const existingMetadata =
      Reflect.getOwnMetadata('Body', target, propertyKey) || [];
    existingMetadata.push(parameterIndex);
    Reflect.defineMetadata('Body', existingMetadata, target, propertyKey);
  };
}

// Function Decorator Factory
export function ValidateBody(validationSchema: ZodSchema) {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // Retrieve the list of indices of the parameters that are decorated
      // in order to retrieve the body
      const bodyCandidates: number[] =
        Reflect.getOwnMetadata('Body', target, propertyKey) || [];
      if (bodyCandidates.length === 0) {
        const result = BaseError.createInvalidArgumentError({
          message: 'missing body parameter',
          value: { parameter: 'missing_parameter' },
        } as unknown as Record<string, { message: string; value: string }>);
        express.response.status(422);
        return result;
      }
      const bodyIndex = bodyCandidates[0] as number;
      // we've found the body in the list of parameters
      // now we check if its payload is valid against the passed Zod schema
      const check = await validationSchema.safeParseAsync(args[bodyIndex]);
      if (!check.success) {
        const errorDetails = check.error.issues.reduce(
          (acc, err) => {
            acc[err.path.join('.')] = {
              message: err.message,
              value: err.code,
            };
            return acc;
          },
          {} as Record<string, { message: string; value: string }>,
        );
        const validationErrors =
          BaseError.createInvalidArgumentError(errorDetails);
        express.response.status(422);
        return validationErrors;
      }
      // the payload checkout!
      // Call the original method with the arguments
      return originalMethod.apply(this, args);
    };
  };
}
