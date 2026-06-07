import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { FornecedoresController } from './fornecedores.controller';
import { FornecedoresService } from './fornecedores.service';

@Module({
  imports: [AuthModule],
  controllers: [FornecedoresController],
  providers: [FornecedoresService],
})
export class FornecedoresModule {}
