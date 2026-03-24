import { Module } from '@nestjs/common';
import { LocationController } from '@components/locations/controllers/location.controller';
import { LocationService } from '@components/locations/services/location.service';

@Module({
  controllers: [LocationController],
  providers: [LocationService],
  exports: [LocationService]
})
export class LocationModule {}
