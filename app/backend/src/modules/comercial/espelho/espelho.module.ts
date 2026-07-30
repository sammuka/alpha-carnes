import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { EspelhoController } from './espelho.controller';
import { EspelhoService } from './espelho.service';

@Module({
  imports: [AuthModule],
  controllers: [EspelhoController],
  providers: [EspelhoService],
  exports: [EspelhoService],
})
export class EspelhoModule {}
