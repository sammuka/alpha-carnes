import { HttpException, HttpStatus } from '@nestjs/common';

export class RegraContabilException extends HttpException {
  constructor(message: string) {
    super({ message }, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}
