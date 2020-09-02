import { Database } from "./Database";
import { User } from "./User";
import { SequelizeUser } from "./SequelizeUser";

export class SequelizeDatabase implements Database {
    private _database;

    /**
     * Constructs a new sequelize database interface.
     * @param database the database connector.
     */
    public constructor(database) {
        this._database = database;
    }

    public async getUser(username: string): Promise<SequelizeUser> {
        return await SequelizeUser.getUserByUsername(this._database, username);
    }
}