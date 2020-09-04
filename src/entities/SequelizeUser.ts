import { User } from './User';
import { FeedbackError } from '../FeedbackError';
import { isValidPassword } from '../util/validation';

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
      if (!isValidPassword(password)) {
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
}
