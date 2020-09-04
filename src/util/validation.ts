/**
 * Contains all slugs that are forbidden
 */
const FORBIDDEN_SLUGS = ['add', '..', '.'];

/**
 * Checks whether the object is a string.
 * @param object the object to check.
 * @returns true if the object is a string.
 */
export function isString (object: string): boolean {
  return object && typeof object === 'string';
}

/**
 * Checks whether a string is empty.
 * @param string the string to check.
 * @param minLength the least length the string should have.
 * @param maxLength the highest length the string should have.
 * @returns true if the length of the string is between the minimum and the maximum length.
 */
export function isStringLengthInRange (string: string, minLength: number, maxLength: number): boolean {
  return string.length >= minLength && string.length <= maxLength;
}

/**
 * Checks whether a given slug is forbidden.
 * @param string the slug to check.
 * @returns true if the slug is forbidden and false if it's allowed.
 */
export function isForbiddenSlug (string: string): boolean {
  return FORBIDDEN_SLUGS.includes(string);
}

/**
 * Checks if a string is a valid URL slug. Slugs may only contain lowercase
 * letters, numbers, dashed, dots and underscores. They must have a length of
 * one to 64 characters and must not be forbidden.
 * @param string the string to check.
 * @returns true if the given string is a valid slug.
 */
export function isSlug (string: string): boolean {
  return this.isString(string) &&
    this.isStringLengthInRange(string, 1, 64) &&
    /^[a-z0-9\-_.]+$/.test(string) &&
    !this.isForbiddenSlug(string);
}

/**
 * Checks if a string is a valid URL.
 * @param string the string to check.
 */
export function isUrl (string: string): boolean {
  return isString(string) &&
    /(http[s]?:\/\/)?[^\s(["<,>]*\.[^\s[",><]*/.test(string);
}

/**
 * Checks whether the given password fulfills all validity criteria.
 * @param password the password to check.
 * @returns true if the given password is valid.
 */
export function isValidPassword (password: string): boolean {
  return password && typeof password === 'string' &&
    password.length >= 8 &&
    containsDigit(password) &&
    containsLowerCaseLetter(password) &&
    containsUpperCaseLetter(password);
}

/**
 * Checks whether the given string contains at least one digit.
 * @param string the string to check.
 * @returns true if the given string contains at least one digit and false
 * otherwise.
 */
export function containsDigit (string: string): boolean {
  return /\d/.test(string);
}

/**
 * Checks whether the given string contains at least one lower-case
 * letter.
 * @param string the string to check.
 * @returns true if the given string contains at least one lower-case letter
 * and false otherwise.
 */
export function containsLowerCaseLetter (string: string): boolean {
  return /[a-z]/.test(string);
}

/**
 * Checks whether the given string contains at least one upper-case letter.
 * @param string the string to check.
 * @returns true if the given string contains at least one upper-case letter
 * and false otherwise.
 */
export function containsUpperCaseLetter (string: string): boolean {
  return /[A-Z]/.test(string);
}
