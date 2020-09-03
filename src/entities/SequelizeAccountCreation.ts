import { AccountCreation } from './AccountCreation';
import { SequelizeUser } from './SequelizeUser';

/**
 * AccountCreation implementation for a sequelize data source.
 */
export class SequelizeAccountCreation implements AccountCreation {
    private _database;
    private _accountCreationSequelizeInstance;

    private constructor (database, creation) {
      this._database = database;
      this._accountCreationSequelizeInstance = creation;
    }

    public getUsername (): string {
      return this._accountCreationSequelizeInstance.username;
    }

    public getEmail (): string {
      return this._accountCreationSequelizeInstance.email;
    }

    public getPasswordHash (): string {
      return this._accountCreationSequelizeInstance.password;
    }

    public getToken (): string {
      return this._accountCreationSequelizeInstance.token;
    }

    public async createAccount (): Promise<SequelizeUser> {
      const user = await SequelizeUser.create(this._database,
        this.getUsername(),
        this.getEmail(),
        this.getPasswordHash());

      await this._accountCreationSequelizeInstance.destroy();

      return user;
    }

    /**
     * Finds an account creation with the given token in the database.
     * @param database the database instance to query.
     * @param token the token of the account creation to find.
     */
    public static async getAccountCreationByToken (database, token: string): Promise<SequelizeAccountCreation> {
      const creation = database.AccountCreation.findOne({ where: { token } });
      return creation ? new SequelizeAccountCreation(database, creation) : null;
    }
}
