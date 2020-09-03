import { User } from './User';

/**
 * An account creation contains the data of a user that is in the process of
 * creating an account and has not confirmed his email address yet.
 */
export interface AccountCreation {
    /**
     * @returns the unique sluggish user name of the user to be created.
     */
    getUsername(): string;

    /**
     * @returns the email address of the account to be created;
     */
    getEmail(): string;

    /**
     * @returns the bcrypt-hashed password of the account to be created.
     */
    getPasswordHash(): string;

    /**
     * @returns the confirmation token sent to the user.
     */
    getToken(): string;

    /**
     * Creates the account from this creation and destroys this creation.
     */
    createAccount(): Promise<User>;
}
