/** TODO
 * -------
 * Maybe: Movement animations
 * Orientate ship
 */

import { init, showError, GamePiece } from "./renderer.js";
import perlinNoise from "./noise.js"

export let MAP_LENGTH = 19;
let CHUNK_SIZE = 5;

let seed: number;

enum TileType {
    GRASS,
    FOREST,
    PLAINS,
    MOUNTAIN,
    VOLCANO,
    WATER,
    COAST,
    OCEAN,
    SWAMP,
    SNOW,
    SOLDIER_BLUE,
    SOLDIER_RED,
    LAVA,
    PORT,
    SHIP,
    CASTLE,
}

const { GRASS, FOREST, PLAINS, MOUNTAIN, VOLCANO, WATER, COAST, OCEAN, SWAMP, SNOW, SOLDIER_BLUE, SOLDIER_RED, LAVA, PORT, SHIP, CASTLE } = TileType;

// should be the same order as TileType
export const ASSET_NAMES = ['grass', 'forest', 'plains', 'mountain', 'volcano', 'water', 'coast', 'ocean', 'swamp', 'snow', 'soldierblue', 'soldierred', 'lava', 'port', 'ship', 'castle'];

let board: Tile[][] = [];

class Troop {
    public x: number;
    public y: number;
    public isOnShip: boolean;

    constructor(positionX: number, positionY: number) {
        this.x = positionX;
        this.y = positionY;

        this.isOnShip = false;
    }
}

class Tile {
    public type: TileType;
    public modified: boolean;

    constructor(type: TileType) {
        this.type = type;
        this.modified = false;
    }

    isLandTile() {
        return (this.type !== COAST && this.type !== WATER && this.type !== OCEAN);
    }

}

class Player {
    public troops: Troop[];
    constructor(troops: Troop[]) {
        this.troops = troops;
    }


}

const player1 = new Player([new Troop(0, 0), new Troop(1, 1)]);
const player2 = new Player([new Troop(MAP_LENGTH-1, MAP_LENGTH-1), new Troop(MAP_LENGTH-2, MAP_LENGTH-2)]);

let playerTurn = 1;
let focusedTroopIndex = 0;

// TODO: cache the fade values so they don't have to be (redundantly) calculated every frame
function drawBoard(gamePieces: GamePiece[], time: number) {
    for (let y = 0; y < MAP_LENGTH; y++) {
        for (let x = 0; x < MAP_LENGTH; x++) {

            const selectedTroop = (playerTurn === 1 ? player1 : player2).troops[focusedTroopIndex];
            const [deltaX, deltaY] = [x - selectedTroop.x, y - selectedTroop.y];

            // change the absolute sum to 2 if you want to be able to show being able to move 2 tiles
            const fade = (Math.abs(deltaX) + Math.abs(deltaY) <= 1 && troopCanMove(selectedTroop, deltaX, deltaY));

            const terrain = board[y][x].type;
            gamePieces[terrain].draw(x, y, time, fade);

            if (terrain === VOLCANO)
                gamePieces[LAVA].draw(x, y, time, fade);

            if (board[y][x].modified) {
                if (terrain === COAST)
                    gamePieces[PORT].draw(x, y, time, fade);
                else if (terrain === PLAINS)
                    gamePieces[CASTLE].draw(x, y, time, fade);
                else if (terrain === WATER || terrain === OCEAN)
                    gamePieces[SHIP].draw(x, y, time, fade);
            }
        }
    }

    // draw player troops
    for (let i = 0; i < player1.troops.length; i++) {
        const fade = (playerTurn === 1 && focusedTroopIndex === i);
        gamePieces[SOLDIER_BLUE].draw(player1.troops[i].x, player1.troops[i].y, time, fade);
    }

    for (let i = 0; i < player2.troops.length; i++) {
        const fade = (playerTurn === 2 && focusedTroopIndex === i);
        gamePieces[SOLDIER_RED].draw(player2.troops[i].x, player2.troops[i].y, time, fade);
    }

}

function generateMap(seed: number) {
    console.log(seed);
    
    // how many (tiles per noise value) you want: ~5 is a reasonable value
    let chunkSize = CHUNK_SIZE;
    chunkSize += Math.random() * .2 - .1; // we don't want every Nth tile to be the same every time

    // const map: Tile[][] = [];
    for (let i = 0; i < MAP_LENGTH; i++) {
        for (let j = 0; j < MAP_LENGTH; j++) {
            const noise = perlinNoise(j / chunkSize, i / chunkSize, seed);
            if (noise < .25) board[i][j] = new Tile(OCEAN);
            else if (noise < .35) board[i][j] = new Tile(WATER);
            else if (noise < .4) board[i][j] = new Tile(COAST);
            else if (noise < .5) board[i][j] = new Tile(PLAINS);
            else if (noise < .6) board[i][j] = new Tile(GRASS);
            else if (noise < .7) board[i][j] = new Tile(FOREST);
            else if (noise < .8) board[i][j] = new Tile(MOUNTAIN);
            else board[i][j] = new Tile(VOLCANO);
        }
    }

    // coast should be adjacent to a land tile
    for (let i = 0; i < MAP_LENGTH; i++) {
        for (let j = 0; j < MAP_LENGTH; j++) {
            if (board[i][j].type !== COAST)
                continue;

            if (i > 0 && board[i-1][j].isLandTile() ||
                i < MAP_LENGTH-1 && board[i+1][j].isLandTile() ||
                j > 0 && board[i][j-1].isLandTile() ||
                j < MAP_LENGTH-1 && board[i][j+1].isLandTile())
                continue;

            board[i][j] = new Tile(WATER);
        }
    }

    // board = map;
}

// TODO: add distance checks?
function troopCanMove(troop: Troop, deltaX: number, deltaY: number) {
    const [newX, newY] = [troop.x + deltaX, troop.y + deltaY];

    if (newX < 0 || newX > MAP_LENGTH - 1 || newY < 0 || newY > MAP_LENGTH - 1) {
        return false;
    }
    
    const currentTile = board[troop.y][troop.x].type;
    const newTile = board[newY][newX].type;

    if (newTile == VOLCANO) {
        return false;
    }

    if (newTile == WATER || newTile == OCEAN) {
        if ((currentTile == COAST && board[troop.y][troop.x].modified) || troop.isOnShip)
            return true;
        else
            return false;
    }

    for (let i = 0; i < player1.troops.length; i++) {
        if (player1.troops[i].x == newX && player1.troops[i].y == newY)
            return false;
    }

    for (let i = 0; i < player2.troops.length; i++) {
        if (player2.troops[i].x == newX && player2.troops[i].y == newY)
            return false;
    }

    return true;
}

// You currently cannot remount a ship without a port, I'm not a fan of this behavior
function moveTroop(troop: Troop, deltaX: number, deltaY: number) {
    if (!troopCanMove(troop, deltaX, deltaY)) {
        return;
    }

    const [newX, newY] = [troop.x + deltaX, troop.y + deltaY];

    const currentTile = board[troop.y][troop.x].type;
    const newTile = board[newY][newX].type;

    if (currentTile === COAST) {
        // if player has resources to build boat...
        if (newTile === WATER || newTile === OCEAN) {
            board[newY][newX].modified = true;
            troop.isOnShip = true;
        }
    }
    
    if (currentTile === WATER || currentTile === OCEAN) {
        if (newTile === WATER || newTile === OCEAN) {
            board[troop.y][troop.x].modified = false;
            board[newY][newX].modified = true;
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
        const focusedTroop = currentPlayer.troops[focusedTroopIndex];

        // move troop
        if (event.key == "ArrowLeft")
            moveTroop(focusedTroop, -1, 0);
        else if (event.key == "ArrowRight")
            moveTroop(focusedTroop, +1, 0);
        else if (event.key == "ArrowUp")
            moveTroop(focusedTroop, 0, -1);
        else if (event.key == "ArrowDown")
            moveTroop(focusedTroop, 0, +1);

        // modify tile
        else if (event.key == " ") {
            board[focusedTroop.y][focusedTroop.x].modified = !board[focusedTroop.y][focusedTroop.x].modified;

            if (board[focusedTroop.y][focusedTroop.x].type === WATER || board[focusedTroop.y][focusedTroop.x].type === OCEAN)
                focusedTroop.isOnShip = !focusedTroop.isOnShip;
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
            seed = Math.random() * 1e9;
            generateMap(seed);
        } 

        if (event.key == "1") {
            MAP_LENGTH--;
            generateMap(seed);
        }

        if (event.key == "2") {
            MAP_LENGTH++;
            board.push([]);
            generateMap(seed);
        }

        if (event.key == "9") {
            CHUNK_SIZE--;
            if (CHUNK_SIZE == 0)
                CHUNK_SIZE = 1;
            generateMap(seed);
        }

        if (event.key == "0") {
            CHUNK_SIZE++;
            generateMap(seed);
        }
    });

    // populate array
    for (let i = 0; i < MAP_LENGTH; i++) {
        board.push([]);
    }

    seed = Math.random() * 1e9;
    generateMap(seed);

    init(drawBoard);
} catch (e) {
    showError(`Uncaught JavaScript exception: ${e}`);
}
