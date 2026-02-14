/**
 * @file src/utils/errortypes.ts
 * @summary Error type utilities for handling unknown error objects
 * @description Provides utilities for safely handling unknown error objects that may or may
 * not have standard Error properties. Includes type guards and conversion
 * functions for robust error handling across the application.
 *
 * @remarks
 * Provides utilities for safely handling unknown error objects that may or may
 * not have standard Error properties. Includes type guards and conversion
 * functions for robust error handling across the application.
 */

/**
 * Interface used for handling unknown objects that *might* be an error.
 *
 * @remarks
 * Extends the standard Error interface to ensure the message property is
 * always present and is a string type for consistent error handling.
 *
 * @property {string} message - Error message string.
 */
interface ErrorWithMessage extends Error {
  /** Error message string. */
  message: string;
}

/**
 * Converts an unknown object to an error with a message property.
 *
 * @param {unknown} maybeError - The object that may be an error and may or may not have an error message.
 * @returns {ErrorWithMessage} An error with an error message property and value.
 *
 * @example
 * ```typescript
 * const error = toErrorWithMessage("Something went wrong");
 * console.log(error.message); // "Something went wrong"
 *
 * const objError = toErrorWithMessage({ code: 500, details: "Server error" });
 * console.log(error.message); // '{"code":500,"details":"Server error"}'
 * ```
 *
 * @remarks
 * Takes an object that might be an error and if it doesn't have a message property,
 * creates a new error with a message property based on the given object. If the
 * object is already an ErrorWithMessage, returns it as-is. Otherwise, attempts
 * to JSON stringify the object, falling back to String() conversion if JSON
 * serialization fails.
 */
export const toErrorWithMessage = (maybeError: unknown): ErrorWithMessage => {
  if (isErrorWithMessage(maybeError)) return maybeError;
  try {
    return new Error(JSON.stringify(maybeError));
  } catch {
    return new Error(String(maybeError));
  }
};

/**
 * Type guard function that checks if an unknown object is an ErrorWithMessage.
 *
 * @param {unknown} error - An error object to check.
 * @returns {error is ErrorWithMessage} True if the object is an ErrorWithMessage.
 *
 * @example
 * ```typescript
 * const unknownValue: unknown = new Error("Test error");
 * if (isErrorWithMessage(unknownValue)) {
 *   console.log(unknownValue.message); // TypeScript knows this is string
 * }
 * ```
 *
 * @remarks
 * Takes an error of unknown type and uses type predicate to narrow the type
 * of the error if it is indeed an ErrorWithMessage. Checks that the object
 * is not null, has a message property, and that the message property is a string.
 */
const isErrorWithMessage = (error: unknown): error is ErrorWithMessage => {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as Record<string, unknown>)["message"] === "string"
  );
};
