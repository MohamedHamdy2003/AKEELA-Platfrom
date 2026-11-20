import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readdir, stat, unlink } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { Environment } from '../../config/environment';
import { CustomersService } from '../customers/customers.service';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { CatalogService } from '../catalog/catalog.service';

const FIRST_RUN_DELAY_MS = 10 * 60 * 1000;
const RUN_INTERVAL_MS = 24 * 60 * 60 * 1000;
const ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;
const MANAGED_IMAGE_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/i;

@Injectable()
export class ImagesCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ImagesCleanupService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly config: ConfigService<Environment, true>,
    private readonly customers: CustomersService,
    private readonly restaurants: RestaurantsService,
    private readonly catalog: CatalogService,
  ) {}

  onModuleInit(): void {
    if (this.config.get('NODE_ENV', { infer: true }) === 'test') return;
    this.timer = setTimeout(() => {
      void this.cleanupOrphans();
      this.timer = setInterval(() => {
        void this.cleanupOrphans();
      }, RUN_INTERVAL_MS);
      this.timer.unref?.();
    }, FIRST_RUN_DELAY_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      clearInterval(this.timer);
    }
  }

  private extractManagedFilename(url: string): string | null {
    const marker = '/images/';
    const index = url.lastIndexOf(marker);
    if (index === -1) return null;
    const candidate = basename(url.slice(index + marker.length).split('?')[0]!);
    return MANAGED_IMAGE_PATTERN.test(candidate) ? candidate : null;
  }

  async cleanupOrphans(maxAgeMs = ORPHAN_GRACE_MS): Promise<number> {
    const dir = this.config.get('IMAGE_STORAGE_PATH', { infer: true });
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 0;
      this.logger.error(
        `Image cleanup directory read failed: ${String(error)}`,
      );
      return 0;
    }

    const cutoff = Date.now() - maxAgeMs;
    const candidates: string[] = [];
    for (const entry of entries) {
      if (!MANAGED_IMAGE_PATTERN.test(entry)) continue;
      try {
        const info = await stat(join(dir, entry));
        if (info.isFile() && info.mtimeMs <= cutoff) {
          candidates.push(entry);
        }
      } catch {
        // Ignore files removed concurrently.
      }
    }
    if (!candidates.length) return 0;

    try {
      const [avatars, restaurantImages, catalogImages] = await Promise.all([
        this.customers.referencedAvatarUrls(),
        this.restaurants.referencedImageUrls(),
        this.catalog.referencedImageUrls(),
      ]);
      const referenced = new Set<string>();
      for (const url of [...avatars, ...restaurantImages, ...catalogImages]) {
        const name = this.extractManagedFilename(url);
        if (name) referenced.add(name);
      }

      let removed = 0;
      for (const file of candidates) {
        if (referenced.has(file)) continue;
        try {
          await unlink(join(dir, file));
          removed += 1;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            this.logger.warn(
              `Failed to delete orphan image ${file}: ${String(error)}`,
            );
          }
        }
      }
      if (removed > 0) {
        this.logger.log(`Removed ${removed} unreferenced image file(s).`);
      }
      return removed;
    } catch (error) {
      this.logger.error(`Image cleanup failed: ${String(error)}`);
      return 0;
    }
  }
}
