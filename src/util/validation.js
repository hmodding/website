'use strict';
module.exports = {
  /**
   * Contains all slugs that are forbidden
   */
  FORBIDDEN_SLUGS: ['add', '..', '.'],
  /**
   * Checks whether something is a string.
   * @param {*} string something that should be a string.
   */
  isString: function(string) {
    return string && typeof string === 'string';
  },

  /**
   * Checks whether a string is empty.
   * @param {string} string the string to check.
   */
  isStringLengthInRange: function(string, minLength, maxLength) {
    return string.length >= minLength && string.length <= maxLength;
  },

  /**
   * Checks whether a given slug is forbidden.
   * @param {string} string the slug to check.
   */
  isForbiddenSlug: function(string) {
    return this.FORBIDDEN_SLUGS.includes(string);
  },

  /**
   * Checks if a string is a valid URL slug. Slugs may only contain lowercase
   * letters, numbers, dashed, dots and underscores. They must have a length of
   * one to 64 characters and must not be forbidden.
   * @param {string} string
   */
  isSlug: function(string) {
    return this.isString(string) &&
        this.isStringLengthInRange(string, 1, 64) &&
        /^[a-z0-9\-\_\.]+$/.test(string) &&
        !this.isForbiddenSlug(string);
  },

  /**
   * Checks if a string is a valid URL.
   */
  isUrl: function(string) {
    return string &&
      typeof string === 'string' &&
      /(http[s]?:\/\/)?[^\s(["<,>]*\.[^\s[",><]*/.test(string);
  },
};
