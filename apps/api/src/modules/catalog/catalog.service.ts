import { moneyCents, moneyAmount } from '../../common/money';
import { cairoDateString } from '../../common/time';
import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { ApiError } from '../../common/http/api-error';
import { RestaurantProfile } from '../restaurants/entities/restaurant-profile.entity';
import { RestaurantsService } from '../restaurants/restaurants.service';
import {
  CreateAddonDto,
  CreateCategoryDto,
  CreateOfferDto,
  CreateProductDto,
  SetProductAddonDto,
  UpdateAddonDto,
  UpdateCategoryDto,
  UpdateOfferDto,
  UpdateProductDto,
} from './catalog.dto';
import { Addon } from './entities/addon.entity';
import { Category } from './entities/category.entity';
import { Offer } from './entities/offer.entity';
import { ProductAddon } from './entities/product-addon.entity';
import { Product } from './entities/product.entity';

const cairoClockFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Cairo',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

@Injectable()
export class CatalogService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly restaurants: RestaurantsService,
  ) {}

  async assertImageTarget(
    userId: string,
    kind: 'product' | 'offer',
    id: string,
  ): Promise<void> {
    const profile = await this.restaurants.profile(userId);
    if (!profile) throw new ApiError(404, 'NOT_FOUND', 'Restaurant not found.');
    if (profile.activation_status !== 'Active')
      throw new ApiError(
        403,
        'RESTAURANT_NOT_ACTIVE',
        'Restaurant management is not active.',
      );
    if (kind === 'product') {
      const exists = await this.dataSource
        .getRepository(Product)
        .existsBy({ rest_id: profile.rest_id, prod_id: id });
      if (!exists) throw new ApiError(404, 'NOT_FOUND', 'Product not found.');
    } else {
      const exists = await this.dataSource
        .getRepository(Offer)
        .existsBy({ rest_id: profile.rest_id, offer_id: id });
      if (!exists) throw new ApiError(404, 'NOT_FOUND', 'Offer not found.');
    }
  }

  async setImage(
    userId: string,
    kind: 'product' | 'offer',
    id: string,
    url: string,
    manager: EntityManager,
  ): Promise<void> {
    const profile = await this.restaurants.profile(userId, manager);
    if (!profile) throw new ApiError(404, 'NOT_FOUND', 'Restaurant not found.');
    await this.restaurants.assertCatalogWritable(profile.rest_id, manager);
    if (kind === 'product') {
      const repo = manager.getRepository(Product);
      const item = await repo.findOneBy({
        rest_id: profile.rest_id,
        prod_id: id,
      });
      if (!item) throw new ApiError(404, 'NOT_FOUND', 'Product not found.');
      await repo.update({ prod_id: id }, { prod_image_url: url });
    } else {
      const repo = manager.getRepository(Offer);
      const item = await repo.findOneBy({
        rest_id: profile.rest_id,
        offer_id: id,
      });
      if (!item) throw new ApiError(404, 'NOT_FOUND', 'Offer not found.');
      await repo.update({ offer_id: id }, { offer_image_url: url });
    }
  }

  async referencedImageUrls(): Promise<string[]> {
    const [products, offers] = await Promise.all([
      this.dataSource
        .getRepository(Product)
        .createQueryBuilder('p')
        .select('p.prod_image_url', 'url')
        .where('p.prod_image_url IS NOT NULL')
        .getRawMany<{ url: string }>(),
      this.dataSource
        .getRepository(Offer)
        .createQueryBuilder('o')
        .select('o.offer_image_url', 'url')
        .where('o.offer_image_url IS NOT NULL')
        .getRawMany<{ url: string }>(),
    ]);
    return [...products, ...offers].map((row) => row.url);
  }
  async saleSelection(
    restId: string,
    prodId: string | null,
    offerId: string | null,
    addonIds: string[],
    manager: EntityManager,
  ) {
    const [result] = await this.saleSelections(
      restId,
      [{ prodId, offerId, addonIds }],
      manager,
    );
    return result!;
  }

  async saleSelections(
    restId: string,
    requests: Array<{
      prodId: string | null;
      offerId: string | null;
      addonIds: string[];
    }>,
    manager: EntityManager,
  ) {
    if (!requests.length) return [];
    const prodIds = [
      ...new Set(requests.map((r) => r.prodId).filter((v): v is string => !!v)),
    ];
    const offerIds = [
      ...new Set(
        requests.map((r) => r.offerId).filter((v): v is string => !!v),
      ),
    ];
    const allAddonIds = [...new Set(requests.flatMap((r) => r.addonIds))];

    const [products, offers, addonsList, linksList] = await Promise.all([
      prodIds.length
        ? manager
            .getRepository(Product)
            .findBy({ rest_id: restId, prod_id: In(prodIds) })
        : Promise.resolve([] as Product[]),
      offerIds.length
        ? manager
            .getRepository(Offer)
            .findBy({ rest_id: restId, offer_id: In(offerIds) })
        : Promise.resolve([] as Offer[]),
      allAddonIds.length
        ? manager
            .getRepository(Addon)
            .findBy({ rest_id: restId, addon_id: In(allAddonIds) })
        : Promise.resolve([] as Addon[]),
      prodIds.length && allAddonIds.length
        ? manager.getRepository(ProductAddon).findBy({
            rest_id: restId,
            prod_id: In(prodIds),
            addon_id: In(allAddonIds),
          })
        : Promise.resolve([] as ProductAddon[]),
    ]);

    const catIds = [
      ...new Set(products.map((p) => p.cat_id).filter((v): v is string => !!v)),
    ];
    const categories = catIds.length
      ? await manager
          .getRepository(Category)
          .findBy({ rest_id: restId, cat_id: In(catIds) })
      : [];

    const productMap = new Map(products.map((p) => [p.prod_id, p]));
    const offerMap = new Map(offers.map((o) => [o.offer_id, o]));
    const categoryMap = new Map(categories.map((c) => [c.cat_id, c]));
    const addonMap = new Map(addonsList.map((a) => [a.addon_id, a]));
    const linkMap = new Map(
      linksList.map((l) => [`${l.prod_id}:${l.addon_id}`, l]),
    );
    const now = Date.now();

    return requests.map(({ prodId, offerId, addonIds }) => {
      const product = prodId ? (productMap.get(prodId) ?? null) : null;
      const offer = offerId ? (offerMap.get(offerId) ?? null) : null;
      const category = product?.cat_id
        ? (categoryMap.get(product.cat_id) ?? null)
        : null;
      const item = product
        ? {
            name: product.prod_name,
            price: product.price,
            is_available: product.is_active && Boolean(category?.is_active),
          }
        : offer
          ? {
              name: offer.offer_title,
              price: offer.real_price,
              is_available:
                offer.is_active &&
                offer.starts_at.getTime() <= now &&
                offer.expires_at.getTime() > now,
            }
          : null;
      const addons = addonIds.map((addonId) => {
        const addon = addonMap.get(addonId);
        const link = prodId ? linkMap.get(`${prodId}:${addonId}`) : undefined;
        return {
          addon_id: addonId,
          name: addon?.addon_name ?? '',
          price: addon?.addon_price ?? '0.00',
          is_available: Boolean(addon?.is_active && link?.is_active),
        };
      });
      return { item, addons };
    });
  }

  async assertActiveRestaurant(userId: string): Promise<RestaurantProfile> {
    const profile = await this.restaurants.profile(userId);
    if (!profile || profile.activation_status !== 'Active') {
      throw new ApiError(
        403,
        'RESTAURANT_NOT_ACTIVE',
        'Restaurant management is not active.',
      );
    }
    return profile;
  }

  // --- Feature 05: Categories ---

  private async getCategoryProductCounts(
    restId: string,
    catIds: string[],
    manager: EntityManager = this.dataSource.manager,
  ): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (!catIds.length) return counts;
    const rows = await manager
      .getRepository(Product)
      .createQueryBuilder('p')
      .select('p.cat_id', 'cat_id')
      .addSelect('COUNT(*)::int', 'count')
      .where('p.rest_id = :restId AND p.cat_id IN (:...catIds)', {
        restId,
        catIds,
      })
      .groupBy('p.cat_id')
      .getRawMany<{ cat_id: string; count: number }>();
    for (const row of rows) {
      counts.set(row.cat_id.toString(), Number(row.count));
    }
    return counts;
  }

  private async getAddonLinkedProductIds(
    restId: string,
    addonIds: string[],
    manager: EntityManager = this.dataSource.manager,
  ): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>();
    if (!addonIds.length) return map;
    const links = await manager.getRepository(ProductAddon).find({
      select: { addon_id: true, prod_id: true },
      where: { rest_id: restId, addon_id: In(addonIds), is_active: true },
      order: { prod_id: 'ASC' },
    });
    for (const link of links) {
      const addonKey = link.addon_id.toString();
      const prodKey = link.prod_id.toString();
      const list = map.get(addonKey);
      if (list) list.push(prodKey);
      else map.set(addonKey, [prodKey]);
    }
    return map;
  }

  async listCategories(
    restId: string,
    pagination: { skip: number; take: number },
  ): Promise<{
    items: Category[];
    total: number;
    productCounts: Map<string, number>;
  }> {
    const qb = this.dataSource
      .getRepository(Category)
      .createQueryBuilder('c')
      .where('c.rest_id = :restId', { restId })
      .orderBy('c.display_order', 'ASC')
      .addOrderBy('c.cat_id', 'ASC')
      .skip(pagination.skip)
      .take(pagination.take);

    const [items, total] = await qb.getManyAndCount();
    const productCounts = await this.getCategoryProductCounts(
      restId,
      items.map((c) => c.cat_id),
    );
    return { items, total, productCounts };
  }

  async createCategory(
    restId: string,
    dto: CreateCategoryDto,
  ): Promise<Category> {
    return this.dataSource.transaction(async (manager) => {
      await this.restaurants.assertCatalogWritable(restId, manager);
      const repo = manager.getRepository(Category);
      const existing = await repo
        .createQueryBuilder('c')
        .where(
          'c.rest_id = :restId AND LOWER(TRIM(c.cat_title)) = LOWER(:title)',
          {
            restId,
            title: dto.cat_title.trim(),
          },
        )
        .getOne();

      if (existing) {
        throw new ApiError(
          409,
          'CONFLICT',
          'A category with this title already exists in your restaurant.',
        );
      }

      const maxRow = await repo
        .createQueryBuilder('c')
        .select('COALESCE(MAX(c.display_order), 0)', 'max_order')
        .where('c.rest_id = :restId', { restId })
        .getRawOne<{ max_order: string | number }>();
      const nextOrder = Number(maxRow?.max_order ?? 0) + 1;

      const category = repo.create({
        rest_id: restId,
        cat_title: dto.cat_title.trim(),
        display_order: nextOrder,
        is_active: dto.is_active ?? true,
      });

      return repo.save(category);
    });
  }

  async updateCategory(
    restId: string,
    catId: string,
    dto: UpdateCategoryDto,
  ): Promise<{ category: Category; productCount: number }> {
    return this.dataSource.transaction(async (manager) => {
      await this.restaurants.assertCatalogWritable(restId, manager);
      const repo = manager.getRepository(Category);
      const category = await repo
        .createQueryBuilder('c')
        .where('c.rest_id = :restId AND c.cat_id = :catId', { restId, catId })
        .setLock('pessimistic_write')
        .getOne();

      if (!category) {
        throw new ApiError(404, 'NOT_FOUND', 'Category not found.');
      }

      if (dto.cat_title !== undefined) {
        const trimmed = dto.cat_title.trim();
        const conflict = await repo
          .createQueryBuilder('c')
          .where(
            'c.rest_id = :restId AND c.cat_id <> :catId AND LOWER(TRIM(c.cat_title)) = LOWER(:title)',
            { restId, catId, title: trimmed },
          )
          .getOne();

        if (conflict) {
          throw new ApiError(
            409,
            'CONFLICT',
            'A category with this title already exists in your restaurant.',
          );
        }
        category.cat_title = trimmed;
      }

      if (
        dto.display_order !== undefined &&
        dto.display_order !== Number(category.display_order)
      ) {
        const swapTarget = await repo
          .createQueryBuilder('c')
          .where(
            'c.rest_id = :restId AND c.cat_id <> :catId AND c.display_order = :targetOrder',
            { restId, catId, targetOrder: dto.display_order },
          )
          .setLock('pessimistic_write')
          .getOne();

        if (!swapTarget) {
          throw new ApiError(
            422,
            'VALIDATION_ERROR',
            'Choose an existing category display order to swap with.',
            {
              display_order: [
                'Target display_order must match an existing category in your restaurant.',
              ],
            },
          );
        }

        const previousOrder = Number(category.display_order);
        await repo.update(
          { rest_id: restId, cat_id: swapTarget.cat_id },
          { display_order: previousOrder },
        );
        category.display_order = dto.display_order;
      }

      if (dto.is_active !== undefined) {
        category.is_active = dto.is_active;
      }

      const saved = await repo.save(category);
      const productCount = await manager.getRepository(Product).count({
        where: { rest_id: restId, cat_id: catId },
      });
      return { category: saved, productCount };
    });
  }

  async deleteCategory(restId: string, catId: string): Promise<void> {
    return this.dataSource.transaction(async (manager) => {
      await this.restaurants.assertCatalogWritable(restId, manager);
      const repo = manager.getRepository(Category);
      const category = await repo
        .createQueryBuilder('c')
        .where('c.rest_id = :restId AND c.cat_id = :catId', { restId, catId })
        .setLock('pessimistic_write')
        .getOne();

      if (!category) {
        throw new ApiError(404, 'NOT_FOUND', 'Category not found.');
      }

      const productCount = await manager.getRepository(Product).count({
        where: { rest_id: restId, cat_id: catId },
      });
      if (productCount > 0) {
        throw new ApiError(
          409,
          'CONFLICT',
          `Cannot delete category while it still contains ${productCount} product(s). Move or unlink all products first.`,
        );
      }

      await repo.delete({ rest_id: restId, cat_id: catId });
      await manager.query(
        `WITH ranked AS (
          SELECT cat_id, ROW_NUMBER() OVER (ORDER BY display_order ASC, cat_id ASC)::int AS new_order
          FROM categories
          WHERE rest_id = $1
        )
        UPDATE categories c
        SET display_order = ranked.new_order
        FROM ranked
        WHERE c.cat_id = ranked.cat_id AND c.display_order <> ranked.new_order`,
        [restId],
      );
    });
  }

  // --- Feature 06: Products ---

  async listProducts(
    restId: string,
    query: {
      cat_id?: string;
      unlinked?: 'true' | 'false';
      skip: number;
      take: number;
    },
  ): Promise<{ items: Product[]; total: number }> {
    if (query.cat_id !== undefined) {
      const cat = await this.dataSource.getRepository(Category).findOneBy({
        rest_id: restId,
        cat_id: query.cat_id,
      });
      if (!cat) {
        throw new ApiError(404, 'NOT_FOUND', 'Category not found.');
      }
    }

    const qb = this.dataSource
      .getRepository(Product)
      .createQueryBuilder('p')
      .where('p.rest_id = :restId', { restId });

    if (query.cat_id !== undefined) {
      qb.andWhere('p.cat_id = :catId', { catId: query.cat_id });
    }
    if (query.unlinked === 'true') {
      qb.andWhere('p.cat_id IS NULL');
    } else if (query.unlinked === 'false') {
      qb.andWhere('p.cat_id IS NOT NULL');
    }

    qb.orderBy('p.created_at', 'DESC')
      .addOrderBy('p.prod_id', 'DESC')
      .skip(query.skip)
      .take(query.take);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async getProduct(restId: string, prodId: string): Promise<Product> {
    const prod = await this.dataSource.getRepository(Product).findOneBy({
      rest_id: restId,
      prod_id: prodId,
    });
    if (!prod) {
      throw new ApiError(404, 'NOT_FOUND', 'Product not found.');
    }
    return prod;
  }

  async createProduct(restId: string, dto: CreateProductDto): Promise<Product> {
    return this.dataSource.transaction(async (manager) => {
      await this.restaurants.assertCatalogWritable(restId, manager);
      const catId = dto.cat_id ?? null;

      if (catId !== null) {
        const cat = await manager.getRepository(Category).findOneBy({
          rest_id: restId,
          cat_id: catId,
        });
        if (!cat) {
          throw new ApiError(404, 'NOT_FOUND', 'Category not found.');
        }
      } else if (dto.is_active === true) {
        throw new ApiError(
          422,
          'VALIDATION_ERROR',
          'A product cannot be active until it is linked to a category.',
          {
            is_active: [
              'Link this product to a category before activating it.',
            ],
          },
        );
      }

      const prodRepo = manager.getRepository(Product);
      const product = prodRepo.create({
        rest_id: restId,
        cat_id: catId,
        prod_name: dto.prod_name.trim(),
        prod_description: dto.prod_description ?? null,
        prod_image_url: dto.prod_image_url ?? null,
        price: moneyAmount(dto.price),
        is_active: catId === null ? false : (dto.is_active ?? true),
      });

      return prodRepo.save(product);
    });
  }

  async updateProduct(
    restId: string,
    prodId: string,
    dto: UpdateProductDto,
  ): Promise<Product> {
    return this.dataSource.transaction(async (manager) => {
      await this.restaurants.assertCatalogWritable(restId, manager);
      const prodRepo = manager.getRepository(Product);
      const product = await prodRepo
        .createQueryBuilder('p')
        .where('p.rest_id = :restId AND p.prod_id = :prodId', {
          restId,
          prodId,
        })
        .setLock('pessimistic_write')
        .getOne();

      if (!product) {
        throw new ApiError(404, 'NOT_FOUND', 'Product not found.');
      }

      const wasUnlinked = product.cat_id === null;

      if (dto.cat_id === null) {
        if (dto.is_active === true) {
          throw new ApiError(
            422,
            'VALIDATION_ERROR',
            'A product cannot be active until it is linked to a category.',
            {
              is_active: [
                'Link this product to a category before activating it.',
              ],
            },
          );
        }
        product.cat_id = null;
        product.is_active = false;
      } else if (dto.cat_id !== undefined) {
        const cat = await manager.getRepository(Category).findOneBy({
          rest_id: restId,
          cat_id: dto.cat_id,
        });
        if (!cat) {
          throw new ApiError(404, 'NOT_FOUND', 'Category not found.');
        }
        product.cat_id = dto.cat_id;
        if (wasUnlinked && dto.is_active === undefined) {
          product.is_active = true;
        }
      }

      if (dto.prod_name !== undefined) {
        product.prod_name = dto.prod_name.trim();
      }

      if (dto.prod_description !== undefined) {
        product.prod_description = dto.prod_description;
      }

      if (dto.prod_image_url !== undefined) {
        product.prod_image_url = dto.prod_image_url;
      }

      if (dto.price !== undefined) {
        product.price = moneyAmount(dto.price);
      }

      if (dto.is_active !== undefined) {
        if (dto.is_active === true && product.cat_id === null) {
          throw new ApiError(
            422,
            'VALIDATION_ERROR',
            'A product cannot be active until it is linked to a category.',
            {
              is_active: [
                'Link this product to a category before activating it.',
              ],
            },
          );
        }
        product.is_active = dto.is_active;
      }

      return prodRepo.save(product);
    });
  }

  async deleteProduct(restId: string, prodId: string): Promise<void> {
    return this.dataSource.transaction(async (manager) => {
      await this.restaurants.assertCatalogWritable(restId, manager);
      const prodRepo = manager.getRepository(Product);
      const product = await prodRepo
        .createQueryBuilder('p')
        .where('p.rest_id = :restId AND p.prod_id = :prodId', {
          restId,
          prodId,
        })
        .setLock('pessimistic_write')
        .getOne();

      if (!product) {
        throw new ApiError(404, 'NOT_FOUND', 'Product not found.');
      }

      if (product.cat_id !== null) {
        throw new ApiError(
          409,
          'CONFLICT',
          'Cannot delete a product while it is linked to a category. Unlink it from its category first.',
        );
      }

      const existingLinks = await manager.getRepository(ProductAddon).find({
        select: { addon_id: true },
        where: { rest_id: restId, prod_id: prodId },
      });
      const affectedAddonIds = [
        ...new Set(existingLinks.map((link) => link.addon_id)),
      ];

      await prodRepo.delete({ rest_id: restId, prod_id: prodId });

      if (affectedAddonIds.length > 0) {
        await manager.query(
          `UPDATE addons a
           SET is_active = false, updated_at = NOW()
           WHERE a.rest_id = $1
             AND a.addon_id = ANY($2::bigint[])
             AND a.is_active = true
             AND NOT EXISTS (
               SELECT 1
               FROM product_addons pa
               WHERE pa.rest_id = a.rest_id
                 AND pa.addon_id = a.addon_id
                 AND pa.is_active = true
             )`,
          [restId, affectedAddonIds],
        );
      }
    });
  }

  // --- Feature 07: Addons and Product Links ---

  async listAddons(
    restId: string,
    query: { unlinked?: 'true' | 'false'; skip: number; take: number },
  ): Promise<{
    items: Addon[];
    total: number;
    linkedProductIds: Map<string, string[]>;
  }> {
    const qb = this.dataSource
      .getRepository(Addon)
      .createQueryBuilder('a')
      .where('a.rest_id = :restId', { restId });

    if (query.unlinked === 'true') {
      qb.andWhere(
        'NOT EXISTS (SELECT 1 FROM product_addons pa WHERE pa.rest_id = a.rest_id AND pa.addon_id = a.addon_id AND pa.is_active = true)',
      );
    } else if (query.unlinked === 'false') {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM product_addons pa WHERE pa.rest_id = a.rest_id AND pa.addon_id = a.addon_id AND pa.is_active = true)',
      );
    }

    qb.orderBy('a.addon_id', 'ASC').skip(query.skip).take(query.take);

    const [items, total] = await qb.getManyAndCount();
    const linkedProductIds = await this.getAddonLinkedProductIds(
      restId,
      items.map((a) => a.addon_id),
    );
    return { items, total, linkedProductIds };
  }

  async createAddon(restId: string, dto: CreateAddonDto): Promise<Addon> {
    return this.dataSource.transaction(async (manager) => {
      await this.restaurants.assertCatalogWritable(restId, manager);
      if (dto.is_active === true) {
        throw new ApiError(
          422,
          'VALIDATION_ERROR',
          'An addon cannot be active until it is linked to at least one product.',
          {
            is_active: [
              'Link this addon to at least one product before activating it.',
            ],
          },
        );
      }
      const repo = manager.getRepository(Addon);
      const addon = repo.create({
        rest_id: restId,
        addon_name: dto.addon_name.trim(),
        addon_price: moneyAmount(dto.addon_price),
        is_active: false,
      });

      return repo.save(addon);
    });
  }

  async updateAddon(
    restId: string,
    addonId: string,
    dto: UpdateAddonDto,
  ): Promise<{ addon: Addon; linkedProductIds: string[] }> {
    return this.dataSource.transaction(async (manager) => {
      await this.restaurants.assertCatalogWritable(restId, manager);
      const repo = manager.getRepository(Addon);
      const addon = await repo
        .createQueryBuilder('a')
        .where('a.rest_id = :restId AND a.addon_id = :addonId', {
          restId,
          addonId,
        })
        .setLock('pessimistic_write')
        .getOne();

      if (!addon) {
        throw new ApiError(404, 'NOT_FOUND', 'Addon not found.');
      }

      const linkedMap = await this.getAddonLinkedProductIds(
        restId,
        [addonId],
        manager,
      );
      const linkedProductIds = linkedMap.get(addonId.toString()) ?? [];

      if (dto.addon_name !== undefined) {
        addon.addon_name = dto.addon_name.trim();
      }

      if (dto.addon_price !== undefined) {
        addon.addon_price = moneyAmount(dto.addon_price);
      }

      if (dto.is_active !== undefined) {
        if (dto.is_active === true && linkedProductIds.length === 0) {
          throw new ApiError(
            422,
            'VALIDATION_ERROR',
            'An addon cannot be active until it is linked to at least one product.',
            {
              is_active: [
                'Link this addon to at least one product before activating it.',
              ],
            },
          );
        }
        addon.is_active = dto.is_active;
      }

      const saved = await repo.save(addon);
      return { addon: saved, linkedProductIds };
    });
  }

  async deleteAddon(restId: string, addonId: string): Promise<void> {
    return this.dataSource.transaction(async (manager) => {
      await this.restaurants.assertCatalogWritable(restId, manager);
      const repo = manager.getRepository(Addon);
      const addon = await repo
        .createQueryBuilder('a')
        .where('a.rest_id = :restId AND a.addon_id = :addonId', {
          restId,
          addonId,
        })
        .setLock('pessimistic_write')
        .getOne();

      if (!addon) {
        throw new ApiError(404, 'NOT_FOUND', 'Addon not found.');
      }

      const activeLinkCount = await manager.getRepository(ProductAddon).count({
        where: { rest_id: restId, addon_id: addonId, is_active: true },
      });
      if (activeLinkCount > 0) {
        throw new ApiError(
          409,
          'CONFLICT',
          `Cannot delete addon while it is linked to ${activeLinkCount} product(s). Unlink it from all products first.`,
        );
      }

      await repo.delete({ rest_id: restId, addon_id: addonId });
    });
  }

  async listProductAddons(
    restId: string,
    prodId: string,
  ): Promise<
    Array<{ link: ProductAddon; addon: Addon; linkedProductIds: string[] }>
  > {
    const prod = await this.dataSource.getRepository(Product).findOneBy({
      rest_id: restId,
      prod_id: prodId,
    });
    if (!prod) {
      throw new ApiError(404, 'NOT_FOUND', 'Product not found.');
    }

    const links = await this.dataSource.getRepository(ProductAddon).find({
      where: { rest_id: restId, prod_id: prodId },
      order: { addon_id: 'ASC' },
    });

    if (links.length === 0) {
      return [];
    }

    const addonIds = links.map((l) => l.addon_id);
    const [addons, linkedMap] = await Promise.all([
      this.dataSource.getRepository(Addon).findBy({
        rest_id: restId,
        addon_id: In(addonIds),
      }),
      this.getAddonLinkedProductIds(restId, addonIds),
    ]);
    const addonMap = new Map(addons.map((a) => [a.addon_id, a]));

    return links
      .filter((link) => addonMap.has(link.addon_id))
      .map((link) => ({
        link,
        addon: addonMap.get(link.addon_id)!,
        linkedProductIds: linkedMap.get(link.addon_id.toString()) ?? [],
      }));
  }

  async setProductAddon(
    restId: string,
    prodId: string,
    addonId: string,
    dto: SetProductAddonDto,
  ): Promise<{
    link: ProductAddon;
    addon: Addon;
    linkedProductIds: string[];
  }> {
    return this.dataSource.transaction(async (manager) => {
      await this.restaurants.assertCatalogWritable(restId, manager);
      const prod = await manager
        .getRepository(Product)
        .createQueryBuilder('p')
        .where('p.rest_id = :restId AND p.prod_id = :prodId', {
          restId,
          prodId,
        })
        .setLock('pessimistic_write')
        .getOne();
      if (!prod) {
        throw new ApiError(404, 'NOT_FOUND', 'Product not found.');
      }

      const addonRepo = manager.getRepository(Addon);
      const addon = await addonRepo
        .createQueryBuilder('a')
        .where('a.rest_id = :restId AND a.addon_id = :addonId', {
          restId,
          addonId,
        })
        .setLock('pessimistic_write')
        .getOne();
      if (!addon) {
        throw new ApiError(404, 'NOT_FOUND', 'Addon not found.');
      }

      const repo = manager.getRepository(ProductAddon);
      const beforeActiveCount = await repo.count({
        where: { rest_id: restId, addon_id: addonId, is_active: true },
      });

      let link = await repo.findOneBy({
        rest_id: restId,
        prod_id: prodId,
        addon_id: addonId,
      });

      if (!link) {
        link = repo.create({
          rest_id: restId,
          prod_id: prodId,
          addon_id: addonId,
          is_active: dto.is_active ?? true,
        });
      } else {
        link.is_active = dto.is_active ?? true;
      }

      const saved = await repo.save(link);
      const afterMap = await this.getAddonLinkedProductIds(
        restId,
        [addonId],
        manager,
      );
      const linkedProductIds = afterMap.get(addonId.toString()) ?? [];

      if (
        beforeActiveCount === 0 &&
        linkedProductIds.length > 0 &&
        !addon.is_active
      ) {
        addon.is_active = true;
        await addonRepo.save(addon);
      } else if (linkedProductIds.length === 0 && addon.is_active) {
        addon.is_active = false;
        await addonRepo.save(addon);
      }

      return { link: saved, addon, linkedProductIds };
    });
  }

  // --- Feature 08: Offers ---

  async deactivateExpiredOffers(restId?: string): Promise<number> {
    const qb = this.dataSource
      .createQueryBuilder()
      .update(Offer)
      .set({ is_active: false, updated_at: () => 'NOW()' })
      .where('is_active = true AND expires_at <= NOW()');

    if (restId !== undefined) {
      qb.andWhere('rest_id = :restId', { restId });
    }

    const result = await qb.execute();
    return result.affected ?? 0;
  }

  async listOffers(
    restId: string,
    pagination: { skip: number; take: number },
  ): Promise<{ items: Offer[]; total: number }> {
    await this.deactivateExpiredOffers(restId);

    const qb = this.dataSource
      .getRepository(Offer)
      .createQueryBuilder('o')
      .where('o.rest_id = :restId', { restId })
      .orderBy('o.starts_at', 'DESC')
      .addOrderBy('o.offer_id', 'DESC')
      .skip(pagination.skip)
      .take(pagination.take);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async createOffer(restId: string, dto: CreateOfferDto): Promise<Offer> {
    return this.dataSource.transaction(async (manager) => {
      await this.restaurants.assertCatalogWritable(restId, manager);
      const initialPrice = dto.initial_price;
      const realPrice = dto.real_price;
      const startsAt = new Date(dto.starts_at);
      const expiresAt = new Date(dto.expires_at);
      const now = new Date();
      const todayCairo = cairoDateString(now);

      if (moneyCents(realPrice) > moneyCents(initialPrice)) {
        throw new ApiError(
          422,
          'VALIDATION_ERROR',
          'real_price must not exceed initial_price.',
          {
            real_price: [
              'Sale price must be less than or equal to the initial price.',
            ],
          },
        );
      }
      if (cairoDateString(startsAt) < todayCairo) {
        throw new ApiError(
          422,
          'VALIDATION_ERROR',
          'starts_at cannot be earlier than today.',
          { starts_at: ['Start date cannot be earlier than today.'] },
        );
      }
      if (expiresAt <= startsAt) {
        throw new ApiError(
          422,
          'VALIDATION_ERROR',
          'expires_at must be after starts_at.',
          { expires_at: ['Expiry date must be on or after the start date.'] },
        );
      }
      const nextActive = dto.is_active ?? true;
      if (nextActive && expiresAt <= now) {
        throw new ApiError(
          422,
          'VALIDATION_ERROR',
          'Cannot activate an expired offer.',
          {
            is_active: [
              'Cannot activate an expired offer. Extend the end date first.',
            ],
          },
        );
      }

      const repo = manager.getRepository(Offer);
      const offer = repo.create({
        rest_id: restId,
        offer_title: dto.offer_title.trim(),
        offer_description: dto.offer_description ?? null,
        initial_price: moneyAmount(initialPrice),
        real_price: moneyAmount(realPrice),
        offer_image_url: dto.offer_image_url ?? null,
        is_active: nextActive,
        starts_at: startsAt,
        expires_at: expiresAt,
      });

      return repo.save(offer);
    });
  }

  async updateOffer(
    restId: string,
    offerId: string,
    dto: UpdateOfferDto,
  ): Promise<Offer> {
    return this.dataSource.transaction(async (manager) => {
      await this.restaurants.assertCatalogWritable(restId, manager);
      const repo = manager.getRepository(Offer);
      const offer = await repo
        .createQueryBuilder('o')
        .where('o.rest_id = :restId AND o.offer_id = :offerId', {
          restId,
          offerId,
        })
        .setLock('pessimistic_write')
        .getOne();

      if (!offer) {
        throw new ApiError(404, 'NOT_FOUND', 'Offer not found.');
      }

      const now = new Date();
      const todayCairo = cairoDateString(now);
      const previousStarts =
        offer.starts_at instanceof Date
          ? offer.starts_at
          : new Date(offer.starts_at);
      const previousStartDate = cairoDateString(previousStarts);

      if (dto.offer_title !== undefined)
        offer.offer_title = dto.offer_title.trim();
      if (dto.offer_description !== undefined)
        offer.offer_description = dto.offer_description;
      if (dto.offer_image_url !== undefined)
        offer.offer_image_url = dto.offer_image_url;
      if (dto.is_active !== undefined) offer.is_active = dto.is_active;
      if (dto.starts_at !== undefined) {
        const nextStarts = new Date(dto.starts_at);
        const nextStartDate = cairoDateString(nextStarts);
        if (nextStartDate < todayCairo && nextStartDate !== previousStartDate) {
          throw new ApiError(
            422,
            'VALIDATION_ERROR',
            'starts_at cannot be earlier than today.',
            { starts_at: ['Start date cannot be earlier than today.'] },
          );
        }
        offer.starts_at = nextStarts;
      }
      if (dto.expires_at !== undefined)
        offer.expires_at = new Date(dto.expires_at);
      if (dto.initial_price !== undefined)
        offer.initial_price = moneyAmount(dto.initial_price);
      if (dto.real_price !== undefined)
        offer.real_price = moneyAmount(dto.real_price);

      // validate after merging
      const finalInitial = offer.initial_price;
      const finalReal = offer.real_price;
      const finalStarts =
        offer.starts_at instanceof Date
          ? offer.starts_at
          : new Date(offer.starts_at);
      const finalExpires =
        offer.expires_at instanceof Date
          ? offer.expires_at
          : new Date(offer.expires_at);

      if (moneyCents(finalReal) > moneyCents(finalInitial)) {
        throw new ApiError(
          422,
          'VALIDATION_ERROR',
          'real_price must not exceed initial_price.',
          {
            real_price: [
              'Sale price must be less than or equal to the initial price.',
            ],
          },
        );
      }
      if (finalExpires <= finalStarts) {
        throw new ApiError(
          422,
          'VALIDATION_ERROR',
          'expires_at must be after starts_at.',
          { expires_at: ['Expiry date must be on or after the start date.'] },
        );
      }
      if (finalExpires <= now) {
        if (dto.is_active === true) {
          throw new ApiError(
            422,
            'VALIDATION_ERROR',
            'Cannot activate an expired offer.',
            {
              is_active: [
                'Cannot activate an expired offer. Extend the end date first.',
              ],
            },
          );
        }
        offer.is_active = false;
      }

      return repo.save(offer);
    });
  }

  // --- Feature 09: Public Restaurant Menu ---

  private isRestaurantOpen(profile: RestaurantProfile): boolean {
    const local = cairoClockFormatter.format(new Date());
    const [h = 0, m = 0, sec = 0] = local.split(':').map(Number);
    const nowSec = h * 3600 + m * 60 + sec;

    const [oh = 0, om = 0, os] = (profile.opens_at as string)
      .split(':')
      .map(Number);
    const [ch = 0, cm = 0, cs] = (profile.closes_at as string)
      .split(':')
      .map(Number);
    const openSec = oh * 3600 + om * 60 + (os ?? 0);
    const closeSec = ch * 3600 + cm * 60 + (cs ?? 0);

    if (openSec < closeSec) {
      return nowSec >= openSec && nowSec < closeSec;
    } else {
      // overnight window
      return nowSec >= openSec || nowSec < closeSec;
    }
  }

  async listPublicRestaurants(pagination: {
    skip: number;
    take: number;
  }): Promise<{ items: RestaurantProfile[]; total: number }> {
    return this.restaurants.listPublic(pagination);
  }

  async getPublicRestaurant(restId: string): Promise<RestaurantProfile> {
    return this.restaurants.getPublic(restId);
  }

  async listPublicCategories(
    restId: string,
    pagination: { skip: number; take: number },
  ): Promise<{ items: Category[]; total: number }> {
    await this.getPublicRestaurant(restId);

    const qb = this.dataSource
      .getRepository(Category)
      .createQueryBuilder('c')
      .where('c.rest_id = :restId AND c.is_active = true', { restId })
      .orderBy('c.display_order', 'ASC')
      .addOrderBy('c.cat_id', 'ASC')
      .skip(pagination.skip)
      .take(pagination.take);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async listPublicProducts(
    restId: string,
    query: { cat_id?: string; skip: number; take: number },
  ): Promise<{ items: Product[]; total: number }> {
    await this.getPublicRestaurant(restId);

    if (query.cat_id !== undefined) {
      const cat = await this.dataSource.getRepository(Category).findOneBy({
        rest_id: restId,
        cat_id: query.cat_id,
        is_active: true,
      });
      if (!cat) throw new ApiError(404, 'NOT_FOUND', 'Category not found.');
    }

    const qb = this.dataSource
      .getRepository(Product)
      .createQueryBuilder('p')
      .innerJoin(
        Category,
        'category',
        'category.cat_id = p.cat_id AND category.rest_id = p.rest_id AND category.is_active = true',
      )
      .where('p.rest_id = :restId AND p.is_active = true', { restId });

    if (query.cat_id !== undefined) {
      qb.andWhere('p.cat_id = :catId', { catId: query.cat_id });
    }

    qb.orderBy('p.created_at', 'DESC')
      .addOrderBy('p.prod_id', 'DESC')
      .skip(query.skip)
      .take(query.take);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async getPublicProductDetails(
    restId: string,
    prodId: string,
  ): Promise<{ product: Product; addons: Addon[] }> {
    await this.getPublicRestaurant(restId);

    const product = await this.dataSource.getRepository(Product).findOneBy({
      rest_id: restId,
      prod_id: prodId,
      is_active: true,
    });
    if (
      !product ||
      !product.cat_id ||
      !(await this.dataSource
        .getRepository(Category)
        .existsBy({ cat_id: product.cat_id, rest_id: restId, is_active: true }))
    )
      throw new ApiError(404, 'NOT_FOUND', 'Product not found.');

    const links = await this.dataSource.getRepository(ProductAddon).find({
      where: { rest_id: restId, prod_id: prodId, is_active: true },
      order: { addon_id: 'ASC' },
    });

    let addons: Addon[] = [];
    if (links.length > 0) {
      const addonIds = links.map((l) => l.addon_id);
      addons = await this.dataSource.getRepository(Addon).find({
        where: { rest_id: restId, addon_id: In(addonIds), is_active: true },
        order: { addon_id: 'ASC' },
      });
    }

    return { product, addons };
  }

  async listPublicOffers(
    restId: string,
    pagination: { skip: number; take: number },
  ): Promise<{ items: Offer[]; total: number }> {
    await this.getPublicRestaurant(restId);
    await this.deactivateExpiredOffers(restId);

    const now = new Date();
    const qb = this.dataSource
      .getRepository(Offer)
      .createQueryBuilder('o')
      .where('o.rest_id = :restId', { restId })
      .andWhere('o.is_active = true')
      .andWhere('o.starts_at <= :now', { now })
      .andWhere('o.expires_at > :now', { now })
      .orderBy('o.starts_at', 'DESC')
      .addOrderBy('o.offer_id', 'DESC')
      .skip(pagination.skip)
      .take(pagination.take);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async getPublicOffer(restId: string, offerId: string): Promise<Offer> {
    await this.getPublicRestaurant(restId);

    const now = new Date();
    const offer = await this.dataSource
      .getRepository(Offer)
      .createQueryBuilder('o')
      .where('o.rest_id = :restId AND o.offer_id = :offerId', {
        restId,
        offerId,
      })
      .andWhere('o.is_active = true')
      .andWhere('o.starts_at <= :now', { now })
      .andWhere('o.expires_at > :now', { now })
      .getOne();

    if (!offer) throw new ApiError(404, 'NOT_FOUND', 'Offer not found.');
    return offer;
  }

  isOpen(profile: RestaurantProfile): boolean {
    return this.isRestaurantOpen(profile);
  }

  async restaurantMenuSummary(restId: string): Promise<{
    active_categories: number;
    inactive_categories: number;
    active_products: number;
    inactive_products: number;
    active_addons: number;
    active_offers: number;
    expiring_offers: number;
    products: Array<{
      prod_id: string;
      prod_name: string;
      cat_id: string | null;
      cat_title: string;
      price: string;
      is_active: boolean;
    }>;
  }> {
    const now = new Date();
    const soon = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    await this.deactivateExpiredOffers(restId);
    const [categories, products, activeAddons, offers] = await Promise.all([
      this.dataSource.getRepository(Category).find({
        select: { cat_id: true, cat_title: true, is_active: true },
        where: { rest_id: restId },
      }),
      this.dataSource.getRepository(Product).find({
        select: {
          prod_id: true,
          cat_id: true,
          prod_name: true,
          price: true,
          is_active: true,
        },
        where: { rest_id: restId },
      }),
      this.dataSource.getRepository(Addon).count({
        where: { rest_id: restId, is_active: true },
      }),
      this.dataSource.getRepository(Offer).find({
        select: {
          offer_id: true,
          is_active: true,
          starts_at: true,
          expires_at: true,
        },
        where: { rest_id: restId },
      }),
    ]);

    const catTitleById = new Map(
      categories.map((cat) => [cat.cat_id, cat.cat_title]),
    );
    let activeCategories = 0;
    let inactiveCategories = 0;
    for (const cat of categories) {
      if (cat.is_active) activeCategories += 1;
      else inactiveCategories += 1;
    }

    let activeProducts = 0;
    let inactiveProducts = 0;
    for (const prod of products) {
      if (prod.is_active) activeProducts += 1;
      else inactiveProducts += 1;
    }

    let activeOffers = 0;
    let expiringOffers = 0;
    for (const offer of offers) {
      if (offer.is_active && offer.starts_at <= now && offer.expires_at > now) {
        activeOffers += 1;
        if (offer.expires_at <= soon) expiringOffers += 1;
      }
    }

    return {
      active_categories: activeCategories,
      inactive_categories: inactiveCategories,
      active_products: activeProducts,
      inactive_products: inactiveProducts,
      active_addons: activeAddons,
      active_offers: activeOffers,
      expiring_offers: expiringOffers,
      products: products.map((prod) => ({
        prod_id: prod.prod_id,
        prod_name: prod.prod_name,
        cat_id: prod.cat_id,
        cat_title: prod.cat_id
          ? (catTitleById.get(prod.cat_id) ?? 'أصناف أخرى')
          : 'غير مصنّف',
        price: prod.price,
        is_active: prod.is_active,
      })),
    };
  }
}
