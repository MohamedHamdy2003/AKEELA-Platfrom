import {
  Controller,
  Put,
  Param,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  CurrentActor,
  AuthActor,
} from '../../common/http/current-actor.decorator';
import { reply } from '../../common/http/api-error';
import { ImagesService } from './images.service';
const imageUpload = () =>
  FileInterceptor('file', {
    limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 },
  });
@Controller()
export class ImagesController {
  constructor(private readonly images: ImagesService) {}
  @Put('customer/avatar') @UseInterceptors(imageUpload()) async avatar(
    @CurrentActor() actor: AuthActor,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return reply(await this.images.upload(actor, 'avatar', file?.buffer));
  }
  @Put('restaurant/profile/image')
  @UseInterceptors(imageUpload())
  async restaurant(
    @CurrentActor() actor: AuthActor,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return reply(await this.images.upload(actor, 'restaurant', file?.buffer));
  }
  @Put('restaurant/products/:prod_id/image')
  @UseInterceptors(imageUpload())
  async product(
    @CurrentActor() actor: AuthActor,
    @Param('prod_id') id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return reply(await this.images.upload(actor, 'product', file?.buffer, id));
  }
  @Put('restaurant/offers/:offer_id/image')
  @UseInterceptors(imageUpload())
  async offer(
    @CurrentActor() actor: AuthActor,
    @Param('offer_id') id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return reply(await this.images.upload(actor, 'offer', file?.buffer, id));
  }
}
