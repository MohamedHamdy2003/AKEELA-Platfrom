import { moneyCents, moneyAmount } from '../../common/money';
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

@Injectable()
export class CatalogService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly restaurants: RestaurantsService,
  ) {}

  async saleSelection(
    restId: string,
    prodId: string | null,
    offerId: string | null,
    addonIds: string[],
    manager: EntityManager,
  ) {
    const product = prodId
      ? await manager
          .getRepository(Product)
          .findOneBy({ rest_id: restId, prod_id: prodId })
      : null;
    const offer = offerId
      ? await manager
          .getRepository(Offer)
          .findOneBy({ rest_id: restId, offer_id: offerId })
      : null;
    const category = product
      ? await manager
          .getRepository(Category)
          .findOneBy({ rest_id: restId, cat_id: product.cat_id })
      : null;
    const now = Date.now();
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
    const addons = [];
    for (const addonId of addonIds) {
      const addon = await manager
        .getRepository(Addon)
        .findOneBy({ rest_id: restId, addon_id: addonId });
      const link = prodId
        ? await manager
            .getRepository(ProductAddon)
            .findOneBy({ rest_id: restId, prod_id: prodId, addon_id: addonId })
        : null;
      addons.push({
        addon_id: addonId,
        name: addon?.addon_name ?? '',
        price: addon?.addon_price ?? '0.00',
        is_available: Boolean(addon?.is_active && link?.is_active),
      });
    }
    return { item, addons };
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

  async listCategories(
    restId: string,
    pagination: { skip: number; take: number },
  ): Promise<{ items: Category[]; total: number }> {
    const qb = this.dataSource
      .getRepository(Category)
      .createQueryBuilder('c')
      .where('c.rest_id = :restId', { restId })
      .orderBy('c.display_order', 'ASC')
      .addOrderBy('c.cat_id', 'ASC')
      .skip(pagination.skip)
      .take(pagination.take);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async createCategory(
    restId: string,
    dto: CreateCategoryDto,
  ): Promise<Category> {
    return this.dataSource.transaction(async (manager) => {
      await this.restaurants.profileById(restId, manager, true);
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

      const category = repo.create({
        rest_id: restId,
        cat_title: dto.cat_title.trim(),
        display_order: dto.display_order ?? 0,
        is_active: dto.is_active ?? true,
      });

      return repo.save(category);
    });
  }

  async updateCategory(
    restId: string,
    catId: string,
    dto: UpdateCategoryDto,
  ): Promise<Category> {
    return this.dataSource.transaction(async (manager) => {
      await this.restaurants.profileById(restId, manager, true);
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

      if (dto.display_order !== undefined) {
        category.display_order = dto.display_order;
      }

      if (dto.is_active !== undefined) {
        category.is_active = dto.is_active;
      }

      return repo.save(category);
    });
  }

  // --- Feature 06: Products ---

  async listProducts(
    restId: string,
    query: { cat_id?: string; skip: number; take: number },
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
      const catRepo = manager.getRepository(Category);
      const cat = await catRepo.findOneBy({
        rest_id: restId,
        cat_id: dto.cat_id,
      });
      if (!cat) {
        throw new ApiError(404, 'NOT_FOUND', 'Category not found.');
      }

      const prodRepo = manager.getRepository(Product);
      const product = prodRepo.create({
        rest_id: restId,
        cat_id: dto.cat_id,
        prod_name: dto.prod_name.trim(),
        prod_description: dto.prod_description ?? null,
        prod_image_url: dto.prod_image_url ?? null,
        price: moneyAmount(dto.price),
        is_active: dto.is_active ?? true,
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

      if (dto.cat_id !== undefined) {
        const catRepo = manager.getRepository(Category);
        const cat = await catRepo.findOneBy({
          rest_id: restId,
          cat_id: dto.cat_id,
        });
        if (!cat) {
          throw new ApiError(404, 'NOT_FOUND', 'Category not found.');
        }
        product.cat_id = dto.cat_id;
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
        product.is_active = dto.is_active;
      }

      return prodRepo.save(product);
    });
  }

  // --- Feature 07: Addons and Product Links ---

  async listAddons(
    restId: string,
    pagination: { skip: number; take: number },
  ): Promise<{ items: Addon[]; total: number }> {
    const qb = this.dataSource
      .getRepository(Addon)
      .createQueryBuilder('a')
      .where('a.rest_id = :restId', { restId })
      .orderBy('a.addon_id', 'ASC')
      .skip(pagination.skip)
      .take(pagination.take);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async createAddon(restId: string, dto: CreateAddonDto): Promise<Addon> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Addon);
      const addon = repo.create({
        rest_id: restId,
        addon_name: dto.addon_name.trim(),
        addon_price: moneyAmount(dto.addon_price),
        is_active: dto.is_active ?? true,
      });

      return repo.save(addon);
    });
  }

  async updateAddon(
    restId: string,
    addonId: string,
    dto: UpdateAddonDto,
  ): Promise<Addon> {
    return this.dataSource.transaction(async (manager) => {
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

      if (dto.addon_name !== undefined) {
        addon.addon_name = dto.addon_name.trim();
      }

      if (dto.addon_price !== undefined) {
        addon.addon_price = moneyAmount(dto.addon_price);
      }

      if (dto.is_active !== undefined) {
        addon.is_active = dto.is_active;
      }

      return repo.save(addon);
    });
  }

  async listProductAddons(
    restId: string,
    prodId: string,
  ): Promise<Array<{ link: ProductAddon; addon: Addon }>> {
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
    const addons = await this.dataSource.getRepository(Addon).findBy({
      rest_id: restId,
      addon_id: In(addonIds),
    });
    const addonMap = new Map(addons.map((a) => [a.addon_id, a]));

    return links.map((link) => ({
      link,
      addon: addonMap.get(link.addon_id)!,
    }));
  }

  async setProductAddon(
    restId: string,
    prodId: string,
    addonId: string,
    dto: SetProductAddonDto,
  ): Promise<{ link: ProductAddon; addon: Addon }> {
    return this.dataSource.transaction(async (manager) => {
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

      const addon = await manager.getRepository(Addon).findOneBy({
        rest_id: restId,
        addon_id: addonId,
      });
      if (!addon) {
        throw new ApiError(404, 'NOT_FOUND', 'Addon not found.');
      }

      const repo = manager.getRepository(ProductAddon);
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
      return { link: saved, addon };
    });
  }

  // --- Feature 08: Offers ---

  async listOffers(
    restId: string,
    pagination: { skip: number; take: number },
  ): Promise<{ items: Offer[]; total: number }> {
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
      const initialPrice = dto.initial_price;
      const realPrice = dto.real_price;
      const startsAt = new Date(dto.starts_at);
      const expiresAt = new Date(dto.expires_at);

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
      if (expiresAt <= startsAt) {
        throw new ApiError(
          422,
          'VALIDATION_ERROR',
          'expires_at must be after starts_at.',
          { expires_at: ['Expiry time must be after the start time.'] },
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
        is_active: dto.is_active ?? true,
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

      if (dto.offer_title !== undefined)
        offer.offer_title = dto.offer_title.trim();
      if (dto.offer_description !== undefined)
        offer.offer_description = dto.offer_description;
      if (dto.offer_image_url !== undefined)
        offer.offer_image_url = dto.offer_image_url;
      if (dto.is_active !== undefined) offer.is_active = dto.is_active;
      if (dto.starts_at !== undefined)
        offer.starts_at = new Date(dto.starts_at);
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
          { expires_at: ['Expiry time must be after the start time.'] },
        );
      }

      return repo.save(offer);
    });
  }

  // --- Feature 09: Public Restaurant Menu ---

  private isRestaurantOpen(profile: RestaurantProfile): boolean {
    const now = new Date();
    const local = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Cairo',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).format(now);
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
}
