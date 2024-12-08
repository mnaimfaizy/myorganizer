class ApiTokens {
  public generatePasswordResetToken(userId: string): string {
    return Buffer.from(userId).toString('base64');
  }

  public generateEmailVerificationToken(userId: string): string {
    return Buffer.from(userId).toString('base64');
  }

  public verifyToken(token: string): string {
    return Buffer.from(token, 'base64').toString('ascii');
  }
}

const apiTokens = new ApiTokens();
export default apiTokens;
