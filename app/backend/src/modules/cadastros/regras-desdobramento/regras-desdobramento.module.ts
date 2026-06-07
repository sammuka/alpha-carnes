import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { RegrasDesdobramentoController } from './regras-desdobramento.controller';
import { RegrasDesdobramentoService } from './regras-desdobramento.service';

@Module({
  imports: [AuthModule],
  controllers: [RegrasDesdobramentoController],
  providers: [RegrasDesdobramentoService],
})
export class RegrasDesdobramentoModule {}
