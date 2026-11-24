/*
 * Chargé avant chaque fichier de test (angular.json, `setupFiles`). Aucun test n'appelle un service réel : la mise en cache des
 * tuiles de carte (US 17), déclenchée par `SpotsService.ajouter` et `SortieService.preparer`, passerait sinon par le vrai `fetch`.
 * Un test qui veut observer les requêtes installe son propre double de `fetch`.
 */
beforeEach(() => {
  vi.stubGlobal('fetch', async () => new Response('', { status: 503 }));
});
