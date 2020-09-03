import { Database } from './Database';
import { SequelizeUser } from './SequelizeUser';
import { AccountCreation } from './AccountCreation';
import { SequelizeAccountCreation } from './SequelizeAccountCreation';

/**
 * Database interface implementation for a sequelize data source.
 */
export class SequelizeDatabase implements Database {
    private _database;

    /**
     * Constructs a new sequelize database interface.
     * @param database the database connector.
     */
    public constructor (database) {
      this._database = database;
    }

    public async getUser (username: string): Promise<SequelizeUser> {
      return await SequelizeUser.getUserByUsername(this._database, username);
    }

    public async createUser (username: string, email: string, passwordHash: string): Promise<SequelizeUser> {
      return await SequelizeUser.create(this, username, email, passwordHash);
    }

    public async getAccountCreationByToken (token: string): Promise<AccountCreation> {
      return await SequelizeAccountCreation
        .getAccountCreationByToken(this._database, token);
    }
}
