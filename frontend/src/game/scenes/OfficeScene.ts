import Phaser from "phaser";
import type { Agent, AgentStatus } from "../../types";
import { gameEvents, selectAgent } from "../events";

type Point = { x: number; y: number };
type AvatarParts = {
  sprite: Phaser.GameObjects.Image;
  badge: Phaser.GameObjects.Text;
  action: Phaser.GameObjects.Text;
  effect: Phaser.GameObjects.Text;
  prop: Phaser.GameObjects.Container;
  speech: Phaser.GameObjects.Container;
  speechText: Phaser.GameObjects.Text;
};

const TILE_W = 32;
const TILE_H = 16;
const stationTiles: Record<string, { point: Point; label: string; action: string; sitting: boolean }> = {
  control_room: { point: { x: 382, y: 159 }, label: "01 STRATEGY ROOM", action: "PLANNING THE WEEK", sitting: true },
  masters_archive: { point: { x: 603, y: 160 }, label: "02 MASTERS ARCHIVE", action: "RESEARCHING PROGRAMMES", sitting: false },
  mail_room: { point: { x: 190, y: 304 }, label: "03 GREEN MAIL ROOM", action: "DRAFTING EMAIL", sitting: true },
  tfg_laboratory: { point: { x: 749, y: 331 }, label: "04 TFG LABORATORY", action: "ANALYSING SAMPLES", sitting: true },
  food_kitchen: { point: { x: 280, y: 515 }, label: "05 BRASA'S KITCHEN", action: "COOKING THE PLAN", sitting: false },
  portfolio_workshop: { point: { x: 590, y: 503 }, label: "06 PORTFOLIO WORKSHOP", action: "BUILDING PORTFOLIO", sitting: true },
};
const startTiles: Record<string, Point> = {
  chronos: { x: 382, y: 159 }, atlas: { x: 603, y: 160 }, echo: { x: 190, y: 304 },
  nova: { x: 749, y: 331 }, brasa: { x: 280, y: 515 }, pixel: { x: 590, y: 503 },
};
const NAV_NODES: Record<string, Point> = {
  control: { x: 382, y: 159 }, controlDoor: { x: 437, y: 237 },
  archive: { x: 603, y: 160 }, archiveDoor: { x: 530, y: 237 },
  upperHall: { x: 480, y: 275 }, centre: { x: 480, y: 350 },
  mailDoor: { x: 326, y: 353 }, mail: { x: 190, y: 304 },
  labDoor: { x: 641, y: 365 }, lab: { x: 749, y: 331 },
  kitchenDoor: { x: 409, y: 438 }, kitchen: { x: 280, y: 515 },
  workshopDoor: { x: 568, y: 438 }, workshop: { x: 590, y: 503 },
};
const NAV_EDGES: Record<string, string[]> = {
  control: ["controlDoor"], controlDoor: ["control", "upperHall"],
  archive: ["archiveDoor"], archiveDoor: ["archive", "upperHall"],
  upperHall: ["controlDoor", "archiveDoor", "centre"],
  centre: ["upperHall", "mailDoor", "labDoor", "kitchenDoor", "workshopDoor"],
  mailDoor: ["centre", "mail"], mail: ["mailDoor"],
  labDoor: ["centre", "lab"], lab: ["labDoor"],
  kitchenDoor: ["centre", "kitchen"], kitchen: ["kitchenDoor"],
  workshopDoor: ["centre", "workshop"], workshop: ["workshopDoor"],
};
const AGENT_HOME: Record<string, string> = { chronos: "control", atlas: "archive", echo: "mail", nova: "lab", brasa: "kitchen", pixel: "workshop" };
const AGENT_ROOM: Record<string, string> = { chronos: "control_room", atlas: "masters_archive", echo: "mail_room", nova: "tfg_laboratory", brasa: "food_kitchen", pixel: "portfolio_workshop" };
const AGENT_EFFECTS: Record<string, string> = {
  atlas: "◆  ◆  ◆", nova: "✦  +  ✦", echo: "✉  ···  ➜", chronos: "◷  03:14", pixel: "⚙  ✦  ⚙",
};
AGENT_EFFECTS.brasa = "♨  ·  ♨";

export class OfficeScene extends Phaser.Scene {
  private avatars = new Map<string, Phaser.GameObjects.Container>();
  private parts = new Map<string, AvatarParts>();
  private selectedAgent = "chronos";
  private selectionRing?: Phaser.GameObjects.Ellipse;
  private destinationMarker?: Phaser.GameObjects.Polygon;
  private resultHud?: Phaser.GameObjects.Container;
  private resultTitle?: Phaser.GameObjects.Text;
  private resultBody?: Phaser.GameObjects.Text;
  private resultNext?: Phaser.GameObjects.Text;
  private listeners: Array<[string, EventListener]> = [];
  private activeMissions = new Set<string>();
  private moving = new Set<string>();
  private doors = new Map<string, Phaser.GameObjects.Container>();

  constructor() { super("office"); }

  preload() {
    this.load.image("modular-hq", `${import.meta.env.BASE_URL}assets/modular-hq-clean.png`);
    ["atlas", "nova", "echo", "chronos", "pixel", "brasa"].forEach(agentId =>
      this.load.image(`agent-${agentId}`, `${import.meta.env.BASE_URL}assets/agents/${agentId}.png`));
  }

  create() {
    this.cameras.main.setBackgroundColor("#10171a");
    this.drawBackdrop();
    this.add.image(450, 310, "modular-hq").setDisplaySize(900, 600).setDepth(-500);
    ["controlDoor", "archiveDoor", "mailDoor", "labDoor", "kitchenDoor", "workshopDoor"].forEach(id =>
      this.createDoor(id, NAV_NODES[id]));
    this.selectionRing = this.add.ellipse(0, 0, 31, 13).setStrokeStyle(2, 0xffdc74).setFillStyle(0xffdc74, 0.16).setDepth(700);
    this.destinationMarker = this.add.polygon(0, 0, [0, -8, 16, 0, 0, 8, -16, 0], 0xffdc74, 0.34).setVisible(false).setDepth(20);
    this.createResultHud();

    this.listen("agents-sync", (event: Event) => this.sync((event as CustomEvent<Agent[]>).detail));
    this.listen("agent-move", (event: Event) => {
      const detail = (event as CustomEvent<{ agentId: string; room: string }>).detail;
      this.moveToStation(detail.agentId, detail.room);
    });
    this.listen("agent-status", (event: Event) => {
      const detail = (event as CustomEvent<{ agentId: string; status: AgentStatus }>).detail;
      this.setStatus(detail.agentId, detail.status);
    });
    this.listen("agent-focused", (event: Event) => this.focusAgent((event as CustomEvent<string>).detail));
    this.listen("agent-dialogue", (event: Event) => {
      const detail = (event as CustomEvent<{ agentId: string; message: string; tone: "mission" | "working" | "result" }>).detail;
      this.showDialogue(detail.agentId, detail.message, detail.tone);
    });
    this.listen("map-result", (event: Event) => this.showResultHud((event as CustomEvent<{
      agentId: string; agentName: string; title: string; summary: string; nextStep?: string; approval?: boolean;
    }>).detail));
    this.listen("map-feedback-clear", () => this.clearMapFeedback());

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (!this.floorContains(pointer.x, pointer.y)) return;
      this.walkFreely(this.selectedAgent, { x: pointer.x, y: pointer.y });
    });
    this.time.addEvent({ delay: 2800, loop: true, callback: () => this.roamOneAgent() });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.listeners.forEach(([name, listener]) => gameEvents.removeEventListener(name, listener));
    });
  }

  private listen(name: string, callback: EventListener) {
    this.listeners.push([name, callback]);
    gameEvents.addEventListener(name, callback);
  }

  private iso(tileX: number, tileY: number): Point {
    return { x: 450 + (tileX - tileY) * TILE_W / 2, y: 90 + (tileX + tileY) * TILE_H / 2 };
  }

  private drawModularArchitecture() {
    const modules = [
      { x: 330, y: 176, cols: 8, rows: 7, floor: 0x684833 },
      { x: 585, y: 176, cols: 8, rows: 7, floor: 0x62452f },
      { x: 185, y: 345, cols: 8, rows: 7, floor: 0x4d5b3d },
      { x: 715, y: 345, cols: 8, rows: 7, floor: 0x3e5551 },
      { x: 270, y: 495, cols: 8, rows: 7, floor: 0x70472f },
      { x: 585, y: 495, cols: 9, rows: 7, floor: 0x584653 },
    ];
    this.drawBuildingBase();
    this.drawCorridor();
    modules.forEach(module => this.drawModule(module.x, module.y, module.cols, module.rows, module.floor));
    ["controlDoor", "archiveDoor", "mailDoor", "labDoor", "kitchenDoor", "workshopDoor"].forEach(id =>
      this.createDoor(id, NAV_NODES[id]));
  }

  private drawBuildingBase() {
    const g = this.add.graphics().setDepth(-250);
    g.fillStyle(0x090d0f, 0.62);
    g.beginPath().moveTo(300, 70).lineTo(690, 120).lineTo(865, 330).lineTo(720, 555)
      .lineTo(560, 598).lineTo(405, 560).lineTo(250, 598).lineTo(55, 390).lineTo(90, 285)
      .closePath().fillPath();
    g.fillStyle(0x514033, 1).lineStyle(4, 0x201917, 1);
    g.beginPath().moveTo(310, 82).lineTo(675, 128).lineTo(845, 330).lineTo(702, 542)
      .lineTo(570, 580).lineTo(410, 542).lineTo(270, 580).lineTo(74, 385).lineTo(105, 294)
      .closePath().fillPath().strokePath();
  }

  private drawModule(cx: number, cy: number, cols: number, rows: number, floorColor: number) {
    const halfW = cols * TILE_W / 2, halfH = rows * TILE_H / 2;
    const foundation = this.add.graphics().setDepth(cy - 150);
    foundation.fillStyle(0x352721, 1).lineStyle(3, 0x171516, 1);
    foundation.beginPath().moveTo(cx, cy - halfH - 6).lineTo(cx + halfW + 8, cy).lineTo(cx, cy + halfH + 11)
      .lineTo(cx - halfW - 8, cy).closePath().fillPath().strokePath();
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
      const x = cx + (col - row) * TILE_W / 2 + (rows - cols) * TILE_W / 4;
      const y = cy - halfH + TILE_H / 2 + (col + row) * TILE_H / 2;
      const shade = (row + col) % 2 ? floorColor : Phaser.Display.Color.ValueToColor(floorColor).darken(7).color;
      this.add.polygon(x, y, [0, -TILE_H / 2, TILE_W / 2, 0, 0, TILE_H / 2, -TILE_W / 2, 0], shade)
        .setStrokeStyle(1, 0x2f2825, 0.65).setDepth(y - 120);
    }
    const walls = this.add.graphics().setDepth(cy - 70);
    const wallH = 58;
    walls.fillStyle(0x9a7457, 1).lineStyle(3, 0x352720, 1);
    walls.beginPath().moveTo(cx, cy - halfH).lineTo(cx - halfW, cy).lineTo(cx - halfW, cy - wallH)
      .lineTo(cx, cy - halfH - wallH).closePath().fillPath().strokePath();
    walls.fillStyle(0xb18a64, 1);
    walls.beginPath().moveTo(cx, cy - halfH).lineTo(cx + halfW, cy).lineTo(cx + halfW, cy - wallH)
      .lineTo(cx, cy - halfH - wallH).closePath().fillPath().strokePath();
    walls.lineStyle(1, 0x694a3b, 0.65);
    for (let i = 1; i < cols; i++) walls.lineBetween(cx + i * TILE_W / 2, cy - halfH + i * TILE_H / 2, cx + i * TILE_W / 2, cy - halfH + i * TILE_H / 2 - wallH);
    for (let i = 1; i < rows; i++) walls.lineBetween(cx - i * TILE_W / 2, cy - halfH + i * TILE_H / 2, cx - i * TILE_W / 2, cy - halfH + i * TILE_H / 2 - wallH);
    walls.lineStyle(3, 0xd0a776, 0.6).lineBetween(cx - halfW + 5, cy - wallH + 2, cx, cy - halfH - wallH + 2)
      .lineBetween(cx, cy - halfH - wallH + 2, cx + halfW - 5, cy - wallH + 2);
    this.drawWallLamp(cx - halfW * 0.48, cy - halfH * 0.52 - 31, cy - 68);
    this.drawWallLamp(cx + halfW * 0.48, cy - halfH * 0.52 - 31, cy - 67);
  }

  private drawCorridor() {
    const g = this.add.graphics().setDepth(-40);
    const paths: Array<[Point, Point]> = [
      [NAV_NODES.control, NAV_NODES.upperHall], [NAV_NODES.archive, NAV_NODES.upperHall],
      [NAV_NODES.upperHall, NAV_NODES.centre], [NAV_NODES.mail, NAV_NODES.centre],
      [NAV_NODES.lab, NAV_NODES.centre], [NAV_NODES.kitchen, NAV_NODES.centre],
      [NAV_NODES.workshop, NAV_NODES.centre],
    ];
    paths.forEach(([from, to]) => {
      g.lineStyle(58, 0x2b211d, 1).lineBetween(from.x, from.y, to.x, to.y);
      g.lineStyle(50, 0x685443, 1).lineBetween(from.x, from.y, to.x, to.y);
      g.lineStyle(1, 0x9a7b5f, 0.55).lineBetween(from.x, from.y - 8, to.x, to.y - 8);
      g.lineStyle(1, 0x2c2521, 0.7).lineBetween(from.x, from.y + 8, to.x, to.y + 8);
    });
    g.fillStyle(0x685443, 1).lineStyle(4, 0x2b211d, 1);
    g.beginPath().moveTo(460, 275).lineTo(610, 335).lineTo(530, 414).lineTo(382, 414).lineTo(310, 335)
      .closePath().fillPath().strokePath();
    g.lineStyle(1, 0x75604d, 0.5);
    for (let y = 300; y < 405; y += 16) g.lineBetween(355, y, 565, y);
    this.add.text(460, 334, "CENTRAL HUB", { fontFamily: "monospace", fontSize: "9px", color: "#d8b47a" })
      .setOrigin(0.5).setDepth(20);
  }

  private drawWallLamp(x: number, y: number, depth: number) {
    const glow = this.add.circle(x, y, 23, 0xffc86c, 0.12).setDepth(depth - 1);
    const g = this.add.graphics().setDepth(depth);
    g.fillStyle(0x3b2a21, 1).fillRect(x - 6, y - 2, 12, 17);
    g.fillStyle(0xffd98a, 1).lineStyle(2, 0x7a4a28, 1).fillRoundedRect(x - 8, y - 11, 16, 13, 3).strokeRoundedRect(x - 8, y - 11, 16, 13, 3);
    this.tweens.add({ targets: glow, alpha: 0.2, scale: 1.12, duration: 1200, yoyo: true, repeat: -1 });
  }

  private createDoor(id: string, point: Point) {
    const panel = this.add.graphics();
    panel.fillStyle(0x593720, 1).lineStyle(2, 0xe0a45f, 1).fillRoundedRect(-15, -39, 30, 42, 3).strokeRoundedRect(-15, -39, 30, 42, 3);
    panel.fillStyle(0xf0bd63, 1).fillCircle(9, -18, 2);
    const frame = this.add.graphics();
    frame.lineStyle(4, 0x35231e, 1).strokeRect(-18, -42, 36, 45);
    const door = this.add.container(point.x, point.y, [frame, panel]).setDepth(point.y + 40);
    panel.setName("panel");
    this.doors.set(id, door);
  }

  private openDoor(id: string, onComplete: () => void) {
    const door = this.doors.get(id);
    const panel = door?.getByName("panel") as Phaser.GameObjects.Graphics | undefined;
    if (!door || !panel) { onComplete(); return; }
    this.tweens.killTweensOf(panel);
    this.tweens.add({ targets: panel, scaleX: 0.14, x: -13, duration: 220, ease: "Sine.Out", onComplete: () => {
      onComplete();
      this.time.delayedCall(420, () => this.tweens.add({ targets: panel, scaleX: 1, x: 0, duration: 260, ease: "Sine.InOut" }));
    } });
  }

  private drawRoomLabels() {
    const labels = [
      { x: 330, y: 92, text: "01  STRATEGY · CHRONOS", color: "#f0c75e" },
      { x: 595, y: 92, text: "02  ARCHIVE · ATLAS", color: "#6ebcf0" },
      { x: 170, y: 273, text: "03  GREEN MAIL · ECHO", color: "#e77965" },
      { x: 730, y: 273, text: "04  TFG LAB · NOVA", color: "#72cf9b" },
      { x: 250, y: 435, text: "05  KITCHEN · BRASA", color: "#ed955c" },
      { x: 605, y: 435, text: "06  WORKSHOP · PIXEL", color: "#bd8ee6" },
    ];
    labels.forEach(label => {
      this.add.text(label.x, label.y, label.text, {
        fontFamily: "monospace", fontSize: "10px", fontStyle: "bold", color: label.color,
        backgroundColor: "#251713dd", padding: { x: 7, y: 4 },
      }).setOrigin(0.5).setDepth(800);
    });
    this.add.text(28, 22, "CAREER\nQUEST", {
      fontFamily: "monospace", fontSize: "18px", fontStyle: "bold", align: "center",
      color: "#ffd28a", stroke: "#432518", strokeThickness: 5,
    }).setDepth(900);
    this.add.text(29, 71, "HQ · LIVE", {
      fontFamily: "monospace", fontSize: "9px", color: "#82dd91",
      backgroundColor: "#251713cc", padding: { x: 6, y: 3 },
    }).setDepth(900);
  }

  private drawConnections() {
    const g = this.add.graphics().setDepth(90);
    const doorways = [
      { x: 392, y: 322, angle: -1 }, { x: 513, y: 322, angle: 1 },
      { x: 352, y: 398, angle: -1 }, { x: 430, y: 407, angle: 0 }, { x: 552, y: 398, angle: 1 },
    ];
    doorways.forEach(door => {
      g.fillStyle(0xf6c86d, 0.28).lineStyle(2, 0xffd988, 0.65);
      g.fillRoundedRect(door.x - 18, door.y - 7, 36, 14, 4).strokeRoundedRect(door.x - 18, door.y - 7, 36, 14, 4);
      g.lineStyle(2, 0x6f3d25, 0.7).lineBetween(door.x - 12, door.y, door.x + 12, door.y);
    });
    for (let i = 0; i < 4; i++) {
      g.fillStyle(i % 2 ? 0xb36b3e : 0xd48a4c, 0.88).lineStyle(1, 0xf2bd70, 0.8);
      g.fillRect(425 + i * 14, 349 + i * 8, 40, 8).strokeRect(425 + i * 14, 349 + i * 8, 40, 8);
    }
    this.add.text(452, 373, "CENTRAL STAIRS", {
      fontFamily: "monospace", fontSize: "7px", color: "#ffd990", backgroundColor: "#2b1712bb", padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(92);
  }

  private drawCanteenPortal() {
    const g = this.add.graphics().setDepth(85);
    g.fillStyle(0x251713, 0.86).lineStyle(3, 0xe0a05b, 0.92);
    g.fillRoundedRect(744, 414, 146, 112, 12).strokeRoundedRect(744, 414, 146, 112, 12);
    g.fillStyle(0x315f5c, 1).lineStyle(2, 0x173b3a, 1);
    g.fillRoundedRect(757, 453, 120, 53, 7).strokeRoundedRect(757, 453, 120, 53, 7);
    g.fillStyle(0xd07a49, 1).fillRect(752, 448, 130, 10);
    g.fillStyle(0x25252a, 1).lineStyle(2, 0xf1c676, 1).fillEllipse(804, 448, 42, 14).strokeEllipse(804, 448, 42, 14);
    g.fillStyle(0x75402f, 1).fillRect(784, 428, 40, 19);
    g.lineStyle(3, 0xf3d8aa, 0.75).lineBetween(794, 426, 790, 416).lineBetween(805, 426, 809, 413).lineBetween(816, 426, 820, 417);
    this.add.text(817, 471, "06\nCANTEEN", {
      fontFamily: "monospace", fontSize: "9px", fontStyle: "bold", align: "center", color: "#ffe5a6",
    }).setOrigin(0.5).setDepth(90);
    this.add.text(817, 516, "FOODTRUCK PORTAL", {
      fontFamily: "monospace", fontSize: "7px", color: "#7ee0c2", backgroundColor: "#241411dd", padding: { x: 5, y: 2 },
    }).setOrigin(0.5).setDepth(91);
  }

  private drawBackdrop() {
    const g = this.add.graphics().setDepth(-1000);
    g.fillGradientStyle(0x4d303e, 0x4d303e, 0x251d2a, 0x251d2a, 1).fillRect(0, 0, 900, 620);
    for (let i = 0; i < 80; i++) g.fillStyle(i % 5 === 0 ? 0x6f4350 : 0x352431, 0.22)
      .fillRect((i * 97) % 900, (i * 53) % 620, 2, 2);
    this.add.text(28, 24, "CAREER QUEST HQ", {
      fontFamily: "monospace", fontSize: "18px", fontStyle: "bold", color: "#f5dfad",
      backgroundColor: "#2a1d28", padding: { x: 10, y: 7 },
    }).setDepth(1000);
    this.add.text(29, 63, "CLICK FLOOR TO WALK  •  ASSIGN A MISSION TO USE A STATION", {
      fontFamily: "monospace", fontSize: "10px", color: "#cbaeb0",
    }).setDepth(1000);
  }

  private drawWindow(x: number, y: number) {
    const g = this.add.graphics().setDepth(40);
    g.fillStyle(0x5b3541).fillRect(x - 67, y - 8, 134, 82);
    g.fillStyle(0x6bb4bb).fillRect(x - 59, y, 118, 64);
    g.fillStyle(0xa8d8cc).fillTriangle(x - 59, y, x + 59, y, x - 59, y + 54);
    g.lineStyle(5, 0xf3d38f).lineBetween(x, y, x, y + 64).lineBetween(x - 59, y + 32, x + 59, y + 32);
    g.fillStyle(0xe5bb78).fillRect(x - 68, y + 64, 136, 10);
  }

  private drawWallBoard(x: number, y: number) {
    const g = this.add.graphics().setDepth(55);
    g.fillStyle(0x553841).fillRect(x, y, 116, 62);
    g.fillStyle(0x183544).fillRect(x + 6, y + 6, 104, 50);
    [0, 1, 2, 3].forEach(i => g.fillStyle([0x72d7b1, 0xffd06a, 0xed817e, 0x76a9e5][i])
      .fillRect(x + 14, y + 14 + i * 9, 17 + i * 15, 5));
  }

  private drawStations() {
    this.drawStrategyFurniture(); this.drawArchiveFurniture(); this.drawMailFurniture();
    this.drawLabFurniture(); this.drawKitchenFurniture(); this.drawWorkshopFurniture();
  }

  private drawRug(x: number, y: number, w: number, h: number, color: number, depth: number) {
    const g = this.add.graphics().setDepth(depth);
    g.fillStyle(0x211a18, 0.45).fillEllipse(x + 3, y + 5, w + 8, h + 6);
    g.fillStyle(color, 0.92).lineStyle(2, 0xd0a15e, 0.7).fillEllipse(x, y, w, h).strokeEllipse(x, y, w, h);
    g.lineStyle(1, 0xf0cf88, 0.4).strokeEllipse(x, y, w - 12, h - 8);
  }

  private drawSofa(x: number, y: number, color: number) {
    this.isoBox(x, y, 82, 28, 18, color, 0x344633, 0x41543e, y + 8);
    const g = this.add.graphics().setDepth(y + 7);
    g.fillStyle(color).lineStyle(2, 0x25231f).fillRoundedRect(x - 42, y - 37, 84, 28, 7).strokeRoundedRect(x - 42, y - 37, 84, 28, 7);
    g.lineStyle(2, 0xc4a76d, 0.4).lineBetween(x, y - 35, x, y - 11);
    g.fillStyle(0xd6b776).fillRoundedRect(x + 17, y - 30, 17, 14, 3);
  }

  private drawStrategyFurniture() {
    this.drawRug(330, 187, 118, 50, 0x315e63, 187);
    this.isoBox(330, 164, 104, 46, 24, 0x8d6749, 0x5d4237, 0x75513f, 205);
    const g = this.add.graphics().setDepth(204);
    g.fillStyle(0x193943).lineStyle(3, 0xd6a75a).fillRect(292, 105, 76, 39).strokeRect(292, 105, 76, 39);
    g.fillStyle(0x63d2af).fillRect(300, 113, 24, 6).fillRect(300, 128, 53, 5);
    g.fillStyle(0xe3be67).fillRect(337, 113, 18, 6);
    g.fillStyle(0x4d9ba4, 0.75).lineStyle(1, 0x9ed9d4, 0.8).fillRect(299, 150, 62, 25).strokeRect(299, 150, 62, 25);
    g.lineBetween(305, 164, 354, 154).lineBetween(311, 152, 344, 171);
    this.drawChair(330, 210, 0x725f50); this.drawPlant(252, 178); this.drawPlant(402, 176);
    this.isoBox(265, 151, 36, 22, 31, 0x725038, 0x4d3429, 0x5d3d2e, 181);
  }

  private drawArchiveFurniture() {
    [532, 560, 588, 616, 644].forEach((x, index) => {
      const g = this.add.graphics().setDepth(195 + index);
      g.fillStyle(0x583b2c).lineStyle(2, 0x2d211d).fillRect(x - 13, 111, 26, 66).strokeRect(x - 13, 111, 26, 66);
      [0, 1, 2].forEach(row => { g.fillStyle([0xb45f4e, 0xd2a54f, 0x4f7996][(row + index) % 3]).fillRect(x - 9, 119 + row * 18, 18, 13); });
    });
    this.drawRug(592, 193, 108, 42, 0x745126, 188);
    this.isoBox(592, 176, 78, 32, 21, 0x9b714a, 0x684632, 0x7c5539, 205);
    const g = this.add.graphics().setDepth(210);
    g.lineStyle(4, 0xb68753, 1).lineBetween(527, 117, 553, 180).lineBetween(539, 117, 565, 180);
    [0, 1, 2, 3].forEach(i => g.lineStyle(2, 0xe0b06c, 1).lineBetween(532 + i * 5, 130 + i * 12, 549 + i * 5, 130 + i * 12));
    g.fillStyle(0x4f85a0).lineStyle(2, 0xcfaa62).fillCircle(652, 183, 15).strokeCircle(652, 183, 15);
    g.lineStyle(2, 0x9f713d).lineBetween(652, 198, 652, 211).lineBetween(640, 212, 664, 212);
    this.drawPlant(516, 180);
  }

  private drawMailFurniture() {
    this.drawRug(180, 365, 120, 48, 0x54643a, 350);
    this.drawSofa(145, 343, 0x536a3e);
    this.isoBox(185, 336, 82, 32, 21, 0x896044, 0x583b31, 0x704839, 380);
    const g = this.add.graphics().setDepth(378);
    g.fillStyle(0xf0dba8).lineStyle(2, 0x673f31).fillRect(160, 310, 24, 16).strokeRect(160, 310, 24, 16);
    g.fillStyle(0x41634c).fillRect(214, 290, 38, 49);
    [0, 1, 2].forEach(i => g.fillStyle(0xe7d79e).fillRect(220, 297 + i * 13, 25, 8));
    g.fillStyle(0x2d4935).lineStyle(2, 0xc99c58).fillRect(95, 292, 29, 48).strokeRect(95, 292, 29, 48);
    [0, 1, 2].forEach(i => g.fillStyle(0xd7c78e).fillRect(101, 300 + i * 12, 17, 7));
    this.drawChair(205, 382, 0x506a4d); this.drawPlant(112, 350); this.drawPlant(252, 350); this.drawPlant(125, 313);
  }

  private drawLabFurniture() {
    this.drawRug(715, 365, 128, 48, 0x315a58, 350);
    this.isoBox(715, 337, 105, 34, 23, 0xa4aaa0, 0x60706d, 0x7c8580, 382);
    const g = this.add.graphics().setDepth(380);
    g.fillStyle(0xbadbd3).lineStyle(2, 0x284b50).fillRect(684, 296, 7, 31).strokeRect(684, 296, 7, 31);
    g.fillStyle(0x68cbb4).fillCircle(687, 295, 7).fillCircle(710, 313, 6).fillCircle(730, 308, 5);
    g.fillStyle(0x183c47).fillRect(746, 286, 38, 34); g.fillStyle(0x62d5c3).fillRect(751, 291, 28, 22);
    g.fillStyle(0x365956).fillRect(651, 296, 25, 48).fillRect(785, 296, 25, 48);
    [0, 1, 2].forEach(i => { g.fillStyle(0xb5d6cf).fillRect(656, 302 + i * 12, 15, 7); g.fillStyle(0x72d5c0).fillCircle(797, 307 + i * 12, 5); });
    g.lineStyle(3, 0xb9d8d1).lineBetween(665, 289, 665, 266).lineBetween(790, 290, 790, 264);
    g.fillStyle(0x5ccab7, 0.65).fillRoundedRect(657, 254, 16, 29, 6).fillRoundedRect(782, 250, 17, 33, 6);
    this.drawChair(715, 382, 0x416b66);
  }

  private drawKitchenFurniture() {
    this.drawRug(270, 520, 122, 48, 0x7a4a2a, 500);
    this.isoBox(270, 488, 96, 38, 24, 0xa87549, 0x694430, 0x83553a, 535);
    const g = this.add.graphics().setDepth(532);
    g.fillStyle(0x333b3c).lineStyle(2, 0xe1b56c).fillEllipse(270, 470, 35, 12).strokeEllipse(270, 470, 35, 12);
    g.fillStyle(0x7d3d29).fillRect(254, 456, 32, 14);
    g.fillStyle(0xd8d3bc).lineStyle(2, 0x414443).fillRect(196, 441, 38, 58).strokeRect(196, 441, 38, 58); g.fillStyle(0x65a99c).fillRect(202, 450, 26, 17);
    g.lineStyle(2, 0x8d8b7e).lineBetween(196, 473, 234, 473);
    g.fillStyle(0x553729).lineStyle(2, 0x2c211c).fillRect(312, 443, 42, 56).strokeRect(312, 443, 42, 56); g.fillStyle(0xe0a95e).fillCircle(342, 470, 4);
    g.fillStyle(0xe6c27b).fillCircle(245, 484, 6).fillCircle(258, 481, 5).fillCircle(286, 483, 7);
    g.fillStyle(0x90522f).fillRect(220, 424, 118, 12); g.fillStyle(0xc7854e).fillRect(224, 427, 110, 5);
    this.drawKitchenSteam(270, 451);
    this.drawChair(238, 528, 0x81543b); this.drawChair(304, 528, 0x81543b);
  }

  private drawKitchenSteam(x: number, y: number) {
    [0, 1, 2].forEach(i => {
      const puff = this.add.circle(x - 10 + i * 10, y, 3 + i, 0xf4ead4, 0.72).setDepth(540);
      this.tweens.add({ targets: puff, y: y - 20 - i * 4, alpha: 0.08, scale: 1.6, duration: 1100 + i * 180, repeat: -1, delay: i * 240 });
    });
  }

  private drawWorkshopFurniture() {
    this.drawRug(585, 522, 145, 48, 0x5c435e, 500);
    this.isoBox(585, 488, 120, 38, 24, 0x785b47, 0x4e3933, 0x63463a, 535);
    const g = this.add.graphics().setDepth(532);
    g.fillStyle(0x254454).lineStyle(2, 0xb18bd0).fillRect(548, 445, 45, 30).strokeRect(548, 445, 45, 30);
    g.fillStyle(0x5fb8cf).fillRect(554, 451, 33, 18);
    g.fillStyle(0x684c3c).fillRect(617, 442, 54, 35);
    [0, 1, 2].forEach(i => g.fillStyle([0xd4a34f, 0x7fb3ca, 0xc96f61][i]).fillCircle(629 + i * 14, 455, 4));
    g.fillStyle(0x4c3733).lineStyle(2, 0x2b2423).fillRect(674, 442, 35, 59).strokeRect(674, 442, 35, 59);
    [0, 1, 2, 3].forEach(i => g.fillStyle(0xc89b57).fillCircle(684 + (i % 2) * 14, 453 + Math.floor(i / 2) * 18, 3));
    g.lineStyle(4, 0x7e705e).lineBetween(515, 463, 525, 438).lineBetween(525, 438, 539, 463);
    g.fillStyle(0x8f5a37).fillRect(515, 463, 25, 7);
    this.drawChair(585, 532, 0x675276); this.drawPlant(660, 492);
  }

  private isoBox(x: number, y: number, w: number, d: number, h: number, top: number, left: number, right: number, depth = y) {
    const g = this.add.graphics().setDepth(depth);
    g.fillStyle(left).lineStyle(2, 0x3c2730);
    g.beginPath().moveTo(x - w / 2, y).lineTo(x, y + d / 2).lineTo(x, y + d / 2 + h)
      .lineTo(x - w / 2, y + h).closePath().fillPath().strokePath();
    g.fillStyle(right);
    g.beginPath().moveTo(x + w / 2, y).lineTo(x, y + d / 2).lineTo(x, y + d / 2 + h)
      .lineTo(x + w / 2, y + h).closePath().fillPath().strokePath();
    g.fillStyle(top);
    g.beginPath().moveTo(x, y - d / 2).lineTo(x + w / 2, y).lineTo(x, y + d / 2)
      .lineTo(x - w / 2, y).closePath().fillPath().strokePath();
    return g;
  }

  private drawChair(x: number, y: number, color = 0x526578) {
    this.isoBox(x, y, 32, 18, 16, color, 0x344352, 0x425567, y + 4);
    const g = this.add.graphics().setDepth(y + 3);
    g.fillStyle(color).lineStyle(2, 0x34242c).fillRect(x - 16, y - 30, 32, 28).strokeRect(x - 16, y - 30, 32, 28);
  }

  private drawControlStation() {
    const p = this.iso(7, 1);
    this.isoBox(p.x, p.y, 170, 42, 30, 0x8d6749, 0x5d4237, 0x75513f, p.y);
    const g = this.add.graphics().setDepth(p.y - 2);
    g.fillStyle(0x263f50).lineStyle(3, 0x33252c).fillRect(p.x - 56, p.y - 72, 112, 57).strokeRect(p.x - 56, p.y - 72, 112, 57);
    g.fillStyle(0x56d8b2).fillRect(p.x - 46, p.y - 62, 31, 8).fillRect(p.x - 46, p.y - 47, 72, 6);
    g.fillStyle(0xffd16d).fillRect(p.x + 12, p.y - 62, 30, 8);
    this.drawChair(this.iso(7, 3).x, this.iso(7, 3).y);
  }

  private drawArchive() {
    const p = this.iso(1, 3);
    this.isoBox(p.x, p.y - 12, 74, 24, 83, 0x8d5c3e, 0x5d3d35, 0x744a39, p.y);
    const g = this.add.graphics().setDepth(p.y + 2);
    for (let row = 0; row < 3; row++) {
      g.fillStyle(0x3e2930).fillRect(p.x - 29, p.y - 2 + row * 23, 58, 4);
      for (let i = 0; i < 6; i++) g.fillStyle([0x6b8db3, 0xc4615d, 0xdda951, 0x71946d][(row + i) % 4])
        .fillRect(p.x - 27 + i * 9, p.y - 20 + row * 23, 7, 18);
    }
    const desk = this.iso(3, 4);
    this.isoBox(desk.x, desk.y, 94, 35, 25, 0xa5764f, 0x694538, 0x845a42);
    g.fillStyle(0xead395).fillRect(desk.x - 20, desk.y - 17, 34, 20);
  }

  private drawLaboratory() {
    const p = this.iso(12, 3);
    this.isoBox(p.x, p.y, 132, 38, 31, 0xb6b4a2, 0x6d7b7a, 0x8c9790);
    const g = this.add.graphics().setDepth(p.y - 1);
    g.fillStyle(0x2e3e46).fillRect(p.x + 18, p.y - 58, 44, 39);
    g.fillStyle(0x73d9c7).fillRect(p.x + 23, p.y - 53, 34, 26);
    g.fillStyle(0xd7e7cf).fillRect(p.x - 42, p.y - 42, 10, 29).fillRect(p.x - 48, p.y - 20, 30, 7);
    g.fillStyle(0x72c8a8).fillCircle(p.x - 37, p.y - 47, 8);
    this.drawChair(this.iso(12, 5).x, this.iso(12, 5).y, 0x47766c);
  }

  private drawMailDesk() {
    const p = this.iso(3, 9);
    this.isoBox(p.x, p.y, 125, 42, 28, 0x9a6749, 0x684038, 0x804c3d);
    const g = this.add.graphics().setDepth(p.y - 1);
    g.fillStyle(0xf4e0ac).lineStyle(2, 0x56343a).fillRect(p.x - 45, p.y - 30, 34, 23).strokeRect(p.x - 45, p.y - 30, 34, 23);
    g.lineBetween(p.x - 45, p.y - 30, p.x - 28, p.y - 16).lineBetween(p.x - 11, p.y - 30, p.x - 28, p.y - 16);
    g.fillStyle(0x344657).fillRect(p.x + 12, p.y - 53, 43, 38);
    g.fillStyle(0xe88777).fillRect(p.x + 18, p.y - 47, 31, 23);
    this.drawChair(this.iso(3, 11).x, this.iso(3, 11).y, 0x87545c);
  }

  private drawWorkshop() {
    const p = this.iso(11, 9);
    this.isoBox(p.x, p.y, 144, 46, 30, 0x8d6545, 0x5d4036, 0x75503d);
    const g = this.add.graphics().setDepth(p.y - 1);
    g.fillStyle(0x27465a).lineStyle(2, 0x26303a);
    for (let i = 0; i < 4; i++) g.fillRect(p.x - 58 + i * 28, p.y - 35, 24, 24);
    g.lineStyle(1, 0x67afd1);
    for (let i = 0; i < 5; i++) g.lineBetween(p.x - 58 + i * 22, p.y - 35, p.x - 58 + i * 22, p.y - 11);
    g.fillStyle(0xb16eb6).fillRect(p.x + 42, p.y - 52, 23, 34);
    this.drawChair(this.iso(11, 11).x, this.iso(11, 11).y, 0x6b527c);
  }

  private drawPlant(x: number, y: number) {
    const g = this.add.graphics().setDepth(y + 20);
    g.fillStyle(0x81513e).fillRect(x - 13, y, 26, 25);
    g.fillStyle(0x4e7c51).fillCircle(x - 9, y - 10, 13).fillCircle(x + 10, y - 16, 14).fillCircle(x, y - 29, 13);
  }

  private sync(agents: Agent[]) {
    agents.forEach(agent => {
      if (this.avatars.has(agent.id)) return;
      const start = startTiles[agent.id];
      const avatar = this.createAvatar(agent, start);
      this.avatars.set(agent.id, avatar.container);
      this.parts.set(agent.id, avatar.parts);
    });
    this.focusAgent(this.selectedAgent);
  }

  private createAvatar(agent: Agent, start: Point) {
    const shadow = this.add.ellipse(0, 19, 36, 11, 0x1d1014, 0.46);
    const sprite = this.add.image(0, 22, `agent-${agent.id}`).setDisplaySize(76, 76).setOrigin(0.5, 1);
    const badge = this.add.text(0, -57, agent.name, {
      fontFamily: "monospace", fontSize: "9px", fontStyle: "bold", color: "#fff4d1",
      backgroundColor: "#2d2029", padding: { x: 4, y: 2 },
    }).setOrigin(0.5);
    const action = this.add.text(0, -76, "", {
      fontFamily: "monospace", fontSize: "8px", color: "#3a2730", backgroundColor: "#ffe69a",
      padding: { x: 5, y: 3 }, align: "center",
    }).setOrigin(0.5).setVisible(false);
    const effect = this.add.text(31, -22, "", {
      fontFamily: "monospace", fontSize: "9px", fontStyle: "bold", color: "#ffe293",
      backgroundColor: "#321c19cc", padding: { x: 4, y: 3 },
    }).setOrigin(0.5).setVisible(false);
    const prop = this.createActionProp(agent.id);
    const speech = this.createSpeechBubble();
    const speechText = speech.getByName("text") as Phaser.GameObjects.Text;
    const container = this.add.container(start.x, start.y, [shadow, sprite, prop, badge, action, effect, speech])
      .setSize(52, 82).setInteractive({ useHandCursor: true }).setDepth(start.y + 100);
    container.on("pointerdown", (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation(); this.focusAgent(agent.id); selectAgent(agent.id);
    });
    return { container, parts: { sprite, badge, action, effect, prop, speech, speechText } };
  }

  private createSpeechBubble() {
    const bubble = this.add.container(0, -121).setVisible(false).setDepth(500);
    const shadow = this.add.graphics();
    shadow.fillStyle(0x090b10, 0.55).fillRoundedRect(-96, -27, 192, 55, 8);
    const panel = this.add.graphics();
    panel.fillStyle(0x1b1a22, 0.97).lineStyle(2, 0xf2c56c, 1).fillRoundedRect(-99, -30, 192, 55, 8).strokeRoundedRect(-99, -30, 192, 55, 8);
    panel.fillStyle(0x1b1a22, 1).lineStyle(2, 0xf2c56c, 1).fillTriangle(-8, 25, 7, 25, 0, 36);
    const text = this.add.text(-88, -22, "", {
      fontFamily: "Chakra Petch, monospace", fontSize: "10px",
      color: "#f6e7c5", wordWrap: { width: 172 }, lineSpacing: 2,
    }).setName("text");
    bubble.add([shadow, panel, text]);
    return bubble;
  }

  private createResultHud() {
    const hud = this.add.container(450, 557).setDepth(2000).setVisible(false);
    const shadow = this.add.graphics().fillStyle(0x050609, 0.7).fillRoundedRect(-354, -43, 708, 88, 8);
    const panel = this.add.graphics()
      .fillStyle(0x17151a, 0.97).lineStyle(2, 0xd69a48, 1)
      .fillRoundedRect(-358, -47, 708, 88, 8).strokeRoundedRect(-358, -47, 708, 88, 8);
    const accent = this.add.graphics().fillStyle(0x72e09c, 1).fillRect(-358, -47, 7, 88);
    const title = this.add.text(-333, -36, "", {
      fontFamily: "Chakra Petch, monospace", fontSize: "14px", fontStyle: "bold", color: "#ffd57a",
    });
    const body = this.add.text(-333, -12, "", {
      fontFamily: "Chakra Petch, monospace", fontSize: "10px", color: "#d2c6ad", wordWrap: { width: 640 },
    });
    const next = this.add.text(-333, 17, "", {
      fontFamily: "Chakra Petch, monospace", fontSize: "9px", color: "#79dea0", wordWrap: { width: 640 },
    });
    hud.add([shadow, panel, accent, title, body, next]);
    this.resultHud = hud; this.resultTitle = title; this.resultBody = body; this.resultNext = next;
  }

  private showDialogue(agentId: string, message: string, tone: "mission" | "working" | "result") {
    const parts = this.parts.get(agentId);
    if (!parts) return;
    this.parts.forEach((other, id) => { if (id !== agentId) other.speech.setVisible(false); });
    const prefix = tone === "working" ? "EN PROGRESO · " : tone === "result" ? "RESULTADO · " : "MISIÓN · ";
    parts.speechText.setText(prefix + message);
    parts.speech.setVisible(true).setAlpha(0).setScale(0.88).setY(-113);
    this.tweens.killTweensOf(parts.speech);
    this.tweens.add({ targets: parts.speech, alpha: 1, scale: 1, y: -121, duration: 240, ease: "Back.Out" });
  }

  private showResultHud(detail: {
    agentId: string; agentName: string; title: string; summary: string; nextStep?: string; approval?: boolean;
  }) {
    if (!this.resultHud || !this.resultTitle || !this.resultBody || !this.resultNext) return;
    this.resultTitle.setText(`${detail.agentName.toUpperCase()} · ${detail.title}`);
    this.resultBody.setText(detail.summary);
    this.resultNext.setText(detail.approval ? "⚠ REQUIERE TU APROBACIÓN · No se ha ejecutado ninguna acción externa." : detail.nextStep ? `SIGUIENTE · ${detail.nextStep}` : "✓ Resultado guardado en el registro del HQ.");
    this.resultHud.setVisible(true).setAlpha(0).setY(575);
    this.tweens.killTweensOf(this.resultHud);
    this.tweens.add({ targets: this.resultHud, alpha: 1, y: 557, duration: 360, ease: "Back.Out" });
  }

  private clearMapFeedback() {
    this.parts.forEach(parts => parts.speech.setVisible(false));
    this.resultHud?.setVisible(false);
  }

  private createActionProp(agentId: string) {
    const prop = this.add.container(22, -5).setVisible(false);
    const g = this.add.graphics();
    if (agentId === "echo") {
      g.fillStyle(0xffedbd).lineStyle(2, 0x7b3d2a).fillRect(-14, -9, 28, 19).strokeRect(-14, -9, 28, 19);
      g.lineBetween(-14, -9, 0, 2).lineBetween(14, -9, 0, 2);
      g.fillStyle(0xd95843).fillCircle(0, 3, 3);
    } else if (agentId === "nova") {
      g.fillStyle(0xd8e6dd).lineStyle(2, 0x294757);
      g.fillRect(-11, 7, 25, 5).strokeRect(-11, 7, 25, 5);
      g.fillRect(2, -13, 6, 20).strokeRect(2, -13, 6, 20);
      g.fillStyle(0x79d7c3).fillCircle(-2, -13, 6);
      g.lineStyle(4, 0xd8e6dd).lineBetween(4, -5, -6, 4);
    } else if (agentId === "chronos") {
      g.fillStyle(0xffefb0).lineStyle(2, 0x754624);
      g.fillRect(-16, -11, 15, 22).strokeRect(-16, -11, 15, 22);
      g.fillRect(1, -11, 15, 22).strokeRect(1, -11, 15, 22);
      g.lineStyle(1, 0xc48c3c);
      [-5, 0, 5].forEach(y => { g.lineBetween(-13, y, -4, y); g.lineBetween(4, y, 13, y); });
    } else if (agentId === "pixel") {
      g.fillStyle(0x375f87).lineStyle(2, 0xc7b7e7).fillRect(-18, -11, 36, 22).strokeRect(-18, -11, 36, 22);
      g.lineStyle(1, 0x79b9db);
      [-9, 0, 9].forEach(x => g.lineBetween(x, -11, x, 11));
      g.lineBetween(-18, 0, 18, 0);
      g.lineStyle(3, 0x7f6a76).lineBetween(-7, 11, -11, 18).lineBetween(7, 11, 11, 18);
    } else if (agentId === "brasa") {
      g.fillStyle(0x5f3c32).lineStyle(2, 0xf0be73).fillEllipse(0, 5, 30, 14).strokeEllipse(0, 5, 30, 14);
      g.fillStyle(0xc4663f).fillRect(-13, -2, 26, 8);
      g.lineStyle(2, 0xf7dfb0, 0.9).lineBetween(-7, -5, -10, -16).lineBetween(1, -5, 4, -18).lineBetween(9, -5, 12, -15);
    } else {
      g.fillStyle(0x74c8da).lineStyle(2, 0x263c4e).fillCircle(0, 0, 10).strokeCircle(0, 0, 10);
      g.lineBetween(7, 7, 15, 15);
    }
    prop.add(g);
    return prop;
  }

  private focusAgent(agentId: string) {
    this.selectedAgent = agentId;
    const avatar = this.avatars.get(agentId);
    if (avatar && this.selectionRing) this.selectionRing.setPosition(avatar.x, avatar.y + 21).setVisible(true).setDepth(avatar.depth - 1);
    this.avatars.forEach((item, id) => item.setAlpha(id === agentId ? 1 : 0.88));
  }

  private moveToStation(agentId: string, roomId: string) {
    const station = stationTiles[roomId];
    if (!station) return;
    const target = station.point;
    this.activeMissions.add(agentId);
    this.clearAction(agentId);
    this.navigate(agentId, target, () => this.performAction(agentId, station), true);
  }

  private walkFreely(agentId: string, target: Point) {
    const parts = this.parts.get(agentId);
    if (!parts) return;
    this.activeMissions.delete(agentId);
    this.clearAction(agentId);
    this.stand(agentId);
    const safeTarget = NAV_NODES[this.nearestNode(target)];
    this.navigate(agentId, safeTarget, () => this.setStatus(agentId, "idle"), false);
  }

  private navigate(agentId: string, target: Point, onComplete: () => void, mission: boolean) {
    const avatar = this.avatars.get(agentId);
    if (!avatar) return;
    const startNode = this.nearestNode({ x: avatar.x, y: avatar.y });
    const endNode = this.nearestNode(target);
    const route = this.findRoute(startNode, endNode).slice(1).map(node => ({ node, point: NAV_NODES[node] }));
    if (Phaser.Math.Distance.Between(NAV_NODES[endNode].x, NAV_NODES[endNode].y, target.x, target.y) > 8) route.push({ node: "", point: target });
    if (!route.length) route.push({ node: "", point: target });
    const visit = (index: number) => {
      const step = route[index];
      this.walk(agentId, step.point, () => {
        const continueRoute = () => index < route.length - 1 ? visit(index + 1) : onComplete();
        if (step.node.endsWith("Door")) this.openDoor(step.node, continueRoute);
        else continueRoute();
      }, mission && index === route.length - 1);
    };
    visit(0);
  }

  private nearestNode(point: Point) {
    return Object.entries(NAV_NODES).reduce((best, [id, node]) =>
      Phaser.Math.Distance.Between(point.x, point.y, node.x, node.y) <
      Phaser.Math.Distance.Between(point.x, point.y, NAV_NODES[best].x, NAV_NODES[best].y) ? id : best,
      Object.keys(NAV_NODES)[0]);
  }

  private findRoute(start: string, end: string) {
    const queue: string[][] = [[start]], visited = new Set([start]);
    while (queue.length) {
      const path = queue.shift()!;
      const current = path[path.length - 1];
      if (current === end) return path;
      for (const next of NAV_EDGES[current]) if (!visited.has(next)) {
        visited.add(next); queue.push([...path, next]);
      }
    }
    return [start];
  }

  private roamOneAgent() {
    const candidates = [...this.avatars.keys()].filter(id => !this.activeMissions.has(id) && !this.moving.has(id));
    if (!candidates.length) return;
    const agentId = Phaser.Utils.Array.GetRandom(candidates);
    const home = NAV_NODES[AGENT_HOME[agentId]];
    const target = { x: home.x + Phaser.Math.Between(-18, 18), y: home.y + Phaser.Math.Between(-9, 12) };
    this.clearAction(agentId); this.stand(agentId);
    this.navigate(agentId, target, () => {
      if (Math.random() < 0.72) {
        const station = stationTiles[AGENT_ROOM[agentId]];
        this.performAction(agentId, station);
        this.time.delayedCall(2600, () => { if (!this.activeMissions.has(agentId)) { this.clearAction(agentId); this.stand(agentId); this.setStatus(agentId, "idle"); } });
      } else this.setStatus(agentId, "idle");
    }, false);
  }

  private walk(agentId: string, target: Point, onComplete: () => void, mission = true) {
    const avatar = this.avatars.get(agentId), parts = this.parts.get(agentId);
    if (!avatar || !parts) return;
    this.tweens.killTweensOf(avatar); this.tweens.killTweensOf(parts.sprite);
    this.moving.add(agentId);
    this.setStatus(agentId, "walking");
    if (this.selectedAgent === agentId) this.destinationMarker?.setPosition(target.x, target.y + 6).setVisible(true).setDepth(target.y + 30);
    const duration = Phaser.Math.Clamp(Phaser.Math.Distance.Between(avatar.x, avatar.y, target.x, target.y) * 5, 650, 1900);
    if (agentId === "brasa") {
      this.tweens.add({
        targets: parts.sprite,
        x: 4, y: 16, angle: 5,
        duration: 190, ease: "Sine.InOut", yoyo: true, repeat: -1,
      });
    } else {
      this.tweens.add({ targets: parts.sprite, y: 18, angle: 1.6, duration: 150, yoyo: true, repeat: -1 });
    }
    this.tweens.add({
      targets: avatar, x: target.x, y: target.y, duration, ease: "Linear",
      onUpdate: () => {
        avatar.setDepth(avatar.y + 100);
        if (this.selectedAgent === agentId) this.selectionRing?.setPosition(avatar.x, avatar.y + 21).setDepth(avatar.depth - 1);
      },
      onComplete: () => {
        this.tweens.killTweensOf(parts.sprite);
        parts.sprite.setScale(1).setDisplaySize(76, 76).setPosition(0, 22).setAngle(0);
        this.moving.delete(agentId);
        if (this.selectedAgent === agentId) this.destinationMarker?.setVisible(false);
        if (mission) this.setStatus(agentId, "working");
        onComplete();
      },
    });
  }

  private performAction(agentId: string, station: typeof stationTiles[string]) {
    const parts = this.parts.get(agentId);
    if (!parts) return;
    if (station.sitting) this.sit(agentId);
    parts.action.setText(station.action).setVisible(true);
    parts.effect.setText(AGENT_EFFECTS[agentId]).setVisible(true);
    parts.prop.setVisible(true).setAlpha(1).setScale(1).setAngle(-3);
    const motion = {
      echo: { x: 29, y: -8, angle: 8, scale: 1.05, duration: 430 },
      nova: { x: 18, y: -2, angle: -4, scale: 1.04, duration: 620 },
      chronos: { x: 21, y: -8, angle: 3, scale: 1.1, duration: 510 },
      pixel: { x: 25, y: -10, angle: 6, scale: 1.08, duration: 720 },
      atlas: { x: 28, y: -10, angle: 12, scale: 1.08, duration: 560 },
      brasa: { x: 25, y: -8, angle: -5, scale: 1.08, duration: 480 },
    }[agentId] ?? { x: 22, y: -10, angle: 4, scale: 1.08, duration: 520 };
    this.tweens.add({
      targets: parts.sprite,
      angle: agentId === "nova" ? -1.5 : agentId === "pixel" ? 2 : 1.2,
      y: agentId === "chronos" ? 22 : parts.sprite.y - 2,
      duration: motion.duration / 2, ease: "Sine.InOut", yoyo: true, repeat: -1,
    });
    this.tweens.add({ targets: parts.action, y: -80, duration: 450, yoyo: true, repeat: -1 });
    this.tweens.add({ targets: parts.effect, angle: 7, scale: 1.08, duration: 360, yoyo: true, repeat: -1 });
    this.tweens.add({
      targets: parts.prop, x: motion.x, y: motion.y, angle: motion.angle, scale: motion.scale,
      duration: motion.duration, ease: "Sine.InOut", yoyo: true, repeat: -1,
    });
    if (agentId === "echo") {
      this.tweens.add({ targets: parts.effect, x: 52, alpha: 0.35, duration: 650, yoyo: true, repeat: -1 });
    } else if (agentId === "nova") {
      this.tweens.add({ targets: parts.effect, alpha: 0.25, duration: 280, yoyo: true, repeat: -1 });
    } else if (agentId === "chronos") {
      this.tweens.add({ targets: parts.prop, scaleX: 0.82, duration: 260, yoyo: true, repeat: -1, repeatDelay: 700 });
    } else if (agentId === "pixel") {
      this.tweens.add({ targets: parts.effect, angle: 360, duration: 2200, repeat: -1 });
    } else if (agentId === "brasa") {
      this.tweens.add({ targets: parts.effect, y: -42, alpha: 0.25, duration: 900, yoyo: true, repeat: -1 });
    }
  }

  private clearAction(agentId: string) {
    const parts = this.parts.get(agentId);
    if (!parts) return;
    this.tweens.killTweensOf([parts.action, parts.effect, parts.prop, parts.sprite]);
    parts.action.setVisible(false).setY(-76);
    parts.effect.setVisible(false).setPosition(31, -22).setAlpha(1).setAngle(0).setScale(1);
    parts.prop.setVisible(false).setPosition(22, -5).setAngle(0).setScale(1);
  }

  private sit(agentId: string) {
    const parts = this.parts.get(agentId);
    if (!parts) return;
    parts.sprite.setDisplaySize(76, 62).setY(25);
  }

  private stand(agentId: string) {
    const parts = this.parts.get(agentId);
    if (!parts) return;
    this.tweens.killTweensOf([parts.sprite, parts.action]);
    parts.sprite.setScale(1).setDisplaySize(76, 76).setPosition(0, 22).setAngle(0);
  }

  private setStatus(agentId: string, status: AgentStatus) {
    const parts = this.parts.get(agentId);
    if (!parts) return;
    const colors: Record<AgentStatus, string> = {
      idle: "#d6d0c5", walking: "#85c9ff", working: "#ffe07e", waiting_approval: "#ffb36f",
      completed: "#83e0a3", error: "#ff8585",
    };
    parts.badge.setColor(colors[status]);
    if (status === "completed") parts.action.setText("MISSION COMPLETE").setVisible(true);
    if (status === "waiting_approval") parts.action.setText("AWAITING APPROVAL").setVisible(true);
    if (status === "error") parts.action.setText("TASK ERROR").setVisible(true);
    if (status === "completed" || status === "waiting_approval" || status === "error") {
      this.time.delayedCall(1800, () => {
        this.activeMissions.delete(agentId);
        this.clearAction(agentId);
        this.stand(agentId);
      });
    }
  }

  private floorContains(x: number, y: number) {
    const walkableRooms = [
      new Phaser.Geom.Rectangle(215, 115, 230, 135),
      new Phaser.Geom.Rectangle(480, 115, 230, 135),
      new Phaser.Geom.Rectangle(75, 285, 230, 135),
      new Phaser.Geom.Rectangle(600, 285, 230, 135),
      new Phaser.Geom.Rectangle(155, 445, 230, 115),
      new Phaser.Geom.Rectangle(450, 445, 270, 115),
      new Phaser.Geom.Rectangle(270, 235, 380, 215),
    ];
    return walkableRooms.some(room => Phaser.Geom.Rectangle.Contains(room, x, y));
  }
}
