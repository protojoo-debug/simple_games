import './styles.css';
import { Game } from './core/Game';

const container = document.querySelector<HTMLElement>('#game');
const hudRoot = document.querySelector<HTMLElement>('#hud-root');

if (!container || !hudRoot) throw new Error('Game mount points are missing.');

new Game(container, hudRoot);
