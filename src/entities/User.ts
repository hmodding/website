/**
 * A user is an account registered on the site.
 */
export interface User {
    /**
     * @returns the unique number identifier of this user.
     */
    getId(): number;

    /**
     * @returns the unique sluggish user name of this user.
     */
    getUsername(): string;

    /**
     * @returns the email address attached to this user. Note that users with
     * third-party authorization don't necessarily have an email address
     * attached.
     */
    getEmail(): string | null;

    /**
     * Checks whether a password is correct.
     * @param password the password to check.
     */
    checkPassword(password: string): boolean;

    /**
     * Checks whether this user has administrator privileges.
     */
    isAdministrator(): boolean;

    /**
     * Sets a new password. The password must be a valid password, otherwise the
     * promise is rejected.
     * @param password the new password.
     */
    setPassword(password: string): Promise<void>;

    /**
     * Checks whether this user and another one are the same. Users are
     * considered 'the same' when their ids match.
     * @param other the user to compare this user to.
     * @returns true if this user is equal to the other one and false otherwise.
     */
    equals(other: User): boolean;
}
