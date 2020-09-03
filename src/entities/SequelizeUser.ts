import { User } from './User';
import { FeedbackError } from '../FeedbackError';

/**
 * User implementation for a sequelize data source.
 */
export class SequelizeUser implements User {
    private _database;
    private _userSequelizeInstance;
    private _privilegesSequelizeInstance;

    private constructor (database, user, privileges) {
      this._database = database;
      this._userSequelizeInstance = user;
      this._privilegesSequelizeInstance = privileges;
    }

    public getId (): number {
      return this._userSequelizeInstance.id;
    }

    public getUsername (): string {
      return this._userSequelizeInstance.username;
    }

    public getEmail (): string | null {
      return this._userSequelizeInstance.email;
    }

    public checkPassword (password: string): boolean {
      return this._userSequelizeInstance.validPassword(password);
    }

    public async setPassword (password: string): Promise<void> {
      if (!SequelizeUser.isValidPassword(password)) {
        throw new FeedbackError('invalid password');
      } else {
        await this._userSequelizeInstance.update();
      }
    }

    public isAdministrator (): boolean {
      return this._privilegesSequelizeInstance &&
            this._privilegesSequelizeInstance.role === 'admin';
    }

    public equals (other: User): boolean {
      return this.getId() === other.getId();
    }

    /**
     * Finds a user with the given username in the database
     * @param database the database instance to query.
     * @param username the name of the user to find.
     * @returns the found user or null if no user with this name could be found.
     */
    public static async getUserByUsername (database: any, username: string): Promise<SequelizeUser | null> {
      const sqUser = await database.User.findOne({
        where: { username }
      });
      if (!sqUser) {
        return null;
      }

      const sqPrivileges = await database.UserPrivilege.findOne({
        where: { username }
      });
      return new SequelizeUser(database, sqUser, sqPrivileges);
    }

    /**
     * Creates a user in the database with the given properties.
     * @param database the database instance to use.
     * @param username the sluggish unique user name for the user.
     * @param email the email address for the user.
     * @param passwordHash the bcrypt-hashed password for the user.
     * @returns the newly created user.
     */
    public static async create (database, username: string, email: string, passwordHash: string): Promise<SequelizeUser> {
      const sqUser = await database.User.create({
        username,
        email,
        password: passwordHash
      });
      return new SequelizeUser(database, sqUser, null);
    }

    /**
     * Checks whether the given password fulfills all validity criteria.
     * @param password the password to check.
     */
    private static isValidPassword (password: string): boolean {
      return password && typeof password === 'string' &&
            password.length >= 8 &&
            this.containsDigit(password) &&
            this.containsLowerCaseLetter(password) &&
            this.containsUpperCaseLetter(password);
    }

    /**
     * Checks whether the given password contains at least one digit.
     * @param password the password to check.
     */
    private static containsDigit (password: string): boolean {
      return /\d/.test(password);
    }

    /**
     * Checks whether the given password contains at least one lower-case
     * letter.
     * @param password the password to check.
     */
    private static containsLowerCaseLetter (password: string): boolean {
      return /[a-z]/.test(password);
    }

    /**
     * Checks whether the given password contains at least one upper-case
     * letter.
     * @param password the password to check.
     */
    private static containsUpperCaseLetter (password: string): boolean {
      return /[A-Z]/.test(password);
    }
}
