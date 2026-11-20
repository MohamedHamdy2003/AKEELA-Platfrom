import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { Environment } from '../../config/environment';
import { AuthActor } from '../../common/http/current-actor.decorator';
import { ApiError } from '../../common/http/api-error';
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
@Injectable()
export class ImagesService {
  private readonly rates = new Map<string, { until: number; count: number }>();
  constructor(
    private readonly db: DataSource,
    private readonly config: ConfigService<Environment, true>,
    private readonly users: UsersService,
    private readonly customers: CustomersService,
    private readonly restaurants: RestaurantsService,
    private readonly catalog: CatalogService,
  ) {}
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
    const now = Date.now();
    for (const [key, rate] of this.rates)
      if (rate.until <= now) this.rates.delete(key);
    const rate = this.rates.get(actor.userId);
    if ((rate?.count ?? 0) >= 10 || (!rate && this.rates.size >= 10000))
      throw new ApiError(
        429,
        'RATE_LIMITED',
        'Too many image uploads. Try again in a minute.',
      );
    this.rates.set(actor.userId, {
      until: rate?.until ?? now + 60000,
      count: (rate?.count ?? 0) + 1,
    });
    let encoded: Buffer;
    try {
      const decoder = sharp(buffer, {
        limitInputPixels: 16_777_216,
        failOn: 'warning',
      });
      const meta = await decoder.metadata();
      if (
        !['jpeg', 'png', 'webp'].includes(meta.format ?? '') ||
        (meta.pages ?? 1) > 1
      )
        throw new Error();
      const maxDim = TARGET_MAX_DIMENSION[target];
      encoded = await decoder
        .rotate()
        .resize({
          width: maxDim,
          height: maxDim,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 82, effort: 6, smartSubsample: true })
        .toBuffer();
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
    await mkdir(path, { recursive: true });
    await writeFile(destination, encoded, { flag: 'wx', mode: 0o644 });
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
