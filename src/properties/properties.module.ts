import { Module } from '@nestjs/common';
import { ListingLifecycleService } from './listing-lifecycle.service';
import { PropertiesController } from './properties.controller';
import { PropertiesService } from './properties.service';

@Module({
  controllers: [PropertiesController],
  providers: [PropertiesService, ListingLifecycleService],
  exports: [PropertiesService],
})
export class PropertiesModule {}
