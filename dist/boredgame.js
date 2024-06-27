import { init } from "./renderer";
import { GamePiece } from "./renderer";
import { showError } from "./renderer";
import perlinNoise from "./noise";
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
    constructor(positionX, positionY) {
        super(0, [], 0, []);
        this.x = positionX;
        this.y = positionY;
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
const player2 = new Player([new Troop(MAP_LENGTH - 1, MAP_LENGTH - 1)]);
let playerTurn = 1;
let selectedTroop = 0;
function drawBoard(gamePieces, time) {
    for (let y = 0; y < MAP_LENGTH; y++) {
        for (let x = 0; x < MAP_LENGTH; x++) {
            const terrain = boardLayout[y][x];
            gamePieces[terrain].draw(x, y, time, false);
            if (terrain === VOLCANO)
                gamePieces[12].draw(x, y, time, false);
            if (tileModifier[y][x]) {
                if (terrain === COAST)
                    gamePieces[11].draw(x, y, time, false);
                else if (terrain === PLAINS)
                    gamePieces[14].draw(x, y, time, false);
                else if (terrain === WATER)
                    gamePieces[13].draw(x, y, time, false);
            }
        }
    }
    // draw soldiers
    for (let i = 0; i < player1.troops.length; i++) {
        let fade = false;
        if (playerTurn === 1 && selectedTroop === i)
            fade = true;
        gamePieces[10].draw(player1.troops[i].x, player1.troops[i].y, time, fade);
    }
    for (let i = 0; i < player2.troops.length; i++) {
        let fade = false;
        if (playerTurn === 2 && selectedTroop === i)
            fade = true;
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
try {
    addEventListener("keydown", (event) => {
        const currentPlayer = (playerTurn === 1 ? player1 : player2);
        const targetTroop = currentPlayer.troops[selectedTroop];
        // move troop
        if ((event.key == "1" || event.key == "ArrowLeft") && targetTroop.x > 0)
            targetTroop.x--;
        else if ((event.key == "9" || event.key == "ArrowRight") && targetTroop.x < MAP_LENGTH - 1)
            targetTroop.x++;
        else if ((event.key == "7" || event.key == "ArrowUp") && targetTroop.y > 0)
            targetTroop.y--;
        else if ((event.key == "3" || event.key == "ArrowDown") && targetTroop.y < MAP_LENGTH - 1)
            targetTroop.y++;
        // modify tile
        else if (event.key == " ")
            if (targetTroop.x >= 0 && targetTroop.x < MAP_LENGTH &&
                targetTroop.y >= 0 && targetTroop.y < MAP_LENGTH) {
                tileModifier[targetTroop.y][targetTroop.x] = !tileModifier[targetTroop.y][targetTroop.x];
            }
        if (event.key == "Enter") {
            if (playerTurn === 1)
                playerTurn = 2;
            else
                playerTurn = 1;
            selectedTroop = 0;
        }
        if (event.key == "t") {
            selectedTroop++;
            if (selectedTroop >= currentPlayer.troops.length)
                selectedTroop = 0;
        }
        if (event.key == "m") {
            boardLayout = generateMap(Math.random() * 1e9);
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
