// Function parameter Decorator Factory

import { ValidateError } from 'tsoa';
import { ZodError, ZodSchema } from 'zod';

export type ZodIssueDetails = Record<
  string,
  { message: string; value: string }
>;

export function zodIssuesToDetails(error: ZodError): ZodIssueDetails {
  return error.issues.reduce((acc, err) => {
    acc[err.path.join('.')] = {
      message: err.message,
      value: err.code,
    };
    return acc;
  }, {} as ZodIssueDetails);
}

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
        throw new ValidateError(
          {
            missing_parameter: {
              message: 'missing body parameter',
              value: 'missing_parameter',
            },
          },
          'Validation Failed',
        );
      }
      const bodyIndex = bodyCandidates[0] as number;
      // we've found the body in the list of parameters
      // now we check if its payload is valid against the passed Zod schema
      const check = await validationSchema.safeParseAsync(args[bodyIndex]);
      if (!check.success) {
        throw new ValidateError(
          zodIssuesToDetails(check.error),
          'Validation Failed',
        );
      }
      // the payload checkout!
      // Call the original method with the arguments
      return originalMethod.apply(this, args);
    };
  };
}
