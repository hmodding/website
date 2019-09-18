'use strict';
module.exports = {
  /**
   * Checks if a string is a valid URL slug. Slugs may only contain lowercase
   * letters, numbers, dashed, dots and underscores. They must have a length of
   * one to 64 characters.
   * @param {string} string
   */
  isSlug: string => {
    return string &&
        typeof string === 'string' &&
        string.length > 0 &&
        string.length <= 64 &&
        /^[a-z0-9\-\_\.]+$/.test(string);
  },

  /**
   * Checks if a string is a valid URL.
   */
  isUrl: string => {
    return string &&
      typeof string === 'string' &&
      /(http[s]?:\/\/)?[^\s(["<,>]*\.[^\s[",><]*/.test(string);
  },
};
