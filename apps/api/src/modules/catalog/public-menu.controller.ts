import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { PublicRoute } from '../../common/http/public-route.decorator';
import { paginationMeta, resolvePagination } from '../users/admin.dto';
import {
  ListCategoriesQuery,
  ListOffersQuery,
  ListProductsQuery,
  PublicAddonResponse,
  PublicCategoryResponse,
  PublicOfferResponse,
  PublicProductDetailsResponse,
  PublicProductResponse,
  PublicRestaurantResponse,
} from './catalog.dto';
import { CatalogService } from './catalog.service';
import { RestaurantProfile } from '../restaurants/entities/restaurant-profile.entity';
import { Category } from './entities/category.entity';
import { Product } from './entities/product.entity';
import { Addon } from './entities/addon.entity';
import { Offer } from './entities/offer.entity';

function serializePublicRestaurant(
  profile: RestaurantProfile,
  isOpen: boolean,
): PublicRestaurantResponse {
  return {
    rest_id: profile.rest_id.toString(),
    rest_title: profile.rest_title,
    rest_description: profile.rest_description ?? null,
    rest_image_url_mobile: profile.rest_image_url_mobile ?? null,
    rest_address: profile.rest_address,
    longitude: Number(profile.longitude).toFixed(7),
    latitude: Number(profile.latitude).toFixed(7),
    opens_at: profile.opens_at as string,
    closes_at: profile.closes_at as string,
    is_open: isOpen,
  };
}

function serializePublicCategory(c: Category): PublicCategoryResponse {
  return {
    cat_id: c.cat_id.toString(),
    cat_title: c.cat_title,
    display_order: Number(c.display_order),
  };
}

function serializePublicProduct(p: Product): PublicProductResponse {
  return {
    prod_id: p.prod_id.toString(),
    cat_id: p.cat_id!.toString(),
    prod_name: p.prod_name,
    prod_description: p.prod_description ?? null,
    prod_image_url: p.prod_image_url ?? null,
    price: p.price,
  };
}

function serializePublicAddon(a: Addon): PublicAddonResponse {
  return {
    addon_id: a.addon_id.toString(),
    addon_name: a.addon_name,
    addon_price: a.addon_price,
  };
}

function serializePublicProductDetails(
  p: Product,
  addons: Addon[],
): PublicProductDetailsResponse {
  return {
    ...serializePublicProduct(p),
    addons: addons.map(serializePublicAddon),
  };
}

function serializePublicOffer(o: Offer): PublicOfferResponse {
  return {
    offer_id: o.offer_id.toString(),
    rest_id: o.rest_id.toString(),
    offer_title: o.offer_title,
    offer_description: o.offer_description ?? null,
    initial_price: o.initial_price,
    real_price: o.real_price,
    offer_image_url: o.offer_image_url ?? null,
    starts_at:
      o.starts_at instanceof Date
        ? o.starts_at.toISOString()
        : new Date(o.starts_at).toISOString(),
    expires_at:
      o.expires_at instanceof Date
        ? o.expires_at.toISOString()
        : new Date(o.expires_at).toISOString(),
  };
}

@Controller('restaurants')
@PublicRoute()
export class PublicMenuController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=15, stale-while-revalidate=30')
  async listRestaurants(@Query() query: ListCategoriesQuery) {
    const pagination = resolvePagination(query);
    const { items, total } = await this.catalog.listPublicRestaurants({
      skip: pagination.skip,
      take: pagination.take,
    });
    const nowSec = this.catalog.currentCairoSeconds();
    return {
      success: true,
      message: 'Records returned.',
      data: items.map((r) =>
        serializePublicRestaurant(r, this.catalog.isOpen(r, nowSec)),
      ),
      meta: paginationMeta(total, pagination.page, pagination.per_page),
    };
  }

  @Get(':rest_id')
  @Header('Cache-Control', 'public, max-age=15, stale-while-revalidate=30')
  async getRestaurant(@Param('rest_id') restId: string) {
    const profile = await this.catalog.getPublicRestaurant(restId);
    return {
      success: true,
      message: 'Request completed.',
      data: serializePublicRestaurant(profile, this.catalog.isOpen(profile)),
    };
  }

  @Get(':rest_id/categories')
  @Header('Cache-Control', 'public, max-age=15, stale-while-revalidate=30')
  async listCategories(
    @Param('rest_id') restId: string,
    @Query() query: ListCategoriesQuery,
  ) {
    const pagination = resolvePagination(query);
    const { items, total } = await this.catalog.listPublicCategories(restId, {
      skip: pagination.skip,
      take: pagination.take,
    });
    return {
      success: true,
      message: 'Records returned.',
      data: items.map(serializePublicCategory),
      meta: paginationMeta(total, pagination.page, pagination.per_page),
    };
  }

  @Get(':rest_id/products')
  @Header('Cache-Control', 'public, max-age=15, stale-while-revalidate=30')
  async listProducts(
    @Param('rest_id') restId: string,
    @Query() query: ListProductsQuery,
  ) {
    const pagination = resolvePagination(query);
    const { items, total } = await this.catalog.listPublicProducts(restId, {
      cat_id: query.cat_id,
      skip: pagination.skip,
      take: pagination.take,
    });
    return {
      success: true,
      message: 'Records returned.',
      data: items.map(serializePublicProduct),
      meta: paginationMeta(total, pagination.page, pagination.per_page),
    };
  }

  @Get(':rest_id/products/:prod_id')
  @Header('Cache-Control', 'public, max-age=15, stale-while-revalidate=30')
  async getProduct(
    @Param('rest_id') restId: string,
    @Param('prod_id') prodId: string,
  ) {
    const { product, addons } = await this.catalog.getPublicProductDetails(
      restId,
      prodId,
    );
    return {
      success: true,
      message: 'Request completed.',
      data: serializePublicProductDetails(product, addons),
    };
  }

  @Get(':rest_id/offers')
  @Header('Cache-Control', 'public, max-age=15, stale-while-revalidate=30')
  async listOffers(
    @Param('rest_id') restId: string,
    @Query() query: ListOffersQuery,
  ) {
    const pagination = resolvePagination(query);
    const { items, total } = await this.catalog.listPublicOffers(restId, {
      skip: pagination.skip,
      take: pagination.take,
    });
    return {
      success: true,
      message: 'Records returned.',
      data: items.map(serializePublicOffer),
      meta: paginationMeta(total, pagination.page, pagination.per_page),
    };
  }

  @Get(':rest_id/offers/:offer_id')
  @Header('Cache-Control', 'public, max-age=15, stale-while-revalidate=30')
  async getOffer(
    @Param('rest_id') restId: string,
    @Param('offer_id') offerId: string,
  ) {
    const offer = await this.catalog.getPublicOffer(restId, offerId);
    return {
      success: true,
      message: 'Request completed.',
      data: serializePublicOffer(offer),
    };
  }
}
