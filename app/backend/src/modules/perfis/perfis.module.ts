import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PerfisController } from './perfis.controller';
import { PerfisService } from './perfis.service';

@Module({
  imports: [AuthModule],
  controllers: [PerfisController],
  providers: [PerfisService],
})
export class PerfisModule {}
