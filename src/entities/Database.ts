import { User } from "./User";

export interface Database {
    getUser(username: string): Promise<User>;
}