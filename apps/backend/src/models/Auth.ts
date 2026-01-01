import { FilteredUserInterface } from '../types';

export interface RegisterUserResponse {
  message: string;
  user?: FilteredUserInterface;
}
