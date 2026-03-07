import { Injectable } from '@nestjs/common';
import { File, Prisma } from '@prisma/client';
import { FileDatasource } from '../datasources/file.datasource';

@Injectable()
export class FileRepository {
  constructor(private readonly datasource: FileDatasource) {}

  async create(data: Prisma.FileCreateInput): Promise<File> {
    return this.datasource.create(data);
  }

  async findById(id: string): Promise<File | null> {
    return this.datasource.findById(id);
  }

  async deleteById(id: string): Promise<File> {
    return this.datasource.deleteById(id);
  }
}
