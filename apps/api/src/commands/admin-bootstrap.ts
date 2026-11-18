import { DataSource } from 'typeorm';
import { randomBytes, scrypt } from 'node:crypto';
import { isEmail } from 'class-validator';

export class AdminSetupError extends Error {}

function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(16).toString('hex');
    scrypt(
      password,
      salt,
      64,
      { N: 65536, r: 8, p: 2, maxmem: 128 * 1024 * 1024 },
      (error, key) => {
        if (error) return reject(error);
        resolve(`scrypt$65536$8$2$${salt}$${key.toString('hex')}`);
      },
    );
  });
}

// Serialize first-run provisioning. Never reset an existing administrator from
// environment values, including when a later release supplies different values.
export async function ensureAdmin(
  db: DataSource,
  input: Record<string, string | undefined>,
): Promise<'created' | 'existing'> {
  return db.transaction(async (manager) => {
    await manager.query('SELECT pg_advisory_xact_lock(1794520000)');
    const existing = await manager
      .createQueryBuilder()
      .select('u.user_id')
      .from('users', 'u')
      .where("u.role = 'Admin'")
      .getRawOne();
    if (existing) return 'existing';

    const email = (input.ADMIN_EMAIL ?? '').trim().toLowerCase();
    const password = input.ADMIN_PASSWORD ?? '';
    const fullName = (input.ADMIN_FULL_NAME ?? '').trim();
    const phone = (input.ADMIN_PHONE ?? '').trim();
    if (!isEmail(email) || email.length > 254)
      throw new AdminSetupError('Set a valid ADMIN_EMAIL for first-run setup.');
    if (fullName.length < 1 || fullName.length > 150)
      throw new AdminSetupError('ADMIN_FULL_NAME must be 1-150 characters.');
    if (
      password.length < 8 ||
      password.length > 128 ||
      !/(?=.*\p{L})(?=.*\p{Nd})/su.test(password)
    )
      throw new AdminSetupError(
        'ADMIN_PASSWORD must be 8-128 characters with a letter and a digit.',
      );
    if (!/^\+[1-9]\d{7,14}$/.test(phone))
      throw new AdminSetupError(
        'ADMIN_PHONE must start with + and country code (8-15 digits).',
      );
    const used = await manager
      .createQueryBuilder()
      .select('u.user_id')
      .from('users', 'u')
      .where('u.email = :email OR u.phone_number = :phone', { email, phone })
      .getRawOne();
    if (used)
      throw new AdminSetupError(
        'The Admin email or phone is already used by another account.',
      );
    const result = await manager
      .createQueryBuilder()
      .insert()
      .into('users')
      .values({
        full_name: fullName,
        email,
        phone_number: phone,
        password_hash: await hashPassword(password),
        role: 'Admin',
        is_active: true,
        email_verified_at: input.ADMIN_VERIFIED === 'false' ? null : new Date(),
      })
      .returning('user_id')
      .execute();
    await manager
      .createQueryBuilder()
      .insert()
      .into('admin_profiles')
      .values({ user_id: result.raw[0].user_id })
      .execute();
    return 'created';
  });
}
