import { FilteredUserInterface, UserInterface } from '../types';

export default (user: UserInterface): FilteredUserInterface => {
  const { id, name, email } = user;
  return { id, name, email };
};
