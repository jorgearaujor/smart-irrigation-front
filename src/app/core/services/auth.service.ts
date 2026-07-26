import { Injectable, computed, inject, signal } from '@angular/core';
import { initializeApp } from 'firebase/app';
import {
  Auth,
  User,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Usuario } from '../models/usuario.model';
import { UsuarioService } from './usuario.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth: Auth = getAuth(initializeApp(environment.firebase));
  private readonly usuarioService = inject(UsuarioService);
  private readonly authReadyPromise: Promise<void>;
  private profileReadyPromise: Promise<void> = Promise.resolve();

  readonly user = signal<User | null>(null);
  readonly profile = signal<Usuario | null>(null);
  readonly isAuthenticated = computed(() => this.user() !== null);
  readonly isAdmin = computed(() => this.profile()?.tipo === 'Administrador');

  constructor() {
    let resolveAuthReady!: () => void;
    this.authReadyPromise = new Promise((resolve) => {
      resolveAuthReady = resolve;
    });

    onAuthStateChanged(this.auth, (user) => {
      this.user.set(user);

      if (user) {
        this.profileReadyPromise = firstValueFrom(this.usuarioService.getMe())
          .then((profile) => {
            this.profile.set(profile);
          })
          .catch(() => {
            this.profile.set(null);
          });
      } else {
        this.profile.set(null);
        this.profileReadyPromise = Promise.resolve();
      }

      resolveAuthReady();
    });
  }

  waitForAuthReady(): Promise<void> {
    return this.authReadyPromise;
  }

  waitForProfileReady(): Promise<void> {
    return this.profileReadyPromise;
  }

  async signInWithEmail(email: string, senha: string): Promise<void> {
    await signInWithEmailAndPassword(this.auth, email, senha);
  }

  async signOut(): Promise<void> {
    await firebaseSignOut(this.auth);
  }

  getIdToken(): Promise<string | null> {
    const current = this.auth.currentUser;
    return current ? current.getIdToken() : Promise.resolve(null);
  }
}
