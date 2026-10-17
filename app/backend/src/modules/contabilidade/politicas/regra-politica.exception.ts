import { HttpException, HttpStatus } from '@nestjs/common';

export class RegraPoliticaException extends HttpException {
  constructor(message: string, codigo: string) {
    super({ message, codigo }, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}

export class ConflitoPoliticaException extends HttpException {
  constructor(message: string, codigo: string) {
    super({ message, codigo }, HttpStatus.CONFLICT);
  }
}
