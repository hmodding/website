import { User } from "./User";

/**
 * User implementation for a sequelize data source.
 */
export class SequelizeUser implements User {
    private _sequelizeObject;

    private constructor(sequelizeObject) {
        this._sequelizeObject = sequelizeObject;
    }

    public getId(): number {
        return this._sequelizeObject.id;
    }

    public getUsername(): string {
        return this._sequelizeObject.username;
    }

    public getEmail(): string | null {
        return this._sequelizeObject.email;
    }

    public checkPassword(password: string): boolean {
        return this._sequelizeObject.validPassword(password);
    }

    public async setPassword(password: string): Promise<void> {
        if (!SequelizeUser.isValidPassword(password)) {
            throw 'invalid password';
        } else {
            await this._sequelizeObject.update();
            return;
        }
    }

    /**
     * Finds a user with the given username in the database
     * @param database the database instance to query.
     * @param username the name of the user to find.
     * @returns the found user or null if no user with this name could be found.
     */
    public static async getUserByUsername(database: any, username: string): Promise<SequelizeUser | null> {
        return database.User.findOne({where: {username}})
            .then(user => {
                if (user) {
                    return new SequelizeUser(user);
                } else {
                    return null;
                }
            });
    }

    /**
     * Checks whether the given password fulfills all validity criteria.
     * @param password the password to check.
     */
    private static isValidPassword(password: string): boolean {
        return password && typeof password === 'string'
            && password.length >= 8
            && this.containsDigit(password)
            && this.containsLowerCaseLetter(password)
            && this.containsUpperCaseLetter(password);
    }

    /**
     * Checks whether the given password contains at least one digit.
     * @param password the password to check.
     */
    private static containsDigit(password: string): boolean {
        return /\d/.test(password);
    }

    /**
     * Checks whether the given password contains at least one lower-case
     * letter.
     * @param password the password to check.
     */
    private static containsLowerCaseLetter(password: string): boolean {
        return /[a-z]/.test(password);
    }

    /**
     * Checks whether the given password contains at least one upper-case
     * letter.
     * @param password the password to check.
     */
    private static containsUpperCaseLetter(password: string): boolean {
        return /[A-Z]/.test(password);
    }

}