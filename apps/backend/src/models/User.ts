export interface User {
  id: string;
  name?: string;
  email: string;
}

export interface UserCreationBody {
  name?: string;
  email: string;
}
