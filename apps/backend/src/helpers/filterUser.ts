import { FilteredUserInterface, UserInterface } from '../types';

export default (user: UserInterface): FilteredUserInterface => {
  const { id, name, email } = user;
  const firstName = (user.first_name ?? '').trim();
  const lastName = (user.last_name ?? '').trim();
  const phone = user.phone ?? undefined;
  return { id, name, email, firstName, lastName, phone };
};
