import Phaser from "phaser";
import { OfficeScene } from "./scenes/OfficeScene";

export function createCareerQuestGame(parent: HTMLElement) {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 900,
    height: 620,
    pixelArt: true,
    backgroundColor: "#161928",
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [OfficeScene],
  });
}
