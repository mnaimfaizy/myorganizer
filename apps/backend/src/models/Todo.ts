export interface Todo {
  id: number;
  todo: string;
  createdAt?: Date;
}

export interface TodoRequestBody {
  todo: string;
}
