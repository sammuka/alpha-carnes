import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { RepresentantesController } from './representantes.controller';
import { RepresentantesService } from './representantes.service';

@Module({
  imports: [AuthModule],
  controllers: [RepresentantesController],
  providers: [RepresentantesService],
})
export class RepresentantesModule {}
