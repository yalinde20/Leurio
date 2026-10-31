import { ApplicationInitStatus } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { appConfig } from './app.config';
import { FirebaseService } from './core/firebase/firebase.service';

describe('Démarrage de l\'app', () => {
  it('given une initialisation de Firebase qui échoue, when l\'app démarre, then le démarrage aboutit et l\'erreur est journalisée', async () => {
    const erreur = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    TestBed.configureTestingModule({
      providers: [
        ...(appConfig.providers as []),
        {
          provide: FirebaseService,
          useFactory: () => {
            throw new Error('Firebase indisponible');
          },
        },
      ],
    });

    await TestBed.inject(ApplicationInitStatus).donePromise;

    await vi.waitFor(() => expect(erreur).toHaveBeenCalled());
    expect(String(erreur.mock.calls[0][0])).toContain("Firebase n'a pas pu démarrer");
    erreur.mockRestore();
  });
});
