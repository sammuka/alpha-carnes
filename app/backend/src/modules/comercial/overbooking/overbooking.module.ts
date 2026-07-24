import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { OverbookingController } from './overbooking.controller';
import { OverbookingService } from './overbooking.service';

@Module({
  imports: [AuthModule],
  controllers: [OverbookingController],
  providers: [OverbookingService],
  exports: [OverbookingService],
})
export class OverbookingModule {}
