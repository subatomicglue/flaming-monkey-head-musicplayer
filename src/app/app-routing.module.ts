import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { PageNotFoundComponent } from './shared/components';

import { HomeRoutingModule } from './home/home-routing.module';
import { DetailRoutingModule } from './detail/detail-routing.module';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  },
  {
    path: '**',
    component: PageNotFoundComponent
  }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      relativeLinkResolution: 'legacy',
      // Restore the last scroll position
      scrollPositionRestoration: "enabled",
      scrollOffset: [0, 0],
      // Enable scrolling to anchors
      anchorScrolling: "enabled",
    }),
    HomeRoutingModule,
    DetailRoutingModule,
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
