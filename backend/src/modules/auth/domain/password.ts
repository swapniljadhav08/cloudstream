import bcrypt from 'bcryptjs';
import { loadConfig } from '../../../config';

// bcryptjs rather than the native bcrypt binding: same algorithm and cost
// factor, no compile toolchain needed in the container image.

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, loadConfig().BCRYPT_COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
