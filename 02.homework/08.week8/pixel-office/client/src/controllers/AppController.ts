// Controller: decides which screen to show from the URL.
//   /            -> home (create or join a space)
//   /s/<id>      -> lobby (check camera, pick avatar) -> the space

import { SPACE_ID_RE } from '../../../shared/constants.ts';
import { loadSettings, rememberSpace, saveSettings } from '../models/SettingsModel.ts';
import { clear, toast } from '../views/dom.ts';
import { renderHome } from '../views/HomeView.ts';
import { LobbyView } from '../views/LobbyView.ts';
import { MediaController } from './MediaController.ts';
import { SpaceController } from './SpaceController.ts';

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
}

export class AppController {
  private readonly root: HTMLElement;
  private readonly settings = loadSettings();
  private readonly media = new MediaController();
  private lobby: LobbyView | null = null;
  private installPrompt: InstallPrompt | null = null;
  private inSpace = false;

  constructor(root: HTMLElement) {
    this.root = root;
    window.addEventListener('popstate', () => {
      // Leaving a space with the Back button: reload so the call and connection are closed cleanly.
      if (this.inSpace) location.reload();
      else this.route();
    });
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.installPrompt = e as InstallPrompt;
    });
  }

  route(): void {
    this.lobby?.dispose();
    this.lobby = null;
    this.media.stopAll();
    clear(this.root);
    const m = location.pathname.match(/^\/s\/([^/]+)\/?$/);
    const id = m?.[1] ?? '';
    if (m && SPACE_ID_RE.test(id)) this.showLobby(id);
    else this.showHome();
  }

  private go(path: string): void {
    history.pushState(null, '', path);
    this.route();
  }

  private showHome(): void {
    document.title = 'Pixel Office';
    renderHome(this.root, this.settings.recentSpaces, {
      open: (id) => this.go(`/s/${id}`),
      install: this.installPrompt
        ? () => {
            void this.installPrompt?.prompt();
            this.installPrompt = null;
          }
        : null,
    });
  }

  private showLobby(spaceId: string): void {
    document.title = `入室 - ${spaceId}`;
    this.lobby = new LobbyView(this.root, spaceId, this.media, this.settings, {
      back: () => this.go('/'),
      enter: () => void this.enter(spaceId),
    });
  }

  private async enter(spaceId: string): Promise<void> {
    saveSettings(this.settings);
    const host = document.createElement('div');
    host.className = 'space-host';
    const result = await SpaceController.join(host, spaceId, this.settings, this.media);
    if (typeof result === 'string') {
      toast(result, 'error', 6000);
      this.lobby?.enable();
      return;
    }
    this.inSpace = true;
    rememberSpace(this.settings, spaceId);
    this.lobby?.dispose();
    this.lobby = null;
    clear(this.root);
    this.root.append(host);
  }
}
