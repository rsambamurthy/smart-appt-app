import prisma from '../../config/database';
import { NotFoundError, UnprocessableError } from '../../utils/errors';
import { generateApiKeySecret, apiKeyPrefix, hashApiKeySecret } from '../../utils/api-key';
import { CreateApiKeyBody } from './integrations.schema';

class IntegrationsService {
  async list(associationId: string) {
    const keys = await prisma.integrationApiKey.findMany({
      where: { association_id: associationId },
      select: {
        id: true, name: true, key_prefix: true, scopes: true,
        is_active: true, last_used_at: true, created_at: true, revoked_at: true,
        creator: { select: { name: true } },
        revoker: { select: { name: true } },
      },
      orderBy: { created_at: 'desc' },
    });
    return { data: keys };
  }

  /** Returns the plaintext secret exactly once — it is never recoverable after this. */
  async create(associationId: string, body: CreateApiKeyBody, createdBy: string) {
    const secret = generateApiKeySecret();
    const key = await prisma.integrationApiKey.create({
      data: {
        association_id: associationId,
        name: body.name,
        key_prefix: apiKeyPrefix(secret),
        key_hash: hashApiKeySecret(secret),
        scopes: body.scopes,
        created_by_id: createdBy,
      },
      select: { id: true, name: true, key_prefix: true, scopes: true, created_at: true },
    });
    return { data: { ...key, secret } };
  }

  async revoke(associationId: string, keyId: string, revokedBy: string) {
    const key = await prisma.integrationApiKey.findFirst({ where: { id: keyId, association_id: associationId } });
    if (!key) throw new NotFoundError('Integration API Key');
    if (!key.is_active || key.revoked_at) throw new UnprocessableError('This key is already revoked.');

    await prisma.integrationApiKey.update({
      where: { id: keyId },
      data: { is_active: false, revoked_at: new Date(), revoked_by_id: revokedBy },
    });
    return { data: { message: 'Key revoked. Any tool using it will be rejected immediately.' } };
  }
}

export const integrationsService = new IntegrationsService();
