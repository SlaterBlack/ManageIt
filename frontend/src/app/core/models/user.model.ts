export interface User {
  id: string;
  name: string;
  email: string;
}

export type UserName = Pick<User, 'id' | 'name'>;

export interface AuthResponse {
  token: string;
  user: User;
}
