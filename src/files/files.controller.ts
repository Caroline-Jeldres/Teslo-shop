import { Controller, Get, Post, UploadedFile, UseInterceptors, BadRequestException, Param, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { diskStorage } from 'multer';
import { FilesService } from './files.service';
import { fileFilter, fileName } from './helpers';


@Controller('files')
export class FilesController {
  constructor(
    private readonly filesService: FilesService,
    private readonly configService: ConfigService
  ) { }

  @Post('product')
  @UseInterceptors(FileInterceptor('file', {
    fileFilter: fileFilter,
    //limits: {fileSize: 1000}
    storage: diskStorage({
      destination: "./static/products",
      filename: fileName,
    })
  }))
  uploadProductImage(
    @UploadedFile() file: Express.Multer.File
  ) {
    if (!file) {
      throw new BadRequestException('Make sure that the file is an image')
    }

    const secureUrl = `${this.configService.get('HOST_API')}/files/product/${file.filename}`
    return {
      secureUrl
    }
  }

  @Get('product/:imageName')
  findImage(
    @Res() res: Response,
    @Param('imageName') imageName: string
  ) {

    const path = this.filesService.getStaticProductImage(imageName)
    res.sendFile(path)
  }


}
