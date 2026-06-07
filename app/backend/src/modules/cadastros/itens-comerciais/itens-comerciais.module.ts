import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { ItensComerciaisController } from './itens-comerciais.controller';
import { ItensComerciaisService } from './itens-comerciais.service';

@Module({
  imports: [AuthModule],
  controllers: [ItensComerciaisController],
  providers: [ItensComerciaisService],
})
export class ItensComerciaisModule {}
