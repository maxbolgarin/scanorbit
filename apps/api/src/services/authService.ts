import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { jwt } from '../lib/jwt.js';
import { HTTP400Error, HTTP401Error } from '../lib/errors.js';
import { users, orgs, userOrgMembers } from '../db/schema.js';
import type { User, Org } from '../db/schema.js';

const SALT_ROUNDS = 10;

interface SignupResult {
  user: Pick<User, 'id' | 'email' | 'fullName'>;
  org: Pick<Org, 'id' | 'name' | 'slug'>;
  token: string;
}

interface LoginResult {
  user: Pick<User, 'id' | 'email' | 'fullName'>;
  orgs: Pick<Org, 'id' | 'name' | 'slug'>[];
  token: string;
}

export const authService = {
  async signup(
    email: string,
    password: string,
    fullName: string
  ): Promise<SignupResult> {
    // Check if user already exists
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (existing.length > 0) {
      throw new HTTP400Error('Email already registered');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user
    const [user] = await db
      .insert(users)
      .values({
        email: email.toLowerCase(),
        passwordHash,
        fullName,
      })
      .returning({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
      });

    // Create org (auto-generated from email domain)
    const domain = email.split('@')[1];
    const slug = domain.replace(/\./g, '-') + '-' + Date.now().toString(36);

    const [org] = await db
      .insert(orgs)
      .values({
        name: domain,
        slug,
      })
      .returning({
        id: orgs.id,
        name: orgs.name,
        slug: orgs.slug,
      });

    // Add user to org as admin
    await db.insert(userOrgMembers).values({
      userId: user.id,
      orgId: org.id,
      role: 'admin',
    });

    // Sign JWT
    const token = await jwt.sign({
      userId: user.id,
      orgId: org.id,
    });

    return { user, org, token };
  },

  async login(email: string, password: string): Promise<LoginResult> {
    // Get user by email
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (!user) {
      throw new HTTP401Error('Invalid credentials');
    }

    // Verify password
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      throw new HTTP401Error('Invalid credentials');
    }

    // Get user's orgs
    const userOrgs = await db
      .select({
        id: orgs.id,
        name: orgs.name,
        slug: orgs.slug,
      })
      .from(orgs)
      .innerJoin(userOrgMembers, eq(orgs.id, userOrgMembers.orgId))
      .where(eq(userOrgMembers.userId, user.id));

    // Sign JWT with first org as default
    const token = await jwt.sign({
      userId: user.id,
      orgId: userOrgs[0]?.id ?? null,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
      },
      orgs: userOrgs,
      token,
    };
  },

  async getMe(userId: string) {
    // Get user
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new HTTP401Error('User not found');
    }

    // Get user's orgs with role
    const userOrgs = await db
      .select({
        id: orgs.id,
        name: orgs.name,
        slug: orgs.slug,
        logoUrl: orgs.logoUrl,
        role: userOrgMembers.role,
      })
      .from(orgs)
      .innerJoin(userOrgMembers, eq(orgs.id, userOrgMembers.orgId))
      .where(eq(userOrgMembers.userId, user.id));

    return { user, orgs: userOrgs };
  },

  async switchOrg(userId: string, orgId: string): Promise<string> {
    // Verify user has access to org
    const [membership] = await db
      .select({ id: userOrgMembers.id })
      .from(userOrgMembers)
      .where(eq(userOrgMembers.userId, userId))
      .limit(1);

    if (!membership) {
      throw new HTTP401Error('You do not have access to this organization');
    }

    // Sign new JWT with selected org
    return jwt.sign({ userId, orgId });
  },
};
