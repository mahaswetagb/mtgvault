import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
// Hash routing (#/collection) so deep links work on GitHub Pages without server rewrites.
bootstrapApplication(AppComponent, { providers: [provideRouter(routes, withHashLocation()), provideHttpClient()] });
