import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ApiError } from '../../common/http/api-error';
import { RestaurantProfile } from '../restaurants/entities/restaurant-profile.entity';
import { RestaurantsService } from '../restaurants/restaurants.service';
import {
  CreateCategoryDto,
  CreateProductDto,
  UpdateCategoryDto,
  UpdateProductDto,
} from './catalog.dto';
import { Category } from './entities/category.entity';
import { Product } from './entities/product.entity';

@Injectable()
export class CatalogService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly restaurants: RestaurantsService,
  ) {}

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
        price: Number(dto.price).toFixed(2),
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
        product.price = Number(dto.price).toFixed(2);
      }

      if (dto.is_active !== undefined) {
        product.is_active = dto.is_active;
      }

      return prodRepo.save(product);
    });
  }
}
