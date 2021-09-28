import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Pipe, PipeTransform } from '@angular/core';

import { HomeRoutingModule } from './home-routing.module';

import { HomeComponent } from './home.component';
import { SharedModule } from '../shared/shared.module';

import { EncodeURIComponentPipe } from '../app.pipes'



@NgModule({
  declarations: [HomeComponent, EncodeURIComponentPipe],
  imports: [CommonModule, SharedModule, HomeRoutingModule]
})
export class HomeModule {}
