import { Injectable, InternalServerErrorException, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaginationDto } from 'src/common/dtos/pagination.dto';
import { DataSource, Repository } from 'typeorm';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { validate as isUUID } from 'uuid'
import { Product, ProductImage } from './entities';

@Injectable()
export class ProductsService {

  private readonly logger = new Logger('ProductsService');

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,

    @InjectRepository(ProductImage)
    private readonly productImageRepository: Repository<ProductImage>,

    private readonly dataSource: DataSource,
  ) { }

  async create(createProductDto: CreateProductDto) {
    try {

      const { images = [], ...productDetails } = createProductDto


      const product = this.productRepository.create({
        ...productDetails,
        images: images.map(image => this.productImageRepository.create({ url: image }))
      });

      await this.productRepository.save(product);

      return { ...product, images };

    } catch (error) {
      this.handleDBExceptions(error)
    }
  }

  async findAll(paginationDto: PaginationDto) {

    const { limit = 10, offset = 0 } = paginationDto

    const products = await this.productRepository.findAndCount({
      take: limit,
      skip: offset,
      relations: {
        images: true,
      }
    })

    // const count = 

    return {
      data: products[0].map(product => ({
        ...product,
        images: product.images.map(img => img.url)
      })),
      count: products[1]
    }
  }

  async findOne(search: string) {
    let product: Product;
    if (isUUID(search)) {
      product = await this.productRepository.findOneBy({ id: search })
    } else {
      const queryBuilder = this.productRepository.createQueryBuilder('prod');
      product = await queryBuilder
        .where('UPPER(title) =:title or slug =:slug', {
          title: search.toUpperCase(),
          slug: search.toLowerCase()
        })
        .leftJoinAndSelect('prod.images', 'prodImages')
        .getOne()
    }

    if (!product) {
      throw new NotFoundException(`Product with id ${search} not found`);
    }
    return product

  }

  async findOnePLain(search: string) {
    const { images = [], ...product } = await this.findOne(search)

    return {
      ...product,
      images: images.map(img => img.url)
    }

  }

  async update(id: string, updateProductDto: UpdateProductDto) {

    const { images, ...update } = updateProductDto;

    const product = await this.productRepository.preload({
      id: id,
      ...update,
    })

    if (!product) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {

      if (images) {
        await queryRunner.manager.delete(ProductImage, { product: { id } })
        product.images = images.map(
          img => this.productImageRepository.create({ url: img })
        )
      }

      await queryRunner.manager.save(product)

      await queryRunner.commitTransaction();
      await queryRunner.release();
      // await this.productRepository.save(product)

      return this.findOnePLain(id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
      this.handleDBExceptions(error)
    }

  }

  async remove(id: string) {
    const product = await this.findOne(id)
    await this.productRepository.remove(product)

    return `Product with id ${id} delete successfull`




  }

  private handleDBExceptions(error: any) {
    if (error.code === '23505')
      throw new BadRequestException(error.detail);
    this.logger.error(error);
    throw new InternalServerErrorException('Ayuda');
  }

  async deleteAllProducts() {
    const query = this.productRepository.createQueryBuilder('product');

    try {
      return await query
        .delete()
        .where({})
        .execute();
    } catch (error) {
      this.handleDBExceptions(error)
    }
  }
}
