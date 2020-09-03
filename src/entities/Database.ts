import { User } from './User';
import { AccountCreation } from './AccountCreation';

/**
 * The database interface is used to access objects from the database.
 */
export interface Database {
    /**
     * Finds a user with a given user name.
     * @param username the unique name of the user to find.
     * @returns the user or null if it doesn't exist.
     */
    getUser(username: string): Promise<User>;

    /**
     * Creates a user with the given properties.
     * @param username the unique sluggish name of the user to create.
     * @param email the email address of the user to create.
     * @param passwordHash the bcrypt-hashed password of the user to create.
     * @returns the created user.
     */
    createUser(username: string, email: string, passwordHash: string): Promise<User>;

    /**
     * Finds an account creation with a given token.
     * @param token the token of the account creation to find.
     * @returns the account creation or null if it doesn't exist.
     */
    getAccountCreationByToken(token: string): Promise<AccountCreation>;
}
