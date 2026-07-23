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

const ROOM = { cx: 450, top: 102, cols: 16, rows: 13, tileW: 48, tileH: 24 };
const stationTiles: Record<string, { point: Point; label: string; action: string; sitting: boolean }> = {
  control_room: { point: { x: 341, y: 279 }, label: "CONTROL ROOM", action: "CHECKING DEADLINES", sitting: true },
  masters_archive: { point: { x: 590, y: 276 }, label: "MASTERS ARCHIVE", action: "RANKING PROGRAMMES", sitting: false },
  tfg_laboratory: { point: { x: 246, y: 462 }, label: "TFG LABORATORY", action: "ANALYSING SAMPLES", sitting: true },
  mail_room: { point: { x: 455, y: 469 }, label: "MAIL ROOM", action: "DRAFTING EMAIL", sitting: true },
  portfolio_workshop: { point: { x: 667, y: 461 }, label: "PORTFOLIO WORKSHOP", action: "BUILDING PORTFOLIO", sitting: true },
};
const startTiles: Record<string, Point> = {
  chronos: { x: 515, y: 351 }, atlas: { x: 414, y: 341 }, nova: { x: 366, y: 420 },
  echo: { x: 488, y: 422 }, pixel: { x: 574, y: 422 },
};
const NAV_NODES: Record<string, Point> = {
  control: { x: 341, y: 279 }, controlDoor: { x: 392, y: 322 },
  archive: { x: 590, y: 276 }, archiveDoor: { x: 513, y: 322 },
  upperLanding: { x: 452, y: 336 }, lowerLanding: { x: 452, y: 382 },
  labDoor: { x: 352, y: 398 }, lab: { x: 246, y: 462 },
  mailDoor: { x: 430, y: 407 }, mail: { x: 455, y: 469 },
  workshopDoor: { x: 552, y: 398 }, workshop: { x: 667, y: 461 },
};
const NAV_EDGES: Record<string, string[]> = {
  control: ["controlDoor"], controlDoor: ["control", "upperLanding"],
  archive: ["archiveDoor"], archiveDoor: ["archive", "upperLanding"],
  upperLanding: ["controlDoor", "archiveDoor", "lowerLanding"],
  lowerLanding: ["upperLanding", "labDoor", "mailDoor", "workshopDoor"],
  labDoor: ["lowerLanding", "lab"], lab: ["labDoor"],
  mailDoor: ["lowerLanding", "mail"], mail: ["mailDoor"],
  workshopDoor: ["lowerLanding", "workshop"], workshop: ["workshopDoor"],
};
const AGENT_EFFECTS: Record<string, string> = {
  atlas: "◆  ◆  ◆", nova: "✦  +  ✦", echo: "✉  ···  ➜", chronos: "◷  03:14", pixel: "⚙  ✦  ⚙",
};

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

  constructor() { super("office"); }

  preload() {
    this.load.image("career-hq-v4", `${import.meta.env.BASE_URL}assets/career-quest-hq-isometric-v4-clean.png`);
    ["atlas", "nova", "echo", "chronos", "pixel"].forEach(agentId =>
      this.load.image(`agent-${agentId}`, `${import.meta.env.BASE_URL}assets/agents/${agentId}.png`));
  }

  create() {
    this.cameras.main.setBackgroundColor("#472b38");
    this.add.image(450, 310, "career-hq-v4").setDisplaySize(900, 505).setDepth(-500);
    this.selectionRing = this.add.ellipse(0, 0, 38, 17).setStrokeStyle(2, 0xffdc74).setFillStyle(0xffdc74, 0.16).setDepth(700);
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
    return { x: ROOM.cx + (tileX - tileY) * ROOM.tileW / 2, y: ROOM.top + (tileX + tileY) * ROOM.tileH / 2 };
  }

  private drawRoomLabels() {
    const labels = [
      { x: 261, y: 154, text: "01  CONTROL ROOM", color: "#5fb6c7" },
      { x: 617, y: 154, text: "02  MASTERS ARCHIVE", color: "#e1aa54" },
      { x: 202, y: 345, text: "03  TFG LAB", color: "#77b879" },
      { x: 450, y: 348, text: "04  MAIL ROOM", color: "#df7259" },
      { x: 690, y: 345, text: "05  WORKSHOP", color: "#b57bd3" },
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

  private drawBackdrop() {
    const g = this.add.graphics();
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

  private drawRoom() {
    const top = this.iso(0, 0), left = this.iso(0, ROOM.rows), right = this.iso(ROOM.cols, 0);
    const wallH = 112, g = this.add.graphics();
    g.fillStyle(0xd8a968).lineStyle(4, 0x3b2630);
    g.beginPath().moveTo(top.x, top.y).lineTo(left.x, left.y).lineTo(left.x, left.y - wallH)
      .lineTo(top.x, top.y - wallH).closePath().fillPath().strokePath();
    g.fillStyle(0xefc77f);
    g.beginPath().moveTo(top.x, top.y).lineTo(right.x, right.y).lineTo(right.x, right.y - wallH)
      .lineTo(top.x, top.y - wallH).closePath().fillPath().strokePath();
    for (let y = 0; y < ROOM.rows; y++) for (let x = 0; x < ROOM.cols; x++) {
      const p = this.iso(x, y), color = (x + y) % 2 ? 0xb8784e : 0xc98756;
      this.add.polygon(p.x, p.y, [0, -12, 24, 0, 0, 12, -24, 0], color)
        .setStrokeStyle(1, 0x8f573e, 0.7).setDepth(p.y - 90);
    }
    this.drawWindow(421, 39);
    this.drawWallBoard(558, 72);
    this.drawPlant(248, 122);
    this.add.text(714, 91, "HQ", { fontFamily: "monospace", fontSize: "13px", color: "#5a2d35", fontStyle: "bold" })
      .setAngle(26).setDepth(50);
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
    this.drawControlStation(); this.drawArchive(); this.drawLaboratory(); this.drawMailDesk(); this.drawWorkshop();
    Object.values(stationTiles).forEach(station => {
      const p = station.point;
      this.add.text(p.x, p.y + 39, station.label, {
        fontFamily: "monospace", fontSize: "9px", fontStyle: "bold", color: "#4b2931",
        backgroundColor: "#edc782", padding: { x: 4, y: 2 },
      }).setOrigin(0.5).setDepth(p.y + 110);
    });
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
    const shadow = this.add.ellipse(0, 24, 48, 15, 0x1d1014, 0.46);
    const sprite = this.add.image(0, 27, `agent-${agent.id}`).setDisplaySize(96, 96).setOrigin(0.5, 1);
    const badge = this.add.text(0, -74, agent.name, {
      fontFamily: "monospace", fontSize: "10px", fontStyle: "bold", color: "#fff4d1",
      backgroundColor: "#2d2029", padding: { x: 4, y: 2 },
    }).setOrigin(0.5);
    const action = this.add.text(0, -95, "", {
      fontFamily: "monospace", fontSize: "8px", color: "#3a2730", backgroundColor: "#ffe69a",
      padding: { x: 5, y: 3 }, align: "center",
    }).setOrigin(0.5).setVisible(false);
    const effect = this.add.text(39, -27, "", {
      fontFamily: "monospace", fontSize: "9px", fontStyle: "bold", color: "#ffe293",
      backgroundColor: "#321c19cc", padding: { x: 4, y: 3 },
    }).setOrigin(0.5).setVisible(false);
    const prop = this.createActionProp(agent.id);
    const speech = this.createSpeechBubble();
    const speechText = speech.getByName("text") as Phaser.GameObjects.Text;
    const container = this.add.container(start.x, start.y, [shadow, sprite, prop, badge, action, effect, speech])
      .setSize(66, 104).setInteractive({ useHandCursor: true }).setDepth(start.y + 100);
    container.on("pointerdown", (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation(); this.focusAgent(agent.id); selectAgent(agent.id);
    });
    return { container, parts: { sprite, badge, action, effect, prop, speech, speechText } };
  }

  private createSpeechBubble() {
    const bubble = this.add.container(0, -139).setVisible(false).setDepth(500);
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
    parts.speech.setVisible(true).setAlpha(0).setScale(0.88).setY(-131);
    this.tweens.killTweensOf(parts.speech);
    this.tweens.add({ targets: parts.speech, alpha: 1, scale: 1, y: -139, duration: 240, ease: "Back.Out" });
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
    const route = this.findRoute(startNode, endNode).slice(1).map(node => NAV_NODES[node]);
    if (Phaser.Math.Distance.Between(NAV_NODES[endNode].x, NAV_NODES[endNode].y, target.x, target.y) > 8) route.push(target);
    if (!route.length) route.push(target);
    const visit = (index: number) => {
      this.walk(agentId, route[index], () => {
        if (index < route.length - 1) visit(index + 1);
        else onComplete();
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
    const destinations = Object.keys(NAV_NODES).filter(id => !id.toLowerCase().includes("door") && !id.includes("Landing"));
    const target = NAV_NODES[Phaser.Utils.Array.GetRandom(destinations)];
    this.clearAction(agentId); this.stand(agentId);
    this.navigate(agentId, target, () => this.setStatus(agentId, "idle"), false);
  }

  private walk(agentId: string, target: Point, onComplete: () => void, mission = true) {
    const avatar = this.avatars.get(agentId), parts = this.parts.get(agentId);
    if (!avatar || !parts) return;
    this.tweens.killTweensOf(avatar); this.tweens.killTweensOf(parts.sprite);
    this.moving.add(agentId);
    this.setStatus(agentId, "walking");
    if (this.selectedAgent === agentId) this.destinationMarker?.setPosition(target.x, target.y + 6).setVisible(true).setDepth(target.y + 30);
    const duration = Phaser.Math.Clamp(Phaser.Math.Distance.Between(avatar.x, avatar.y, target.x, target.y) * 5, 650, 1900);
    this.tweens.add({ targets: parts.sprite, y: 22, angle: 1.6, duration: 150, yoyo: true, repeat: -1 });
    this.tweens.add({
      targets: avatar, x: target.x, y: target.y, duration, ease: "Linear",
      onUpdate: () => {
        avatar.setDepth(avatar.y + 100);
        if (this.selectedAgent === agentId) this.selectionRing?.setPosition(avatar.x, avatar.y + 21).setDepth(avatar.depth - 1);
      },
      onComplete: () => {
        this.tweens.killTweensOf(parts.sprite);
        parts.sprite.setY(27).setAngle(0);
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
    }[agentId] ?? { x: 22, y: -10, angle: 4, scale: 1.08, duration: 520 };
    this.tweens.add({
      targets: parts.sprite,
      angle: agentId === "nova" ? -1.5 : agentId === "pixel" ? 2 : 1.2,
      y: agentId === "chronos" ? 27 : parts.sprite.y - 2,
      duration: motion.duration / 2, ease: "Sine.InOut", yoyo: true, repeat: -1,
    });
    this.tweens.add({ targets: parts.action, y: -99, duration: 450, yoyo: true, repeat: -1 });
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
    }
  }

  private clearAction(agentId: string) {
    const parts = this.parts.get(agentId);
    if (!parts) return;
    this.tweens.killTweensOf([parts.action, parts.effect, parts.prop, parts.sprite]);
    parts.action.setVisible(false).setY(-95);
    parts.effect.setVisible(false).setPosition(39, -27).setAlpha(1).setAngle(0).setScale(1);
    parts.prop.setVisible(false).setPosition(22, -5).setAngle(0).setScale(1);
  }

  private sit(agentId: string) {
    const parts = this.parts.get(agentId);
    if (!parts) return;
    parts.sprite.setDisplaySize(96, 78).setY(30);
  }

  private stand(agentId: string) {
    const parts = this.parts.get(agentId);
    if (!parts) return;
    this.tweens.killTweensOf([parts.sprite, parts.action]);
    parts.sprite.setDisplaySize(96, 96).setPosition(0, 27).setAngle(0);
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
      new Phaser.Geom.Rectangle(235, 185, 215, 155),
      new Phaser.Geom.Rectangle(455, 185, 210, 155),
      new Phaser.Geom.Rectangle(155, 366, 210, 145),
      new Phaser.Geom.Rectangle(365, 370, 190, 145),
      new Phaser.Geom.Rectangle(555, 366, 205, 145),
      new Phaser.Geom.Rectangle(350, 310, 210, 105),
    ];
    return walkableRooms.some(room => Phaser.Geom.Rectangle.Contains(room, x, y));
  }
}
