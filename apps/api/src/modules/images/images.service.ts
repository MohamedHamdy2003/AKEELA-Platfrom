import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { Environment } from '../../config/environment';
import { Semaphore } from '../../common/concurrency';
import { AuthActor } from '../../common/http/current-actor.decorator';
import { ApiError } from '../../common/http/api-error';
import { FixedWindowRateLimiter } from '../../common/http/fixed-window-rate-limiter';
import { UsersService } from '../users/users.service';
import { CustomersService } from '../customers/customers.service';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { CatalogService } from '../catalog/catalog.service';
export type ImageTarget = 'avatar' | 'restaurant' | 'product' | 'offer';
const TARGET_MAX_DIMENSION: Record<ImageTarget, number> = {
  avatar: 512,
  product: 1280,
  offer: 1280,
  restaurant: 1600,
};
const MAX_TRACKED_UPLOAD_KEYS = 10_000;
sharp.cache(false);
sharp.concurrency(1);
const sharpConcurrency = new Semaphore(2);

@Injectable()
export class ImagesService implements OnModuleInit {
  private readonly limiter = new FixedWindowRateLimiter(
    MAX_TRACKED_UPLOAD_KEYS,
  );
  private storageReady = false;

  constructor(
    private readonly db: DataSource,
    private readonly config: ConfigService<Environment, true>,
    private readonly users: UsersService,
    private readonly customers: CustomersService,
    private readonly restaurants: RestaurantsService,
    private readonly catalog: CatalogService,
  ) {}

  async onModuleInit(): Promise<void> {
    const path = this.config.get('IMAGE_STORAGE_PATH', { infer: true });
    await mkdir(path, { recursive: true }).catch(() => undefined);
    this.storageReady = true;
  }

  async upload(
    actor: AuthActor,
    target: ImageTarget,
    buffer: Buffer | undefined,
    id?: string,
  ) {
    if (actor.role !== (target === 'avatar' ? 'Customer' : 'Restaurant'))
      throw new ApiError(403, 'FORBIDDEN', 'You cannot upload this image.');
    if (!buffer?.length)
      throw new ApiError(422, 'VALIDATION_ERROR', 'Choose an image file.');
    if (buffer.length > 5 * 1024 * 1024)
      throw new ApiError(
        413,
        'IMAGE_TOO_LARGE',
        'Image must be 5MB or smaller.',
      );
    const rateResult = this.limiter.consume(actor.userId, 10, 60_000);
    if (!rateResult.allowed)
      throw new ApiError(
        429,
        'RATE_LIMITED',
        'Too many image uploads. Try again in a minute.',
      );
    // Fast read-only pre-check avoids CPU/RAM decode and disk I/O for unauthorized or missing targets.
    const account = await this.users.byId(actor.userId);
    if (
      !account?.is_active ||
      !account.email_verified_at ||
      account.role !== actor.role
    )
      throw new ApiError(
        403,
        'FORBIDDEN',
        'An active verified account is required.',
      );
    if (target === 'restaurant') {
      await this.restaurants.assertImageWritable(actor.userId);
    } else if (target === 'product' || target === 'offer') {
      await this.catalog.assertImageTarget(actor.userId, target, id!);
    }
    let encoded: Buffer;
    try {
      encoded = await sharpConcurrency.run(async () => {
        const decoder = sharp(buffer, {
          limitInputPixels: 16_777_216,
          failOn: 'error',
        });
        const meta = await decoder.metadata();
        if (
          !['jpeg', 'png', 'webp'].includes(meta.format ?? '') ||
          (meta.pages ?? 1) > 1
        )
          throw new Error();
        const maxDim = TARGET_MAX_DIMENSION[target];
        return decoder
          .rotate()
          .resize({
            width: maxDim,
            height: maxDim,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .webp({ quality: 82, effort: 4, smartSubsample: true })
          .toBuffer();
      });
    } catch {
      throw new ApiError(
        422,
        'INVALID_IMAGE',
        'Use a valid, non-animated JPEG, PNG or WebP image up to 16 megapixels.',
      );
    }
    const path = this.config.get('IMAGE_STORAGE_PATH', { infer: true });
    const filename = `${randomUUID()}.webp`;
    const url = `${this.config.get('PUBLIC_BASE_URL', { infer: true })}/images/${filename}`;
    const destination = join(path, filename);
    if (!this.storageReady) {
      await mkdir(path, { recursive: true });
      this.storageReady = true;
    }
    try {
      await writeFile(destination, encoded, { flag: 'wx', mode: 0o644 });
    } catch (error) {
      if ((error as { code?: string }).code === 'ENOENT') {
        await mkdir(path, { recursive: true });
        await writeFile(destination, encoded, { flag: 'wx', mode: 0o644 });
      } else {
        throw error;
      }
    }
    try {
      await this.db.transaction(async (manager) => {
        const user = await this.users.byId(actor.userId, manager, true);
        if (
          !user?.is_active ||
          !user.email_verified_at ||
          user.role !== actor.role
        )
          throw new ApiError(
            403,
            'FORBIDDEN',
            'An active verified account is required.',
          );
        if (target === 'avatar')
          await this.customers.setAvatar(actor.userId, url, manager);
        else if (target === 'restaurant')
          await this.restaurants.setImage(actor.userId, url, manager);
        else
          await this.catalog.setImage(actor.userId, target, id!, url, manager);
      });
    } catch (error) {
      await unlink(destination).catch(() => undefined);
      throw error;
    }
    return { image_url: url };
  }
}
