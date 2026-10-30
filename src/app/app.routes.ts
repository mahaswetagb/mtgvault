import { Routes } from '@angular/router';
import { DashboardComponent } from './dashboard.component';
import { CollectionComponent } from './collection.component';
import { AddComponent } from './add.component';
import { ScanComponent } from './scan.component';
import { LoginComponent } from './login.component';
import { authGuard } from './auth.service';
export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: '', pathMatch: 'full', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'collection', component: CollectionComponent, canActivate: [authGuard] },
  { path: 'add', component: AddComponent, canActivate: [authGuard] },
  { path: 'scan', component: ScanComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '' },
];
