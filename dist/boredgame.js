import { init } from "./renderer.js";
import { GamePiece } from "./renderer.js";
import { showError } from "./renderer.js";
import perlinNoise from "./noise.js";
const MAP_LENGTH = 15;
const tileModifier = [];
var TileType;
(function (TileType) {
    TileType[TileType["GRASS"] = 0] = "GRASS";
    TileType[TileType["FOREST"] = 1] = "FOREST";
    TileType[TileType["PLAINS"] = 2] = "PLAINS";
    TileType[TileType["MOUNTAIN"] = 3] = "MOUNTAIN";
    TileType[TileType["VOLCANO"] = 4] = "VOLCANO";
    TileType[TileType["WATER"] = 5] = "WATER";
    TileType[TileType["COAST"] = 6] = "COAST";
    TileType[TileType["OCEAN"] = 7] = "OCEAN";
    TileType[TileType["SWAMP"] = 8] = "SWAMP";
    TileType[TileType["SNOW"] = 9] = "SNOW";
})(TileType || (TileType = {}));
const { GRASS, FOREST, PLAINS, MOUNTAIN, VOLCANO, WATER, COAST, OCEAN, SWAMP, SNOW } = TileType;
const ISLAND_MAP = [
    [WATER, WATER, COAST, WATER, WATER, COAST, WATER, SNOW, SNOW],
    [WATER, WATER, PLAINS, FOREST, FOREST, PLAINS, WATER, WATER, SNOW],
    [WATER, WATER, PLAINS, FOREST, MOUNTAIN, FOREST, PLAINS, COAST, WATER],
    [WATER, PLAINS, FOREST, MOUNTAIN, VOLCANO, MOUNTAIN, FOREST, WATER, WATER],
    [WATER, PLAINS, MOUNTAIN, MOUNTAIN, VOLCANO, VOLCANO, FOREST, FOREST, WATER],
    [WATER, PLAINS, PLAINS, MOUNTAIN, MOUNTAIN, COAST, FOREST, PLAINS, WATER],
    [WATER, COAST, PLAINS, PLAINS, WATER, WATER, PLAINS, PLAINS, COAST],
    [WATER, WATER, PLAINS, PLAINS, COAST, PLAINS, PLAINS, WATER, WATER],
    [WATER, WATER, WATER, WATER, WATER, WATER, COAST, WATER, WATER]
];
const OTHER_MAP = [
    [OCEAN, MOUNTAIN, SNOW, SNOW, COAST, WATER, WATER, OCEAN, OCEAN],
    [OCEAN, OCEAN, MOUNTAIN, SNOW, FOREST, WATER, OCEAN, OCEAN, VOLCANO],
    [OCEAN, OCEAN, MOUNTAIN, FOREST, FOREST, FOREST, OCEAN, OCEAN, VOLCANO],
    [OCEAN, OCEAN, SNOW, MOUNTAIN, PLAINS, COAST, FOREST, PLAINS, PLAINS],
    [SNOW, SNOW, OCEAN, GRASS, PLAINS, WATER, WATER, PLAINS, COAST],
    [FOREST, FOREST, FOREST, FOREST, PLAINS, PLAINS, WATER, WATER, WATER],
    [FOREST, MOUNTAIN, FOREST, PLAINS, PLAINS, PLAINS, PLAINS, PLAINS, WATER],
    [MOUNTAIN, MOUNTAIN, FOREST, PLAINS, PLAINS, PLAINS, PLAINS, WATER, WATER],
    [MOUNTAIN, MOUNTAIN, MOUNTAIN, MOUNTAIN, PLAINS, COAST, WATER, WATER, WATER]
];
let boardLayout = ISLAND_MAP;
class Troop extends GamePiece {
    x;
    y;
    isOnShip;
    constructor(positionX, positionY) {
        super(0, [], 0, []);
        this.x = positionX;
        this.y = positionY;
        this.isOnShip = false;
    }
}
class Tile extends GamePiece {
}
class Player {
    troops;
    constructor(troops) {
        this.troops = troops;
    }
}
const player1 = new Player([new Troop(0, 0), new Troop(1, 1)]);
const player2 = new Player([new Troop(MAP_LENGTH - 1, MAP_LENGTH - 1), new Troop(MAP_LENGTH - 2, MAP_LENGTH - 2)]);
let playerTurn = 1;
let focusedTroopIndex = 0;
// TODO: cache the fade values so they don't have to be (redundantly) calculated every frame
function drawBoard(gamePieces, time) {
    for (let y = 0; y < MAP_LENGTH; y++) {
        for (let x = 0; x < MAP_LENGTH; x++) {
            const selectedTroop = (playerTurn === 1 ? player1 : player2).troops[focusedTroopIndex];
            const [deltaX, deltaY] = [x - selectedTroop.x, y - selectedTroop.y];
            // change the absolute sum to 2 if you want to be able to show being able to move 2 tiles
            const fade = (Math.abs(deltaX) + Math.abs(deltaY) <= 1 && troopCanMove(selectedTroop, deltaX, deltaY));
            const terrain = boardLayout[y][x];
            gamePieces[terrain].draw(x, y, time, fade);
            if (terrain === VOLCANO)
                gamePieces[12].draw(x, y, time, fade);
            if (tileModifier[y][x]) {
                if (terrain === COAST)
                    gamePieces[11].draw(x, y, time, fade);
                else if (terrain === PLAINS)
                    gamePieces[14].draw(x, y, time, fade);
                else if (terrain === WATER || terrain === OCEAN)
                    gamePieces[13].draw(x, y, time, fade);
            }
        }
    }
    // draw player troops
    for (let i = 0; i < player1.troops.length; i++) {
        const fade = (playerTurn === 1 && focusedTroopIndex === i);
        gamePieces[10].draw(player1.troops[i].x, player1.troops[i].y, time, fade);
    }
    for (let i = 0; i < player2.troops.length; i++) {
        const fade = (playerTurn === 2 && focusedTroopIndex === i);
        gamePieces[15].draw(player2.troops[i].x, player2.troops[i].y, time, fade);
    }
}
function generateMap(seed) {
    console.log(seed);
    // how many (tiles per noise value) you want: ~5-6 is a reasonable value
    let chunks = 5;
    chunks += Math.random() * .1; // we don't want every Nth tile to be the same every time
    const map = [];
    for (let i = 0; i < MAP_LENGTH; i++) {
        map.push([]);
        for (let j = 0; j < MAP_LENGTH; j++) {
            const noise = perlinNoise(j / chunks, i / chunks, seed);
            if (noise < .25)
                map[i].push(OCEAN);
            else if (noise < .35)
                map[i].push(WATER);
            else if (noise < .4)
                map[i].push(COAST);
            else if (noise < .5)
                map[i].push(PLAINS);
            else if (noise < .6)
                map[i].push(GRASS);
            else if (noise < .7)
                map[i].push(FOREST);
            else if (noise < .8)
                map[i].push(MOUNTAIN);
            else
                map[i].push(VOLCANO);
        }
    }
    return map;
}
// TODO: add distance checks?
function troopCanMove(troop, deltaX, deltaY) {
    const newX = troop.x + deltaX;
    const newY = troop.y + deltaY;
    if (newX < 0 || newX > MAP_LENGTH - 1 || newY < 0 || newY > MAP_LENGTH - 1) {
        return false;
    }
    const newTile = boardLayout[newY][newX];
    const currentTile = boardLayout[troop.y][troop.x];
    if (newTile == VOLCANO) {
        return false;
    }
    if (newTile == WATER || newTile == OCEAN) {
        if ((currentTile == COAST && tileModifier[troop.y][troop.x]) || troop.isOnShip)
            return true;
        else
            return false;
    }
    return true;
}
function moveTroop(troop, deltaX, deltaY) {
    if (!troopCanMove(troop, deltaX, deltaY)) {
        return;
    }
    const [newX, newY] = [troop.x + deltaX, troop.y + deltaY];
    const currentTile = boardLayout[troop.y][troop.x];
    const newTile = boardLayout[newY][newX];
    if (currentTile === COAST) {
        // if player has resources to build boat...
        if (newTile === WATER || newTile === OCEAN) {
            tileModifier[newY][newX] = true;
            troop.isOnShip = true;
        }
    }
    if (currentTile === WATER || currentTile === OCEAN) {
        if (newTile === WATER || newTile === OCEAN) {
            tileModifier[troop.y][troop.x] = false;
            tileModifier[newY][newX] = true;
        }
        // if (newTile === COAST) ...
        else { // moving to coast or land tile
            troop.isOnShip = false;
        }
    }
    [troop.x, troop.y] = [newX, newY];
}
try {
    addEventListener("keydown", (event) => {
        const currentPlayer = (playerTurn === 1 ? player1 : player2);
        const targetTroop = currentPlayer.troops[focusedTroopIndex];
        // move troop
        if (event.key == "ArrowLeft")
            moveTroop(targetTroop, -1, 0);
        else if (event.key == "ArrowRight")
            moveTroop(targetTroop, +1, 0);
        else if (event.key == "ArrowUp")
            moveTroop(targetTroop, 0, -1);
        else if (event.key == "ArrowDown")
            moveTroop(targetTroop, 0, +1);
        // modify tile
        else if (event.key == " ") {
            tileModifier[targetTroop.y][targetTroop.x] = !tileModifier[targetTroop.y][targetTroop.x];
            if (boardLayout[targetTroop.y][targetTroop.x] === WATER || boardLayout[targetTroop.y][targetTroop.x] === OCEAN)
                targetTroop.isOnShip != targetTroop.isOnShip;
        }
        if (event.key == "Enter") {
            if (playerTurn === 1)
                playerTurn = 2;
            else
                playerTurn = 1;
            focusedTroopIndex = 0;
        }
        if (event.key == "t") {
            focusedTroopIndex++;
            if (focusedTroopIndex >= currentPlayer.troops.length)
                focusedTroopIndex = 0;
        }
        if (event.key == "m") {
            boardLayout = generateMap(Math.random() * 1e9);
            // clear any modified tiles
            for (let i = 0; i < MAP_LENGTH; i++) {
                for (let j = 0; j < MAP_LENGTH; j++) {
                    tileModifier[i][j] = false;
                }
            }
        }
    });
    // populate array
    for (let i = 0; i < MAP_LENGTH; i++) {
        tileModifier.push([]);
        for (let j = 0; j < MAP_LENGTH; j++) {
            tileModifier[i].push(false);
        }
    }
    boardLayout = generateMap(Math.random() * 1e9);
    init(drawBoard);
}
catch (e) {
    showError(`Uncaught JavaScript exception: ${e}`);
}
