import { PrismaClient } from '@backend/prisma-schema';
import { User, UserCreationBody } from '../models/User';

class UserService {
  Users: User[] = [];

  constructor(private prisma: PrismaClient) {}

  async getAll(): Promise<User[]> {
    this.Users = await this.prisma.user.findMany();
    return this.Users;
  }

  async getById(id: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: {
        id,
      },
    });
    return user;
  }

  async create(user: UserCreationBody): Promise<User> {
    const newUser = await this.prisma.user.create({
      data: {
        name: user.name,
        email: user.email,
      },
    });
    return newUser;
  }
}

const userService = new UserService(new PrismaClient());
export default userService;
