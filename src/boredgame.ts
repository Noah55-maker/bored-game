/** TODO
 * -------
 * Maybe: Movement animations
 * Orientate ship
 */

import { init, showError, GamePiece, pickedData } from "./renderer.js";
import perlinNoise from "./noise.js"
import { fade as smoothFade, scale } from "./noise.js";

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
    WOOD,
}

const { GRASS, FOREST, PLAINS, MOUNTAIN, VOLCANO, WATER, COAST, OCEAN, SWAMP, SNOW, SOLDIER_BLUE, SOLDIER_RED, LAVA, PORT, SHIP, CASTLE, WOOD } = TileType;

// should be the same order as TileType
export const ASSET_NAMES = ['grass', 'forest', 'plains', 'mountain', 'volcano', 'water', 'coast', 'ocean', 'swamp', 'snow', 'soldierblue', 'soldierred', 'lava', 'port', 'ship', 'castle', 'wood'];


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
    public height: number;

    constructor(type: TileType, height: number) {
        this.type = type;
        this.height = height;
        this.modified = false;

        if (type === FOREST) {
            if (Math.random() < .3)
                this.modified = true;
        }
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

const players: Player[] = [
    new Player([new Troop(0, 0), new Troop(1, 1)]),
    new Player([new Troop(MAP_LENGTH-1, MAP_LENGTH-1), new Troop(MAP_LENGTH-2, MAP_LENGTH-2)])
]

let playerTurn = 0;
let selectedTroopIndex = 0;

function fade1(x: number) {
    return scale(-Math.cos(x));
}

function fade2(x: number) {
    x /= Math.PI;
    const fPart = Math.floor(x);
    return smoothFade(x - fPart) * Math.pow(-1, fPart) + scale(Math.pow(-1, fPart + 1)); 
}

// TODO: cache the fade values so they don't have to be (redundantly) calculated every frame
function drawBoard(gamePieces: GamePiece[], time: number) {
    for (let y = 0; y < MAP_LENGTH; y++) {
        for (let x = 0; x < MAP_LENGTH; x++) {

            const selectedTroop = players[playerTurn].troops[selectedTroopIndex];
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
                else if (terrain === FOREST)
                    gamePieces[WOOD].draw(x, y, time, false);
            }
        }
    }

    // draw player troops

    for (let i = 0; i < players.length; i++) {
        const p = players[i];
        for (let j = 0; j < p.troops.length; j++) {
            const fade = (playerTurn === i && selectedTroopIndex === j);
            const [x, y] = [p.troops[j].x, p.troops[j].y];

            gamePieces[(i == 0 ? SOLDIER_BLUE : SOLDIER_RED)].draw(x, y, time, fade);
            // gamePieces[(i == 0 ? SOLDIER_BLUE : SOLDIER_RED)].draw(x + (i == 0 ? fade1(time) : fade2(time)), y, time, fade);
        }
    }

}

function generateMap(seed: number) {
    console.log(seed);
    
    // how many (tiles per noise value) you want: ~5 is a reasonable value
    let chunkSize = CHUNK_SIZE;
    chunkSize += Math.random() * .2 - .1; // we don't want every Nth tile to be the same every time

    for (let i = 0; i < MAP_LENGTH; i++) {
        for (let j = 0; j < MAP_LENGTH; j++) {
            const noise = perlinNoise(j / chunkSize, i / chunkSize, seed);
            if (noise < .25) board[i][j] = new Tile(OCEAN, noise);
            else if (noise < .4) board[i][j] = new Tile(WATER, noise);
            else if (noise < .45) board[i][j] = new Tile(COAST, noise);
            else if (noise < .52) board[i][j] = new Tile(PLAINS, noise);
            else if (noise < .62) board[i][j] = new Tile(GRASS, noise);
            else if (noise < .72) board[i][j] = new Tile(FOREST, noise);
            else if (noise < .80) board[i][j] = new Tile(MOUNTAIN, noise);
            else board[i][j] = new Tile(VOLCANO, noise);
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

            board[i][j] = new Tile(WATER, .35);
        }
    }
}

// TODO: add distance checks?
function troopCanMove(troop: Troop, deltaX: number, deltaY: number): boolean {
    if (Math.abs(deltaX) + Math.abs(deltaY) !== 1)
        return false;

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

    // check for other troops
    for (let i = 0; i < players.length; i++) {
        const p = players[i];
        for (let j = 0; j < p.troops.length; j++) {
            if (p.troops[j].x == newX && p.troops[j].y == newY)
                return false;
        }
    }

    return true;
}

// You currently cannot remount a ship without a port, I'm not a fan of this behavior
function moveTroop(troop: Troop, deltaX: number, deltaY: number): boolean {
    if (!troopCanMove(troop, deltaX, deltaY)) {
        return false;
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
    return true;
}

function tileHasTroop(x: number, y: number) {
    for (let i = 0; i < players.length; i++) {
        const playerTroops = players[i].troops;
        for (let j = 0; j < playerTroops.length; j++) {
            if (playerTroops[j].x == x && playerTroops[j].y == y)
                return [i, j];
        }
    }

    return false;
}

try {
    addEventListener("keydown", (event) => {
        const currentPlayer = players[playerTurn];
        const focusedTroop = currentPlayer.troops[selectedTroopIndex];

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
            playerTurn++;
            if (playerTurn >= players.length)
                playerTurn = 0;

            selectedTroopIndex = 0;
        }

        if (event.key == "t") {
            selectedTroopIndex++;
            if (selectedTroopIndex >= currentPlayer.troops.length)
                selectedTroopIndex = 0;
        }

        if (event.key == "m") {
            seed = Math.random() * 1e9;
            generateMap(seed);
        } 

        if (event.key == "1") {
            MAP_LENGTH--;
            if (MAP_LENGTH == 0)
                MAP_LENGTH = 1;
            console.log('Map length = ' + MAP_LENGTH);
            generateMap(seed);
        }

        if (event.key == "2") {
            MAP_LENGTH++;
            console.log('Map length = ' + MAP_LENGTH);
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

    addEventListener("mousedown", (_event: MouseEvent) => {
        const [x, y] = [pickedData[0], pickedData[1]];
        const res = tileHasTroop(x, y);

        // if there's no troop, try to move currently selected troop, otherwise add a troop
        if (res === false) {
            const selectedTroop = players[playerTurn].troops[selectedTroopIndex];

            if (moveTroop(selectedTroop, x - selectedTroop.x, y - selectedTroop.y)) {
                return;
            }

            players[playerTurn].troops.push(new Troop(x, y));
            selectedTroopIndex = players[playerTurn].troops.length - 1;
            return;
        }
        
        // otherwise, modify the tile or change troop focus
        if (res[0] == playerTurn) {

            if (selectedTroopIndex == res[1]) {
                board[y][x].modified = !board[y][x].modified;
            }
            else {
                selectedTroopIndex = res[1];
            }
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
