import bcrypt from 'bcrypt';
import { User, UserCreationBody } from '../models/User';
import { PrismaClient } from '../prisma';

class UserService {
  Users: User[] = [];
  SaltRounds = 10;

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

  async getByEmail(email: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });
    return user;
  }

  async create(user: UserCreationBody): Promise<User> {
    const hashedPassword = await bcrypt.hash(user.password, this.SaltRounds);
    const newUser = await this.prisma.user.create({
      data: {
        name: user.name,
        email: user.email,
        password: hashedPassword,
      },
    });
    return newUser;
  }
}

const userService = new UserService(new PrismaClient());
export default userService;
